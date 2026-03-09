import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "viral_intel.db")

def init_db():
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS processed_videos (
            video_id TEXT PRIMARY KEY,
            title TEXT,
            channel_title TEXT,
            published_at TEXT,
            processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

def is_video_processed(video_id):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute("SELECT 1 FROM processed_videos WHERE video_id = ?", (video_id,))
    result = cursor.fetchone()
    conn.close()
    return result is not None

def mark_video_as_processed(video_id, title, channel_title, published_at):
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    cursor.execute(
        "INSERT OR IGNORE INTO processed_videos (video_id, title, channel_title, published_at) VALUES (?, ?, ?, ?)",
        (video_id, title, channel_title, published_at)
    )
    conn.commit()
    conn.close()
