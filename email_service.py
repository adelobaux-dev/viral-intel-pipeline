import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

def send_email(subject, body, to_email):
    # Note: Pour Gmail, il est recommandé d'utiliser un mot de passe d'application (App Password)
    # ou l'API Gmail OAuth2. Ici, nous utilisons une approche SMTP simple pour l'exemple.
    # Dans un environnement de production, l'API Gmail OAuth2 est préférable.
    
    from_email = os.getenv("EMAIL_FROM")
    # Pour l'envoi d'e-mails dans le bac à sable, nous pourrions avoir besoin de configurations spécifiques.
    # Ici, nous simulons l'envoi d'e-mail ou utilisons un service tiers si disponible.
    
    msg = MIMEMultipart()
    msg['From'] = from_email
    msg['To'] = to_email
    msg['Subject'] = subject
    
    msg.attach(MIMEText(body, 'html'))
    
    print(f"Simulation d'envoi d'e-mail à {to_email} avec le sujet: {subject}")
    # Envoi réel (nécessite des identifiants SMTP valides dans .env)
    # with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
    #     server.login(from_email, os.getenv("EMAIL_PASSWORD"))
    #     server.send_message(msg)
    
    return True
