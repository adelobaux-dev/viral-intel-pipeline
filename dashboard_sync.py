import json
from urllib.parse import urlparse

import mysql.connector
from mysql.connector import Error as MySQLError


class DashboardSync:
    def __init__(self, db_url):
        self.db_url = db_url
        self.conn = None

    def _parse_url(self):
        parsed = urlparse(self.db_url)
        if parsed.scheme not in ("mysql", "mysql+pymysql", "mysql+mysqlconnector"):
            raise ValueError(f"Unsupported DATABASE_URL scheme: {parsed.scheme}")
        return {
            "host": parsed.hostname,
            "port": parsed.port or 3306,
            "user": parsed.username,
            "password": parsed.password or "",
            "database": parsed.path.lstrip("/"),
        }

    def connect(self):
        try:
            self.conn = mysql.connector.connect(**self._parse_url(), autocommit=True)
            self._ensure_schema()
            return True
        except (MySQLError, ValueError) as exc:
            print(f"DashboardSync: échec de connexion ({exc})")
            self.conn = None
            return False

    def disconnect(self):
        if self.conn and self.conn.is_connected():
            self.conn.close()
        self.conn = None

    def _ensure_schema(self):
        cursor = self.conn.cursor()
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS analyses (
                id INT AUTO_INCREMENT PRIMARY KEY,
                videoId VARCHAR(64) UNIQUE,
                title VARCHAR(512),
                channel VARCHAR(256),
                publishedAt VARCHAR(64),
                explain_text TEXT,
                visualize TEXT,
                breakIntoChunks TEXT,
                patterns TEXT,
                myths TEXT,
                challenges TEXT,
                realLife TEXT,
                teachBack TEXT,
                whyMatters TEXT,
                simulate TEXT,
                story TEXT,
                prioritize TEXT,
                gaps TEXT,
                rawAnalysis MEDIUMTEXT,
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS scripts (
                id INT AUTO_INCREMENT PRIMARY KEY,
                title VARCHAR(512),
                theme VARCHAR(256),
                targetAudience VARCHAR(128),
                duration INT,
                scriptContent MEDIUMTEXT,
                viralityScore INT,
                pedagogyScore INT,
                sourceVideoId VARCHAR(64),
                sourceChannel VARCHAR(256),
                createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS pipeline_stats (
                id INT AUTO_INCREMENT PRIMARY KEY,
                totalVideosProcessed INT,
                totalAnalysesGenerated INT,
                totalScriptsGenerated INT,
                transcriptionSuccessRate INT,
                runAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        cursor.close()

    def save_analysis(self, data):
        if not self.conn:
            return False
        raw = data.get("rawAnalysis")
        if raw is None and not isinstance(data, dict):
            raw = str(data)
        cursor = self.conn.cursor()
        cursor.execute(
            """
            INSERT INTO analyses (
                videoId, title, channel, publishedAt,
                explain_text, visualize, breakIntoChunks, patterns,
                myths, challenges, realLife, teachBack,
                whyMatters, simulate, story, prioritize, gaps, rawAnalysis
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                title=VALUES(title),
                channel=VALUES(channel),
                publishedAt=VALUES(publishedAt),
                explain_text=VALUES(explain_text),
                visualize=VALUES(visualize),
                breakIntoChunks=VALUES(breakIntoChunks),
                patterns=VALUES(patterns),
                myths=VALUES(myths),
                challenges=VALUES(challenges),
                realLife=VALUES(realLife),
                teachBack=VALUES(teachBack),
                whyMatters=VALUES(whyMatters),
                simulate=VALUES(simulate),
                story=VALUES(story),
                prioritize=VALUES(prioritize),
                gaps=VALUES(gaps),
                rawAnalysis=VALUES(rawAnalysis)
            """,
            (
                data.get("videoId"),
                data.get("title"),
                data.get("channel"),
                data.get("publishedAt"),
                data.get("explain", ""),
                data.get("visualize", ""),
                data.get("breakIntoChunks", ""),
                data.get("patterns", ""),
                data.get("myths", ""),
                data.get("challenges", ""),
                data.get("realLife", ""),
                data.get("teachBack", ""),
                data.get("whyMatters", ""),
                data.get("simulate", ""),
                data.get("story", ""),
                data.get("prioritize", ""),
                data.get("gaps", ""),
                raw or json.dumps(data, ensure_ascii=False),
            ),
        )
        cursor.close()
        return True

    def save_script(self, data):
        if not self.conn:
            return False
        cursor = self.conn.cursor()
        cursor.execute(
            """
            INSERT INTO scripts (
                title, theme, targetAudience, duration, scriptContent,
                viralityScore, pedagogyScore, sourceVideoId, sourceChannel
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                data.get("title"),
                data.get("theme"),
                data.get("targetAudience"),
                data.get("duration"),
                data.get("scriptContent"),
                data.get("viralityScore"),
                data.get("pedagogyScore"),
                data.get("sourceVideoId"),
                data.get("sourceChannel"),
            ),
        )
        cursor.close()
        return True

    def update_pipeline_stats(self, stats):
        if not self.conn:
            return False
        cursor = self.conn.cursor()
        cursor.execute(
            """
            INSERT INTO pipeline_stats (
                totalVideosProcessed, totalAnalysesGenerated,
                totalScriptsGenerated, transcriptionSuccessRate
            ) VALUES (%s, %s, %s, %s)
            """,
            (
                stats.get("totalVideosProcessed", 0),
                stats.get("totalAnalysesGenerated", 0),
                stats.get("totalScriptsGenerated", 0),
                stats.get("transcriptionSuccessRate", 0),
            ),
        )
        cursor.close()
        return True
