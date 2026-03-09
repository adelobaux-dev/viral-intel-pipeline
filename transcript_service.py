from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api.formatters import TextFormatter

def get_transcript(video_id):
    try:
        # Essayer de récupérer la transcription en français d'abord, puis en anglais
        transcript_list = YouTubeTranscriptApi().list(video_id)
        
        try:
            transcript = transcript_list.find_transcript(['fr'])
        except:
            try:
                transcript = transcript_list.find_transcript(['en'])
            except:
                # Si aucune transcription n'est trouvée, essayer de traduire une transcription existante
                transcript = transcript_list.find_generated_transcript(['en']).translate('fr')
        
        formatter = TextFormatter()
        return formatter.format_transcript(transcript.fetch())
    except Exception as e:
        print(f"Erreur lors de la récupération de la transcription pour {video_id}: {e}")
        return None
