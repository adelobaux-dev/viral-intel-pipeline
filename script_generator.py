import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()

client = OpenAI()

def generate_scripts(analysis, title):
    prompt = f"""
    En tant qu'expert YouTube et Instagram en viralité et personal branding (comme Caleb Ralston ou Gary Vee), doublé d'un expert en pédagogie, génère des scripts complets pour l'enregistrement de vidéos YouTube basés sur l'analyse suivante :
    
    Analyse :
    {analysis}
    
    Cible : Médecins entrepreneurs potentiellement intéressés à rejoindre notre mastermind.
    
    Génère :
    - 3 scripts longs (8-15 min)
    - 5 scripts courts (1-3 min)
    
    Chaque script doit inclure :
    - Titre accrocheur
    - Hook puissant
    - Plan détaillé
    - Script mot-à-mot
    - Suggestions de B-roll
    - Appel à l'action (CTA) vers le mastermind.
    
    Réponds en français.
    """
    
    response = client.chat.completions.create(
        model="gpt-4.1-mini",
        messages=[
            {"role": "system", "content": "Tu es un expert en viralité YouTube/Instagram et en pédagogie, spécialisé dans le personal branding pour les professionnels de santé."},
            {"role": "user", "content": prompt}
        ]
    )
    
    return response.choices[0].message.content
