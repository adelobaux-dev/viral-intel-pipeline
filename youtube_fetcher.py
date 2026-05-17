import os
import requests
from googleapiclient.discovery import build
from dotenv import load_dotenv

load_dotenv()

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")

def get_latest_videos(channel_id, max_results=3):
    youtube = build('youtube', 'v3', developerKey=YOUTUBE_API_KEY)
    
    # Récupérer l'ID de la playlist "uploads" de la chaîne
    channel_response = youtube.channels().list(
        part='contentDetails',
        id=channel_id
    ).execute()
    
    if not channel_response.get('items'):
        return []
        
    uploads_playlist_id = channel_response['items'][0]['contentDetails']['relatedPlaylists']['uploads']
    
    # Récupérer les dernières vidéos de cette playlist
    playlist_response = youtube.playlistItems().list(
        part='snippet',
        playlistId=uploads_playlist_id,
        maxResults=max_results
    ).execute()
    
    videos = []
    for item in playlist_response.get('items', []):
        snippet = item['snippet']
        videos.append({
            'video_id': snippet['resourceId']['videoId'],
            'title': snippet['title'],
            'channel_title': snippet['channelTitle'],
            'published_at': snippet['publishedAt'],
            'description': snippet.get('description', '')
        })
        
    return videos

def get_channel_stats(channel_id=None, handle=None):
    """Stats publiques de TA chaine (abonnes, vues totales, nb videos).

    Renseigner channel_id OU handle (ex: "@DrAlexisDelobaux").
    """
    if not YOUTUBE_API_KEY:
        return {"source": "youtube_channel", "ok": False,
                "error": "YOUTUBE_API_KEY manquant"}

    youtube = build('youtube', 'v3', developerKey=YOUTUBE_API_KEY)
    params = {"part": "snippet,statistics"}
    if channel_id:
        params["id"] = channel_id
    elif handle:
        params["forHandle"] = handle.lstrip("@")
    else:
        return {"source": "youtube_channel", "ok": False,
                "error": "channel_id ou handle requis"}

    try:
        resp = youtube.channels().list(**params).execute()
    except Exception as exc:  # googleapiclient HttpError, reseau, etc.
        return {"source": "youtube_channel", "ok": False, "error": str(exc)}

    items = resp.get("items", [])
    if not items:
        return {"source": "youtube_channel", "ok": False,
                "error": "chaine introuvable"}

    item = items[0]
    stats = item.get("statistics", {})
    return {
        "source": "youtube_channel",
        "ok": True,
        "channel_id": item["id"],
        "title": item["snippet"]["title"],
        "subscribers": int(stats.get("subscriberCount", 0)),
        "total_views": int(stats.get("viewCount", 0)),
        "video_count": int(stats.get("videoCount", 0)),
    }


def search_channel_id(channel_name):
    youtube = build('youtube', 'v3', developerKey=YOUTUBE_API_KEY)
    search_response = youtube.search().list(
        q=channel_name,
        type='channel',
        part='id,snippet',
        maxResults=1
    ).execute()
    
    if search_response.get('items'):
        return search_response['items'][0]['id']['channelId']
    return None
