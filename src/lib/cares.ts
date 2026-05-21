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
export const CABINET_CONTEXT = `Tu es un assistant en communication patient haut de gamme pour le Dr Alexis Delobaux (chirurgie esthétique : SMART BBL, remodelage costal).
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

import type { ConsultationMode } from "./types";

export const CONSULTATION_MODES: {
  key: ConsultationMode;
  label: string;
  objective: string;
}[] = [
  {
    key: "secretaire",
    label: "Secrétaire",
    objective:
      "Tu assistes la SECRÉTAIRE. Objectif : maximiser la conversion des leads en RENDEZ-VOUS. Priorité : créer le lien, qualifier rapidement le besoin, lever les freins à la prise de RDV, et verrouiller un créneau ferme (rappeler le prépaiement de 50€ déduit du devis comme engagement).",
  },
  {
    key: "chirurgien",
    label: "Chirurgien",
    objective:
      "Tu assistes le CHIRURGIEN (Dr Delobaux). Objectif : maximiser l'adhésion du patient au projet et créer l'URGENCE du projet, tout en préparant le terrain pour la coordinatrice patients qui interviendra ensuite (faire signer le devis). Priorité : expertise rassurante, projection du résultat, importance de ne pas reporter.",
  },
  {
    key: "closeuse",
    label: "Coordinatrice patients",
    objective:
      "Tu assistes la COORDINATRICE PATIENTS. Objectif : maximiser la SIGNATURE DU DEVIS. Priorité : approfondir les 'pains' (douleurs, gênes, impact émotionnel et quotidien du patient), amplifier la valeur de la solution, lever les objections prix/peur, et conduire fermement vers la signature.",
  },
  {
    key: "ide",
    label: "Infirmière (IDE)",
    objective:
      "Tu assistes l'INFIRMIÈRE. Contexte : le devis est signé et l'intervention programmée. Objectif : être la plus EMPATHIQUE et DIDACTIQUE possible. Priorité : expliquer clairement les soins infirmiers et post-opératoires, rassurer, vérifier la bonne compréhension, sécuriser le suivi (pas de vente ici).",
  },
];

export const CONSULTATION_MODE_LABELS: Record<ConsultationMode, string> =
  CONSULTATION_MODES.reduce(
    (acc, m) => ({ ...acc, [m.key]: m.label }),
    {} as Record<ConsultationMode, string>,
  );

export function modeObjective(mode: ConsultationMode | undefined): string {
  const found = CONSULTATION_MODES.find((m) => m.key === mode);
  return found ? found.objective : "";
}

/** Mappe le rôle du compte connecté vers le mode C.A.R.E.S. adapté. */
export function roleToMode(role: string | undefined): ConsultationMode {
  switch (role) {
    case "doctor":
      return "chirurgien";
    case "ide":
      return "ide";
    case "closer":
      return "closeuse";
    case "secretaire":
      return "secretaire";
    case "admin":
      return "chirurgien"; // Dr Delobaux ; modifiable manuellement
    default:
      return "closeuse";
  }
}
