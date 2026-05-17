export interface PersonalityQuestion {
  id: string;
  question: string;
  options: string[];
}

/**
 * Questionnaire de personnalité (Comm Colors, Process Communication,
 * styles relationnels) pour personnaliser le feedback de chaque utilisateur.
 */
export const PERSONALITY_QUESTIONS: PersonalityQuestion[] = [
  {
    id: "q1",
    question: "Au téléphone avec un patient, ton réflexe naturel est de…",
    options: [
      "Aller droit au but et obtenir une décision",
      "Créer du lien et mettre à l'aise",
      "Donner des explications précises et structurées",
      "Être enthousiaste et donner envie",
    ],
  },
  {
    id: "q2",
    question: "Ce qui te motive le plus dans ton travail :",
    options: [
      "Les résultats et les objectifs atteints",
      "Les relations humaines et l'harmonie",
      "La rigueur, la qualité, bien faire les choses",
      "La nouveauté, le challenge, l'impact",
    ],
  },
  {
    id: "q3",
    question: "Sous pression, ton risque est plutôt de…",
    options: [
      "Devenir directif ou impatient",
      "Trop vouloir plaire / éviter le conflit",
      "Te réfugier dans les détails / sur-analyser",
      "T'éparpiller ou en faire trop",
    ],
  },
  {
    id: "q4",
    question: "Un patient hésitant te donne envie de…",
    options: [
      "Le pousser à se décider maintenant",
      "Le rassurer émotionnellement",
      "Lui apporter des preuves et des faits",
      "Lui projeter un futur désirable",
    ],
  },
  {
    id: "q5",
    question: "Ton mode de communication préféré :",
    options: [
      "Bref et factuel",
      "Chaleureux et personnel",
      "Détaillé et logique",
      "Imagé et énergique",
    ],
  },
  {
    id: "q6",
    question: "Ce qu'on te reproche parfois :",
    options: [
      "Trop direct / sec",
      "Trop conciliant / pas assez ferme",
      "Trop dans le détail / lent à conclure",
      "Trop dispersé / promesses excessives",
    ],
  },
  {
    id: "q7",
    question: "Face à une objection prix, tu es plutôt :",
    options: [
      "À l'aise, tu recadres vite",
      "Mal à l'aise, tu cèdes facilement",
      "Tu argumentes longuement",
      "Tu contournes par l'émotion/le rêve",
    ],
  },
  {
    id: "q8",
    question: "Tu écoutes le patient…",
    options: [
      "En cherchant déjà la prochaine étape",
      "Avec beaucoup d'empathie",
      "En notant les informations clés",
      "En rebondissant avec énergie",
    ],
  },
  {
    id: "q9",
    question: "Ta plus grande force en communication (texte libre) :",
    options: [],
  },
  {
    id: "q10",
    question: "Ton principal axe d'amélioration ressenti (texte libre) :",
    options: [],
  },
  {
    id: "q11",
    question: "Ton rôle principal au cabinet :",
    options: ["Secrétaire", "Chirurgien", "Closeuse", "Infirmière (IDE)"],
  },
  {
    id: "q12",
    question: "Comment réagis-tu à un feedback critique ?",
    options: [
      "Je veux du concret, vite, et j'agis",
      "J'ai besoin qu'il soit dit avec tact",
      "J'ai besoin de comprendre le pourquoi en détail",
      "Je rebondis vite si on me motive",
    ],
  },
];
