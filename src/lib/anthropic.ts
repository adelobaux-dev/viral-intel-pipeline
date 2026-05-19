import Anthropic from "@anthropic-ai/sdk";
import { CABINET_CONTEXT, modeObjective } from "./cares";
import type {
  AiFeedback,
  CaresStep,
  ConsultationMode,
  Recommendation,
} from "./types";

let _client: Anthropic | null = null;

function client(): Anthropic {
  if (!_client) {
    _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return _client;
}

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("Réponse IA non parsable");
  return JSON.parse(raw.slice(start, end + 1));
}

/**
 * Recommandation temps réel : analyse les dernières phrases et renvoie
 * un conseil ultra-court (1 phrase) à lire en un coup d'œil.
 */
export async function getLiveRecommendation(
  recentLines: string[],
  knowledge?: string,
  mode?: ConsultationMode,
  userProfile?: string,
): Promise<Recommendation> {
  const conversation = recentLines.join("\n");

  const knowledgeBlock = knowledge?.trim()
    ? `\n\nRESSOURCES DE CLOSING DU CABINET (à privilégier dans tes conseils) :\n${knowledge.trim()}`
    : "";

  const obj = modeObjective(mode);
  const modeBlock = obj
    ? `\n\nRÔLE DE L'INTERVENANT — ADAPTE TES CONSEILS À CE CONTEXTE :\n${obj}`
    : "";

  const profileBlock = userProfile?.trim()
    ? `\n\nPROFIL DE PERSONNALITÉ DE L'INTERVENANT — adapte le ton et le canal de tes conseils à CE profil :\n${userProfile.trim().slice(0, 1500)}`
    : "";

  const response = await client().messages.create({
    model: MODEL,
    max_tokens: 300,
    system: `${CABINET_CONTEXT}${modeBlock}${profileBlock}${knowledgeBlock}

Analyse la conversation EN COURS. Donne UN seul conseil de closing, très court (1 phrase max), à lire en un coup d'œil.
Évalue aussi : "importance" = degré d'importance du conseil maintenant (entier 1 à 10), "closing_score" = estimation de la qualité globale du closing jusqu'ici (entier 0 à 10).
Réponds STRICTEMENT en JSON :
{"step":"connecter|analyser|rassurer|engager|securiser","message":"<conseil 1 phrase>","importance":<1-10>,"closing_score":<0-10>}`,
    messages: [
      {
        role: "user",
        content: `Dernières phrases de la conversation :\n${conversation}\n\nQuel est le meilleur conseil maintenant ?`,
      },
    ],
  });

  const text =
    response.content[0]?.type === "text" ? response.content[0].text : "";
  const parsed = extractJson(text) as {
    step: CaresStep;
    message: string;
    importance?: number;
    closing_score?: number;
  };

  const clamp = (v: unknown, min: number, max: number, def: number) => {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
  };

  return {
    id: crypto.randomUUID(),
    step: parsed.step,
    message: parsed.message,
    importance: clamp(parsed.importance, 1, 10, 5),
    closingScore: clamp(parsed.closing_score, 0, 10, 0),
    createdAt: Date.now(),
  };
}

/**
 * Scoring de fin d'appel : note /10 sur le respect du script C.A.R.E.S.,
 * feedback constructif et résumé patient pour Doctolib.
 */
export async function scoreCall(
  transcript: string,
  userProfile?: string,
): Promise<AiFeedback> {
  const profileBlock = userProfile?.trim()
    ? `\n\nPROFIL DE PERSONNALITÉ DE L'INTERVENANT — formule le feedback de façon adaptée à CE profil (canal, ton), et cible les améliorations LES PLUS efficientes pour lui :\n${userProfile.trim().slice(0, 1500)}`
    : "";
  const response = await client().messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: `${CABINET_CONTEXT}${profileBlock}

Tu évalues un appel TERMINÉ. Note le respect du script C.A.R.E.S. et fournis un feedback constructif.
Réponds STRICTEMENT en JSON :
{
  "score": <nombre 0-10>,
  "strengths": ["<point fort>", ...],
  "improvements": ["<axe d'amélioration>", ...],
  "cares_breakdown": {"connecter":<0-10>,"analyser":<0-10>,"rassurer":<0-10>,"engager":<0-10>,"securiser":<0-10>},
  "patient_summary": {"motif":"...","taille_poids":"...","budget":"...","notes":"..."}
}`,
    messages: [
      {
        role: "user",
        content: `Transcription complète de l'appel :\n\n${transcript}`,
      },
    ],
  });

  const text =
    response.content[0]?.type === "text" ? response.content[0].text : "";
  const parsed = extractJson(text) as AiFeedback;
  parsed.score = Math.max(0, Math.min(10, Number(parsed.score) || 0));
  return parsed;
}

/**
 * Auto-apprentissage : à la fin de chaque conversation, extrait des
 * enseignements réutilisables (objections rencontrées + meilleures réponses,
 * formulations qui ont marché) pour enrichir la base de connaissances et
 * améliorer les futurs conseils.
 */
export async function extractLearnings(
  transcript: string,
): Promise<{ title: string; content: string } | null> {
  try {
    const response = await client().messages.create({
      model: MODEL,
      max_tokens: 600,
      system: `${CABINET_CONTEXT}

À partir de la conversation ci-dessous, extrais 2 à 5 enseignements DURABLES et réutilisables pour de futures conversations de closing (objections rencontrées + meilleure réponse, formulations efficaces, signaux d'achat). Sois concret et générique (pas de données patient nominatives).
Réponds STRICTEMENT en JSON : {"title":"<titre court>","content":"<puces d'enseignements>"}`,
      messages: [
        { role: "user", content: `Conversation :\n\n${transcript}` },
      ],
    });
    const text =
      response.content[0]?.type === "text" ? response.content[0].text : "";
    const parsed = extractJson(text) as { title: string; content: string };
    if (!parsed?.content?.trim()) return null;
    return {
      title: parsed.title?.trim() || "Apprentissage automatique",
      content: parsed.content.trim(),
    };
  } catch {
    return null;
  }
}

const EXPERT_PERSONA = `Tu es un comité d'experts de classe mondiale en business, marketing, branding, closing et négociation. Tu raisonnes simultanément comme :
- Chris Voss (négociation, empathie tactique, "calibrated questions"),
- Zig Ziglar (vente relationnelle, motivation),
- Al Ries (positionnement, branding),
- Alex Hormozi (offres irrésistibles, valeur, acquisition),
- Dan Kennedy (marketing direct, copywriting, ROI),
- Dan Martell (SaaS, systèmes, scalabilité produit).
Contexte : application d'assistance en communication patient pour un cabinet de chirurgie esthétique haut de gamme (Dr Delobaux), méthode C.A.R.E.S., rôles secrétaire/chirurgien/responsable de programmation/IDE.`;

/**
 * Recommandations d'évolution de l'app à partir des données de conversations.
 * Régénéré ~toutes les 48 h (throttle géré côté route).
 */
export async function generateAppRecommendations(
  dataSummary: string,
): Promise<string> {
  const response = await client().messages.create({
    model: MODEL,
    max_tokens: 1200,
    system: `${EXPERT_PERSONA}

À partir des données réelles de conversations ci-dessous (scores, points faibles, objections, feedbacks), propose des AMÉLIORATIONS CONCRÈTES de l'application et de la méthode pour augmenter la conversion et la signature de devis.
Format : 5 à 8 recommandations priorisées, chacune en 1-3 phrases, avec un libellé d'impact (Fort/Moyen) et la logique d'expert mobilisée. Pas de blabla, du concret actionnable. Réponds en texte structuré (puces), en français.`,
    messages: [
      {
        role: "user",
        content: `Données agrégées des dernières conversations :\n\n${dataSummary}`,
      },
    ],
  });
  return response.content[0]?.type === "text"
    ? response.content[0].text
    : "Aucune recommandation générée.";
}

/**
 * Rapport de coaching d'équipe destiné au Dr Delobaux : performances,
 * erreurs, langage inadapté, leviers concrets pour mieux performer.
 */
export async function generateTeamReport(
  dataSummary: string,
): Promise<string> {
  const response = await client().messages.create({
    model: MODEL,
    max_tokens: 1400,
    system: `${EXPERT_PERSONA}

Tu produis un RAPPORT DE COACHING confidentiel pour le Dr Delobaux (dirigeant). À partir des données réelles (performances par membre, scores, feedbacks, erreurs techniques, extraits de conversations), analyse :
1. Performances par collaborateur (forces / faiblesses).
2. Erreurs récurrentes (techniques ET de communication).
3. Langage inadapté ou contre-productif détecté (cite des exemples génériques).
4. 🚩 RED FLAGS COMMUNICATIONNELS PAR UTILISATEUR : pour CHAQUE collaborateur nommé, liste explicitement ses signaux d'alerte de communication (ex : coupe la parole, manque d'empathie, pression excessive, jargon médical anxiogène, survente, absence d'écoute active…) et leur gravité.
5. 5 leviers prioritaires et actionnables pour augmenter le closing et la signature de devis.
Sois direct, concret, sans complaisance, en français, format structuré (titres + puces).`,
    messages: [
      {
        role: "user",
        content: `Données agrégées de l'équipe :\n\n${dataSummary}`,
      },
    ],
  });
  return response.content[0]?.type === "text"
    ? response.content[0].text
    : "Aucun rapport généré.";
}

/**
 * Analyse de personnalité (Comm Colors / Process Comm / styles relationnels)
 * à partir des réponses au questionnaire d'onboarding.
 */
export async function analyzePersonality(
  answersText: string,
): Promise<string> {
  const response = await client().messages.create({
    model: MODEL,
    max_tokens: 1000,
    system: `Tu es un expert en analyse de personnalité appliquée à la communication et à la vente : Process Communication Model (Kahler), Comm Colors (rouge/bleu/vert/jaune), DISC, styles relationnels.
À partir des réponses ci-dessous, produis un PROFIL exploitable pour personnaliser le coaching de cette personne au cabinet (chirurgie esthétique, méthode C.A.R.E.S.).
Structure (français, concis) :
- Profil dominant (couleur Comm Colors + base Process Comm probable + style)
- Forces clés en communication patient
- Faiblesses / pièges sous stress
- 🚩 Red flags communicationnels à surveiller
- Améliorations prioritaires et LES PLUS efficientes pour ce profil
- Comment lui donner du feedback (canal de communication qui marche pour lui)`,
    messages: [{ role: "user", content: answersText }],
  });
  return response.content[0]?.type === "text"
    ? response.content[0].text
    : "Profil non généré.";
}
