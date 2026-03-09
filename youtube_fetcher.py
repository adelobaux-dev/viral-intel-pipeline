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
