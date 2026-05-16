import type { CaresStep } from "./types";

export const CARES_STEPS: { key: CaresStep; label: string; description: string }[] =
  [
    {
      key: "connecter",
      label: "Connecter",
      description: "Créer le lien, instaurer la confiance.",
    },
    {
      key: "analyser",
      label: "Analyser",
      description: "Comprendre le motif, la morphologie, le budget, les attentes.",
    },
    {
      key: "rassurer",
      label: "Rassurer",
      description: "Lever les objections (prix, sécurité, douleur, résultats).",
    },
    {
      key: "engager",
      label: "Engager",
      description: "Proposer la prochaine étape (consultation, devis, RDV).",
    },
    {
      key: "securiser",
      label: "Sécuriser",
      description: "Confirmer et verrouiller le prépaiement (déduit du devis).",
    },
  ];

export const CARES_LABELS: Record<CaresStep, string> = CARES_STEPS.reduce(
  (acc, s) => ({ ...acc, [s.key]: s.label }),
  {} as Record<CaresStep, string>,
);

/**
 * Prompt système partagé décrivant la posture de closing du cabinet.
 * Réutilisé pour les recommandations temps réel ET le scoring final.
 */
export const CABINET_CONTEXT = `Tu es un assistant de closing haut de gamme pour le Dr Alexis Delobaux (chirurgie esthétique : SMART BBL, remodelage costal).
Tu accompagnes des closers, IDE et médecins pendant des échanges avec des patients.
Tu raisonnes selon la méthode C.A.R.E.S. du cabinet :
- Connecter : créer le lien, instaurer la confiance.
- Analyser : comprendre le motif, la morphologie (taille/poids), le budget, les attentes.
- Rassurer : lever les objections (prix, sécurité, douleur, résultats).
- Engager : proposer la prochaine étape (consultation, devis, RDV).
- Sécuriser : confirmer et verrouiller le prépaiement de 50€ (toujours rappeler qu'il est déduit du devis).
Règles : si le patient hésite sur le prix (ex : prépaiement de 50€), suggère de dire que c'est déduit du devis.
Si le patient est pressé, suggère la variante courte de réassurance.
Ton haut de gamme, bienveillant, jamais agressif.`;
