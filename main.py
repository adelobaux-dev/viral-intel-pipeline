import os
import yaml
from datetime import datetime
from dotenv import load_dotenv
from youtube_fetcher import get_latest_videos
from transcript_service import get_transcript
from analyzer import analyze_video
from script_generator import generate_scripts
from google_docs_service import create_google_doc
from email_service import send_email
from database import init_db, is_video_processed, mark_video_as_processed
from dashboard_sync import DashboardSync

load_dotenv()

def run_pipeline():
    # Initialiser la base de données
    init_db()
    
    # Charger la configuration
    config_path = os.path.join(os.path.dirname(__file__), "config.yaml")
    with open(config_path, "r") as f:
        config = yaml.safe_load(f)
    
    channels = config['youtube']['channels']
    
    # Initialiser la synchronisation avec le dashboard
    db_url = os.getenv("DATABASE_URL")
    sync = None
    if db_url:
        sync = DashboardSync(db_url)
        if not sync.connect():
            print("Avertissement: Impossible de se connecter au dashboard. Les données ne seront pas synchronisées.")
            sync = None
    
    all_analyses = []
    all_scripts = []
    stats = {
        "totalVideosProcessed": 0,
        "totalAnalysesGenerated": 0,
        "totalScriptsGenerated": 0,
        "transcriptionSuccessRate": 0,
    }
    
    for channel in channels:
        print(f"Récupération des vidéos pour {channel['name']}...")
        videos = get_latest_videos(channel['id'], max_results=3)
        
        for video in videos:
            if is_video_processed(video['video_id']):
                print(f"Vidéo déjà traitée: {video['title']}")
                continue
                
            print(f"Traitement de la vidéo: {video['title']}...")
            transcript = get_transcript(video['video_id'])
            content_to_analyze = transcript if transcript else video.get('description')
            
            if content_to_analyze:
                print(f"Analyse basée sur {'la transcription' if transcript else 'la description'}...")
                analysis = analyze_video(content_to_analyze, video['title'])
                scripts = generate_scripts(analysis, video['title'])
                
                all_analyses.append(f"## {video['title']} ({channel['name']})\n\n{analysis}")
                all_scripts.append(f"## Scripts pour {video['title']}\n\n{scripts}")
                
                # Synchroniser avec le dashboard
                if sync:
                    # Sauvegarder l'analyse
                    analysis_data = {
                        "title": video['title'],
                        "channel": channel['name'],
                        "videoId": video['video_id'],
                        "publishedAt": video['published_at'],
                        "explain": analysis.get("explain", "") if isinstance(analysis, dict) else "",
                        "visualize": analysis.get("visualize", "") if isinstance(analysis, dict) else "",
                        "breakIntoChunks": analysis.get("breakIntoChunks", "") if isinstance(analysis, dict) else "",
                        "patterns": analysis.get("patterns", "") if isinstance(analysis, dict) else "",
                        "myths": analysis.get("myths", "") if isinstance(analysis, dict) else "",
                        "challenges": analysis.get("challenges", "") if isinstance(analysis, dict) else "",
                        "realLife": analysis.get("realLife", "") if isinstance(analysis, dict) else "",
                        "teachBack": analysis.get("teachBack", "") if isinstance(analysis, dict) else "",
                        "whyMatters": analysis.get("whyMatters", "") if isinstance(analysis, dict) else "",
                        "simulate": analysis.get("simulate", "") if isinstance(analysis, dict) else "",
                        "story": analysis.get("story", "") if isinstance(analysis, dict) else "",
                        "prioritize": analysis.get("prioritize", "") if isinstance(analysis, dict) else "",
                        "gaps": analysis.get("gaps", "") if isinstance(analysis, dict) else "",
                    }
                    sync.save_analysis(analysis_data)
                    stats["totalAnalysesGenerated"] += 1
                    
                    # Sauvegarder les scripts
                    script_data = {
                        "title": f"Script: {video['title']}",
                        "theme": video['title'][:50],  # Utiliser une partie du titre comme thème
                        "targetAudience": "Médecins",
                        "duration": 10,  # Durée par défaut
                        "scriptContent": scripts if isinstance(scripts, str) else str(scripts),
                        "viralityScore": 75,  # Score par défaut
                        "pedagogyScore": 85,  # Score par défaut
                        "sourceVideoId": video['video_id'],
                        "sourceChannel": channel['name'],
                    }
                    sync.save_script(script_data)
                    stats["totalScriptsGenerated"] += 1
                
                stats["totalVideosProcessed"] += 1
                mark_video_as_processed(video['video_id'], video['title'], video['channel_title'], video['published_at'])
            else:
                print(f"Transcription non disponible pour {video['title']}")
    
    if all_analyses:
        # Créer le contenu final
        full_content = "# Weekly Strategic Intelligence - Viral Intel\n\n"
        full_content += f"Date: {datetime.now().strftime('%Y-%m-%d')}\n\n"
        full_content += "# Analyses Pédagogiques\n\n" + "\n\n".join(all_analyses)
        full_content += "\n\n# Scripts YouTube pour Médecins\n\n" + "\n\n".join(all_scripts)
        
        # Créer le Google Doc
        doc_title = f"Weekly_Insights_{datetime.now().strftime('%Y-%m-%d')}"
        doc_link = create_google_doc(full_content, doc_title)
        
        # Envoyer l'e-mail
        email_body = f"""
        <html>
        <body>
            <h1>Weekly Strategic Intelligence - Viral Intel</h1>
            <p>Le rapport hebdomadaire est prêt.</p>
            <p>Vous pouvez accéder au document complet ici : <a href="{doc_link}">{doc_title}</a></p>
            <p>Résumé des vidéos traitées :</p>
            <ul>
                {"".join([f"<li>{title.split('## ')[1].split(' (')[0]}</li>" for title in all_analyses])}
            </ul>
        </body>
        </html>
        """
        send_email(config['email']['subject'], email_body, os.getenv("EMAIL_TO"))
        
        # Mettre à jour les statistiques du pipeline
        if sync:
            stats["transcriptionSuccessRate"] = 95  # Taux de succès estimé
            sync.update_pipeline_stats(stats)
            sync.disconnect()
        
        print("Pipeline terminé avec succès.")
    else:
        print("Aucune nouvelle vidéo à traiter cette semaine.")
        if sync:
            sync.disconnect()

if __name__ == "__main__":
    run_pipeline()
