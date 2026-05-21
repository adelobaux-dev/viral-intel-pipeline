export interface PersonalityQuestion {
  id: string;
  question: string;
  /** Type MCQ ou texte libre. Texte libre = obligatoire, min ~30 caractères. */
  kind: "mc" | "open";
  options?: string[];
  helper?: string;
  minLength?: number;
}

/**
 * Questionnaire approfondi de personnalité / communication.
 * Inspiré de :
 * - Taibi KAHLER (Process Communication Model : 6 types — Empathique,
 *   Travaillomane, Persévérant, Rêveur, Rebelle, Promoteur ; bases & phases).
 * - Daniel KAHNEMAN (Système 1/2 ; biais sous fatigue/stress).
 * - JOULE & BEAUVOIS (engagement, soumission librement consentie,
 *   pied-dans-la-porte, étiquetage).
 * - Comm Colors (rouge/bleu/vert/jaune) + DISC.
 */
export const PERSONALITY_QUESTIONS: PersonalityQuestion[] = [
  // --- 1. PCM : type dominant (préférence relationnelle) ---
  {
    id: "q1",
    kind: "mc",
    question:
      "En entrant en contact avec un patient, ce qui te vient le plus naturellement c'est…",
    options: [
      "Créer du lien humain, chaleur, le mettre à l'aise (Empathique)",
      "Comprendre les faits, structurer, être précis(e) (Travaillomane)",
      "Affirmer mes convictions et mes valeurs (Persévérant)",
      "Imaginer son projet, prendre le temps, ressentir (Rêveur)",
      "Mettre de l'énergie, du fun, du rythme (Rebelle)",
      "Aller droit au but, charmer, conclure vite (Promoteur)",
    ],
  },
  // --- 2. PCM : besoins psychologiques principaux ---
  {
    id: "q2",
    kind: "mc",
    question: "Ce qui te recharge profondément au travail :",
    options: [
      "Être reconnu(e) en tant que personne (chaleur)",
      "Être reconnu(e) pour ton travail et ton expertise",
      "Être reconnu(e) pour tes convictions / engagement",
      "Avoir des moments de solitude / réflexion calme",
      "Avoir du contact ludique / des stimulations variées",
      "Voir des résultats rapides, sentir l'action",
    ],
  },
  // --- 3. PCM phase : sous stress sévère ---
  {
    id: "q3",
    kind: "mc",
    question: "Sous stress fort, ton « comportement de drivers » est plutôt :",
    options: [
      "« Fais plaisir » : tu surcompenses pour qu'on t'aime",
      "« Sois fort(e) » : tu te coupes des émotions",
      "« Sois parfait(e) » : tu surcontrôles les détails",
      "« Dépêche-toi » : tu accélères et tu éparpilles",
      "« Fais des efforts » : tu t'épuises à essayer",
    ],
    helper:
      "Inspiré des « drivers » de Kahler — choisis celui qui te ressemble le plus en période chargée.",
  },
  // --- 4. PCM : canal de communication préféré ---
  {
    id: "q4",
    kind: "mc",
    question: "Tu préfères qu'on te parle :",
    options: [
      "Avec chaleur (« Comment tu te sens ? »)",
      "Avec données et logique (« Voici les chiffres, qu'en penses-tu ? »)",
      "Avec opinions affirmées (« Mon avis est que… »)",
      "Avec douceur et espace (« Réfléchis tranquillement »)",
      "Avec humour et énergie (« On y va, c'est parti ! »)",
      "Avec directivité et impact (« Décide maintenant »)",
    ],
  },
  // --- 5. Kahneman — système 1 vs 2 ---
  {
    id: "q5",
    kind: "mc",
    question: "Face à une décision rapide sous fatigue, tu as tendance à :",
    options: [
      "Décider à l'instinct (Système 1) et ajuster ensuite",
      "Ralentir, demander 2 min, vérifier les faits (Système 2)",
      "Demander un avis extérieur avant de trancher",
      "Reporter la décision si elle peut attendre",
    ],
    helper:
      "Kahneman : ta préférence par défaut entre intuition rapide et délibération.",
  },
  // --- 6. Kahneman — biais que tu connais chez toi ---
  {
    id: "q6",
    kind: "mc",
    question: "Quel biais te piège le plus souvent ?",
    options: [
      "Ancrage (le 1er chiffre m'influence trop)",
      "Confirmation (je cherche ce qui me donne raison)",
      "Disponibilité (je sur-pondère ce que je viens de vivre)",
      "Aversion à la perte (je crains plus de perdre que d'aimer gagner)",
      "Excès de confiance",
      "Effet de halo (la 1ère impression colore tout)",
    ],
  },
  // --- 7. Joule & Beauvois — engagement ---
  {
    id: "q7",
    kind: "mc",
    question:
      "Pour engager un patient hésitant, ton réflexe selon Joule-Beauvois :",
    options: [
      "Lui faire dire OUI sur des petits pas (« pied-dans-la-porte »)",
      "Lui rappeler qu'il choisit librement (« c'est votre décision »)",
      "Donner un cadre fermé : il doit choisir entre 2 options (choix forcé)",
      "L'étiqueter positivement (« vous êtes le genre de personne qui… »)",
      "Aucune de ces tactiques : je laisse libre, point.",
    ],
    helper: "Tactiques d'engagement / soumission librement consentie.",
  },
  // --- 8. Conflit ---
  {
    id: "q8",
    kind: "mc",
    question: "Face à une objection ferme du patient, tu :",
    options: [
      "Restes calme et reformules (mirroring)",
      "Donnes une réponse rationnelle et chiffrée",
      "Affirmes ta position et tes valeurs",
      "Cherches l'émotion derrière l'objection",
      "Détends avec humour puis recadres",
      "Pousses vers la décision tout de suite",
    ],
  },
  // --- 9. Comm Colors / DISC ---
  {
    id: "q9",
    kind: "mc",
    question: "On te dirait plutôt :",
    options: [
      "Rouge / D — décideur, direct, orienté résultat",
      "Jaune / I — sociable, enthousiaste, expressif",
      "Vert / S — stable, à l'écoute, harmonieux",
      "Bleu / C — analytique, rigoureux, précis",
    ],
  },
  // --- 10. Style de feedback préféré ---
  {
    id: "q10",
    kind: "mc",
    question: "Le feedback qui te fait progresser :",
    options: [
      "Concret, vite, orienté action",
      "Bienveillant, en privé, avec tact",
      "Argumenté en détail avec le pourquoi",
      "Motivant, projeté vers du positif",
    ],
  },
  // --- 11. Rôle au cabinet ---
  {
    id: "q11",
    kind: "mc",
    question: "Ton rôle principal au cabinet :",
    options: [
      "Secrétaire",
      "Chirurgien",
      "Coordinatrice patients",
      "Infirmière (IDE)",
    ],
  },
  // --- 12. Énergie sociale ---
  {
    id: "q12",
    kind: "mc",
    question: "Une longue journée de conversations patient :",
    options: [
      "Me booste (extraversion)",
      "Me vide énergétiquement (introversion)",
      "Ça dépend des patients et de l'enjeu",
    ],
  },
  // --- 13. Tolérance à l'ambiguïté ---
  {
    id: "q13",
    kind: "mc",
    question: "Face à l'incertitude (cas patient flou, infos manquantes), tu :",
    options: [
      "Es à l'aise et tu avances",
      "Tu poses beaucoup de questions avant d'agir",
      "Tu cadres immédiatement avec des règles claires",
      "Tu te bloques jusqu'à avoir l'info exacte",
    ],
  },
  // --- 14. Storytelling vs faits ---
  {
    id: "q14",
    kind: "mc",
    question: "Pour convaincre un patient, tu utilises plus naturellement :",
    options: [
      "Une histoire / un témoignage similaire",
      "Des chiffres, des taux, des données",
      "Une métaphore visuelle / une projection",
      "Ton expertise / ta réputation",
    ],
  },
  // --- 15. Ouverte obligatoire : feedback récurrent ---
  {
    id: "q15",
    kind: "open",
    question:
      "Quels feedbacks tes collègues / patients te font-ils le plus souvent (positifs ET négatifs) ?",
    helper:
      "Décris-en 3-5 récurrents, exemples concrets si possible. Champ obligatoire.",
    minLength: 50,
  },
  // --- 16. Ouverte obligatoire : force ---
  {
    id: "q16",
    kind: "open",
    question: "Ta plus grande FORCE en communication patient (en 2-4 phrases).",
    minLength: 40,
  },
  // --- 17. Ouverte obligatoire : axe d'amélioration ---
  {
    id: "q17",
    kind: "open",
    question:
      "Ton principal AXE D'AMÉLIORATION ressenti (sois honnête, c'est confidentiel).",
    minLength: 40,
  },
  // --- 18. Ouverte obligatoire : conflit récent ---
  {
    id: "q18",
    kind: "open",
    question:
      "Raconte une situation de désaccord avec un patient (récente). Comment l'as-tu gérée ? Quel a été le résultat ?",
    minLength: 80,
  },
  // --- 19. Ouverte obligatoire : sous stress ---
  {
    id: "q19",
    kind: "open",
    question:
      "Quand tu es fatigué(e) ou sous stress, qu'observe ton entourage de toi (au travail) ?",
    minLength: 40,
  },
  // --- 20. Ouverte obligatoire : ressort de motivation ---
  {
    id: "q20",
    kind: "open",
    question:
      "Qu'est-ce qui te motive PROFONDÉMENT dans ce métier (au-delà du salaire) ?",
    minLength: 40,
  },
];
