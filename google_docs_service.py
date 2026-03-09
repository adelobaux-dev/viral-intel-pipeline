import os
import subprocess
from datetime import datetime

def create_google_doc(content, title):
    # Créer un fichier temporaire en Markdown
    temp_file = f"/tmp/{title}.md"
    with open(temp_file, "w") as f:
        f.write(content)
    
    # Utiliser rclone pour uploader le fichier sur Google Drive
    # rclone convertira automatiquement le fichier Markdown en Google Doc s'il est configuré pour
    # Sinon, nous l'uploadons simplement dans le dossier spécifié
    folder_id = os.getenv("GOOGLE_DRIVE_FOLDER_ID", "17BObcAJJm5sDJZqW1y8zJymTL8n2VJRX")
    remote_path = f"manus_google_drive:{{{folder_id}}}/{title}.md"
    
    try:
        subprocess.run([
            "rclone", "copy", temp_file, f"manus_google_drive:{{{folder_id}}}",
            "--config", "/home/ubuntu/.gdrive-rclone.ini"
        ], check=True)
        
        # Obtenir le lien de partage
        link_result = subprocess.run([
            "rclone", "link", f"manus_google_drive:{{{folder_id}}}/{title}.md",
            "--config", "/home/ubuntu/.gdrive-rclone.ini"
        ], capture_output=True, text=True, check=True)
        
        return link_result.stdout.strip()
    except Exception as e:
        print(f"Erreur lors de l'upload sur Google Drive: {e}")
        return None
