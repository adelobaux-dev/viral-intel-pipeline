import Anthropic from "@anthropic-ai/sdk";
import { CABINET_CONTEXT, modeObjective } from "./cares";
import type {
  AiFeedback,
  CaresStep,
  ConsultationMode,
  ConsultationType,
  Recommendation,
} from "./types";

/** Règles d'évaluation strictes par RÔLE — étanchéité chirurgien ≠ closer. */
function roleRules(mode?: ConsultationMode): string {
  switch (mode) {
    case "chirurgien":
      return `RÔLE = CHIRURGIEN. PÉRIMÈTRE EXCLUSIF : adhésion au projet, urgence du projet, expertise rassurante, transition vers la coordinatrice patients.
INTERDITS pour ce rôle (NE JAMAIS reprocher leur absence) : discussion du prix/tarif, négociation, prépaiement 50€, dépôt 2000€, sécurisation financière, exploration budget. Ces étapes (= "Engager"/"Sécuriser") appartiennent EXCLUSIVEMENT à la coordinatrice/closer.
À la place : terminer par une PASSATION claire à la coordinatrice (résumé projet, dates envisagées, prochaine étape).`;
    case "closeuse":
      return `RÔLE = COORDINATRICE PATIENTS. PÉRIMÈTRE : approfondir les "pains", valeur, lever objections prix, RECAP oral pré-clôture obligatoire, verrouiller le DÉPÔT de 2000€ (déduit du devis) et la date ferme. Le prépaiement 50€ est fait en amont par la secrétaire — ne pas le redemander.`;
    case "secretaire":
      return `RÔLE = SECRÉTAIRE. PÉRIMÈTRE : maximiser conversion lead → RDV, prépaiement 50€ (déduit du devis) NON-NÉGOCIABLE pour bloquer le créneau ; formulation type : "Pour sécuriser votre créneau qui part vite sur septembre/octobre, on bloque avec 50€ déduits du devis." L'absence de cette étape = PREMIÈRE alerte rouge.`;
    case "ide":
      return `RÔLE = INFIRMIÈRE (IDE). PÉRIMÈTRE : EMPATHIE + PÉDAGOGIE sur soins infirmiers et post-op, vérifier compréhension, sécuriser le suivi. PAS DE VENTE. Ne pas reprocher l'absence d'étapes commerciales.`;
    default:
      return "";
  }
}

/** Règles selon le TYPE de consultation. */
function typeRules(t?: ConsultationType): string {
  switch (t) {
    case "post-op":
      return `TYPE = POST-OP / SUIVI. C.A.R.E.S. commerciale NON applicable. Évalue : qualité du suivi, empathie, clarté des consignes, sécurité du patient. PAS de score commercial.`;
    case "qualification":
      return `TYPE = QUALIFICATION. Objectif : qualifier l'intérêt et l'éligibilité, prendre un RDV. Pas de signature de devis attendue.`;
    case "urgence":
      return `TYPE = URGENCE. Priorité absolue à la sécurité et au triage. Pas d'évaluation commerciale.`;
    case "primo":
    default:
      return `TYPE = PRIMO-CONSULTATION. Évaluation commerciale standard selon le rôle.`;
  }
}

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
  consultationType?: ConsultationType,
): Promise<Recommendation> {
  const conversation = recentLines.join("\n");

  const knowledgeBlock = knowledge?.trim()
    ? `\n\nRESSOURCES DE CLOSING DU CABINET (à privilégier dans tes conseils) :\n${knowledge.trim()}`
    : "";

  const obj = modeObjective(mode);
  const modeBlock = obj
    ? `\n\n⚠️ PRIORITÉ ABSOLUE — RÔLE DE L'INTERVENANT : ${obj}\nChaque conseil que tu donnes DOIT servir directement cet objectif de rôle et être formulé pour CE rôle précis. Ne donne jamais un conseil générique.`
    : "";
  const rulesBlock = `\n\nRÈGLES DE PÉRIMÈTRE (à respecter strictement) :\n${roleRules(mode)}\n${typeRules(consultationType)}`;

  const profileBlock = userProfile?.trim()
    ? `\n\nPROFIL DE COMMUNICATION DE L'INTERVENANT — adapte le ton et le canal de tes conseils à CE profil :\n${userProfile.trim().slice(0, 1500)}`
    : "";

  const response = await client().messages.create({
    model: MODEL,
    max_tokens: 300,
    system: `${CABINET_CONTEXT}${modeBlock}${rulesBlock}${profileBlock}${knowledgeBlock}

Analyse la conversation EN COURS. Donne UN seul conseil, très court (1 phrase max), à lire en un coup d'œil, STRICTEMENT adapté au rôle ET au type de consultation ci-dessus.
Évalue aussi :
- "importance" = degré d'importance du conseil maintenant (entier 1 à 10).
- "closing_score" = qualité de CONVERSION/engagement (entier 0 à 10), pondérée AVANT TOUT par les RÉACTIONS DE LA PATIENTE (questions, objections, signaux d'achat, ton, implication) — PAS seulement par le respect du script idéal. Si la patiente se désengage (réponses courtes, évitement, réticence), baisse le score ; si elle s'implique (questions concrètes, projection, accord), monte-le.
Réponds STRICTEMENT en JSON :
{"step":"connecter|analyser|rassurer|engager|securiser","message":"<conseil 1 phrase adapté au rôle>","importance":<1-10>,"closing_score":<0-10>}`,
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
  mode?: ConsultationMode,
  consultationType?: ConsultationType,
): Promise<AiFeedback> {
  const profileBlock = userProfile?.trim()
    ? `\n\nPROFIL DE COMMUNICATION DE L'INTERVENANT — formule le feedback de façon adaptée à CE profil (canal, ton), et cible les améliorations LES PLUS efficientes pour lui :\n${userProfile.trim().slice(0, 1500)}`
    : "";
  const rulesBlock = `\n\nRÈGLES DE PÉRIMÈTRE — l'évaluation DOIT respecter ces règles :\n${roleRules(mode)}\n${typeRules(consultationType)}\n\nIMPORTANT : pour les critères HORS-PÉRIMÈTRE du rôle (ex. "securiser"/"engager" pour un chirurgien), mets 10/10 ("sans objet — hors périmètre") et NE LES MENTIONNE PAS comme axes d'amélioration. Évalue uniquement ce qui relève réellement de ce rôle et de ce type de consultation.`;
  const response = await client().messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: `${CABINET_CONTEXT}${profileBlock}${rulesBlock}

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
Contexte : application d'assistance en communication patient pour un cabinet de chirurgie esthétique haut de gamme (Dr Delobaux), méthode C.A.R.E.S., rôles secrétaire/chirurgien/coordinatrice patients/IDE.`;

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

/**
 * Reconnaissance des patterns de communication RÉCURRENTS d'une personne.
 * Fusionne l'observation de la conversation avec son profil connu, pour
 * un coaching de plus en plus personnalisé (auto-apprentissage par user).
 */
export async function extractCommPatterns(
  userUtterances: string,
  existing?: string,
): Promise<string | null> {
  if (!userUtterances.trim()) return existing ?? null;
  try {
    const response = await client().messages.create({
      model: MODEL,
      max_tokens: 700,
      system: `Tu es un expert en analyse des patterns de communication (Process Comm, Comm Colors, PNL). On te donne ce que DIT une personne précise pendant ses conversations patients, et son profil de patterns DÉJÀ connu.
Mets à jour un profil STABLE et concis de ses patterns RÉCURRENTS (tics de langage, posture par défaut, forces, faiblesses, déclencheurs de stress, ce qui marche pour elle). Fusionne intelligemment avec l'existant (affine, ne fais pas qu'empiler). Format : puces courtes, français.`,
      messages: [
        {
          role: "user",
          content: `PATTERNS DÉJÀ CONNUS :\n${existing || "(aucun)"}\n\nNOUVELLES PRISES DE PAROLE DE LA PERSONNE :\n${userUtterances.slice(0, 7000)}`,
        },
      ],
    });
    const txt =
      response.content[0]?.type === "text"
        ? response.content[0].text.trim()
        : "";
    return txt || existing || null;
  } catch {
    return existing ?? null;
  }
}
