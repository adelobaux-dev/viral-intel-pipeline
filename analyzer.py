import json
import os

from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI()

ANALYSIS_FIELDS = [
    ("explain", "Explain like I'm 12 : Résume la vidéo dans les termes les plus simples possibles, comme si tu l'expliquais à un enfant de 12 ans."),
    ("visualize", "Visualize the process : Crée une image mentale étape par étape ou une carte visuelle du fonctionnement des concepts et des idées."),
    ("breakIntoChunks", "Break it into chunks : Divise les idées ou le sujet principal en 3 à 5 parties principales et explique brièvement chaque partie."),
    ("patterns", "Find the patterns : Quels modèles, formules ou règles puis-je extraire du sujet principal pour mieux m'en souvenir ?"),
    ("analogies", "Use analogies : Compare le sujet principal à quelque chose de familier ou de non lié pour le rendre plus facile à comprendre."),
    ("myths", "Break myths : Quelles sont les trois idées fausses sur le sujet principal, et quelle est la vérité derrière elles ?"),
    ("challenges", "Challenge it : Quelles sont les malentendus ou erreurs courants que les gens commettent sur le sujet principal, et comment les éviter ?"),
    ("realLife", "Relate to real life : Explique comment le sujet principal se connecte à la vie quotidienne ou à une situation pratique que je pourrais rencontrer."),
    ("teachBack", "Teach it back : Comment enseignerais-je le sujet principal à quelqu'un qui n'y connaît rien ?"),
    ("whyMatters", "Ask the critical 'why' : Pourquoi le sujet principal est-il important, et quelles sont ses implications clés dans le domaine ?"),
    ("simulate", "Simulate or practice : Donne-moi un exemple simple, un scénario ou un exercice pour appliquer le sujet principal dès maintenant."),
    ("story", "Turn it into a story : Écris une courte histoire ou un scénario où le sujet principal est appliqué dans un contexte relatable."),
    ("prioritize", "Prioritize learning : Quels sont les 2 ou 3 concepts les plus importants du sujet principal sur lesquels je devrais me concentrer en premier ?"),
    ("gaps", "Find the gaps : Quels sont les aspects les plus négligés du sujet principal qui sont cruciaux pour le comprendre ?"),
]


def analyze_video(transcript, title):
    sections_spec = "\n".join(
        f'- "{key}": {description}' for key, description in ANALYSIS_FIELDS
    )

    prompt = f"""
Analyse la vidéo YouTube suivante intitulée "{title}" en utilisant le transcript fourni.
Réponds en français.

Retourne un objet JSON strict (sans texte autour) avec exactement ces clés, chaque
valeur étant le texte de la section correspondante :

{sections_spec}

Transcript :
{transcript}
"""

    response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {"role": "system", "content": "Tu es un expert en pédagogie et en analyse de contenu stratégique. Tu réponds uniquement avec du JSON valide."},
            {"role": "user", "content": prompt},
        ],
        response_format={"type": "json_object"},
    )

    content = response.choices[0].message.content
    try:
        data = json.loads(content)
    except json.JSONDecodeError:
        data = {key: "" for key, _ in ANALYSIS_FIELDS}
        data["explain"] = content

    for key, _ in ANALYSIS_FIELDS:
        data.setdefault(key, "")

    data["rawAnalysis"] = format_analysis_markdown(data)
    return data


def format_analysis_markdown(data):
    lines = []
    for key, description in ANALYSIS_FIELDS:
        heading = description.split(" : ", 1)[0]
        lines.append(f"### {heading}\n\n{data.get(key, '').strip()}\n")
    return "\n".join(lines)
