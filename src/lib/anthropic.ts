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
): Promise<Recommendation> {
  const conversation = recentLines.join("\n");

  const knowledgeBlock = knowledge?.trim()
    ? `\n\nRESSOURCES DE CLOSING DU CABINET (à privilégier dans tes conseils) :\n${knowledge.trim()}`
    : "";

  const obj = modeObjective(mode);
  const modeBlock = obj
    ? `\n\nRÔLE DE L'INTERVENANT — ADAPTE TES CONSEILS À CE CONTEXTE :\n${obj}`
    : "";

  const response = await client().messages.create({
    model: MODEL,
    max_tokens: 300,
    system: `${CABINET_CONTEXT}${modeBlock}${knowledgeBlock}

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
export async function scoreCall(transcript: string): Promise<AiFeedback> {
  const response = await client().messages.create({
    model: MODEL,
    max_tokens: 1500,
    system: `${CABINET_CONTEXT}

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
