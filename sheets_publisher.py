"""Publie les metriques sociales dans un Google Sheet.

Le dashboard CEO lit deja 6 Google Sheets publies en CSV : ce module
appende une ligne horodatee dans un onglet dedie pour que le 7e flux
(reseaux sociaux) suive le meme modele de consommation.

Auth : compte de service Google. Definir GOOGLE_SERVICE_ACCOUNT_JSON
(.env) = chemin du fichier JSON OU contenu JSON brut. Partager le
spreadsheet avec l'email du compte de service.
"""

import json
import os

from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

HEADER = [
    "collected_at", "ig_followers", "ig_views_weekly",
    "ig_interactions_weekly", "ig_messages", "yt_subscribers",
    "yt_total_views", "urgent_kpis_count",
]


def _credentials():
    raw = os.getenv("GOOGLE_SERVICE_ACCOUNT_JSON", "").strip()
    if not raw:
        raise RuntimeError("GOOGLE_SERVICE_ACCOUNT_JSON manquant (.env)")
    if os.path.isfile(raw):
        return Credentials.from_service_account_file(raw, scopes=SCOPES)
    return Credentials.from_service_account_info(json.loads(raw), scopes=SCOPES)


def _row(payload):
    ig = payload.get("instagram") or {}
    weekly = ig.get("aggregates", {}).get("weekly", {})
    yt = payload.get("youtube") or {}
    ceo_view = payload.get("views_by_role", {}).get("ceo", {})
    return [
        payload.get("collected_at", ""),
        ig.get("followers", 0),
        weekly.get("views", 0),
        weekly.get("interactions", 0),
        ig.get("messages", {}).get("conversations", 0),
        yt.get("subscribers", 0),
        yt.get("total_views", 0),
        len(ceo_view.get("urgent_kpis", [])),
    ]


def publish(payload, sheets_cfg):
    spreadsheet_id = sheets_cfg.get("spreadsheet_id")
    worksheet = sheets_cfg.get("worksheet", "social_metrics")
    if not spreadsheet_id:
        raise RuntimeError("sheets.spreadsheet_id non configure")

    service = build("sheets", "v4", credentials=_credentials())
    sheet = service.spreadsheets()

    existing = sheet.values().get(
        spreadsheetId=spreadsheet_id, range=f"{worksheet}!A1:H1"
    ).execute()
    if not existing.get("values"):
        sheet.values().update(
            spreadsheetId=spreadsheet_id,
            range=f"{worksheet}!A1",
            valueInputOption="RAW",
            body={"values": [HEADER]},
        ).execute()

    sheet.values().append(
        spreadsheetId=spreadsheet_id,
        range=f"{worksheet}!A1",
        valueInputOption="RAW",
        insertDataOption="INSERT_ROWS",
        body={"values": [_row(payload)]},
    ).execute()
    print(f"Ligne ajoutee au Sheet {spreadsheet_id} ({worksheet}).")

    _write_snapshot(sheet, spreadsheet_id, payload)


SNAP_TAB = "_snapshot"


def _ensure_tab(sheet, spreadsheet_id, title):
    meta = sheet.get(spreadsheetId=spreadsheet_id).execute()
    titles = [s["properties"]["title"] for s in meta.get("sheets", [])]
    if title in titles:
        return
    sheet.batchUpdate(
        spreadsheetId=spreadsheet_id,
        body={"requests": [{"addSheet": {"properties": {"title": title}}}]},
    ).execute()


def _write_snapshot(sheet, spreadsheet_id, payload):
    """Stocke le payload complet (JSON) en cellule A1 d'un onglet dedie.

    Permet a l'API serverless de servir les vues par role sans dependre
    d'un fichier local.
    """
    _ensure_tab(sheet, spreadsheet_id, SNAP_TAB)
    blob = json.dumps(payload, ensure_ascii=False)
    sheet.values().update(
        spreadsheetId=spreadsheet_id,
        range=f"{SNAP_TAB}!A1",
        valueInputOption="RAW",
        body={"values": [[blob]]},
    ).execute()
    print(f"Snapshot JSON ecrit dans l'onglet {SNAP_TAB}.")


def read_snapshot(spreadsheet_id):
    """Relit le dernier snapshot JSON (utilise par l'API serverless)."""
    service = build("sheets", "v4", credentials=_credentials())
    resp = service.spreadsheets().values().get(
        spreadsheetId=spreadsheet_id, range=f"{SNAP_TAB}!A1"
    ).execute()
    values = resp.get("values")
    if not values or not values[0]:
        return None
    return json.loads(values[0][0])
