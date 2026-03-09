import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI()

def analyze_video(transcript, title):
    prompt = f"""
    Analyse la vidéo YouTube suivante intitulée "{title}" en utilisant le transcript fourni.
    Réponds en français et structure ton analyse selon les 14 points suivants :

    1. Explain like I'm 12 : Résume la vidéo dans les termes les plus simples possibles, comme si tu l'expliquais à un enfant de 12 ans.
    2. Visualize the process : Crée une image mentale étape par étape ou une carte visuelle du fonctionnement des concepts et des idées.
    3. Break it into chunks : Divise les idées ou le sujet principal en 3 à 5 parties principales et explique brièvement chaque partie.
    4. Find the patterns : Quels modèles, formules ou règles puis-je extraire du sujet principal pour mieux m'en souvenir ?
    5. Use analogies : Compare le sujet principal à quelque chose de familier ou de non lié pour le rendre plus facile à comprendre.
    6. Break myths : Quelles sont les trois idées fausses sur le sujet principal, et quelle est la vérité derrière elles ?
    7. Challenge it : Quelles sont les malentendus ou erreurs courants que les gens commettent sur le sujet principal, et comment les éviter ?
    8. Relate to real life : Explique comment le sujet principal se connecte à la vie quotidienne ou à une situation pratique que je pourrais rencontrer.
    9. Teach it back : Comment enseignerais-je le sujet principal à quelqu'un qui n'y connaît rien ?
    10. Ask the critical 'why' : Pourquoi le sujet principal est-il important, et quelles sont ses implications clés dans le domaine ?
    11. Simulate or practice : Donne-moi un exemple simple, un scénario ou un exercice pour appliquer le sujet principal dès maintenant.
    12. Turn it into a story : Écris une courte histoire ou un scénario où le sujet principal est appliqué dans un contexte relatable.
    13. Prioritize learning : Quels sont les 2 ou 3 concepts les plus importants du sujet principal sur lesquels je devrais me concentrer en premier ?
    14. Find the gaps : Quels sont les aspects les plus négligés du sujet principal qui sont cruciaux pour le comprendre ?

    Transcript :
    {transcript}
    """
    
    response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {"role": "system", "content": "Tu es un expert en pédagogie et en analyse de contenu stratégique."},
            {"role": "user", "content": prompt}
        ]
    )
    
    return response.choices[0].message.content
