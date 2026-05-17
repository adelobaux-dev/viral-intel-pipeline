"""Collecteur Instagram via la Graph API (compte Pro lie a une Page Facebook).

Prerequis (cote Meta, voir .env.example) :
  - IG_USER_ID        : identifiant du compte Instagram Business/Creator
  - IG_ACCESS_TOKEN   : token long-lived avec instagram_basic,
                        instagram_manage_insights et (pour les DM)
                        instagram_manage_messages + pages_show_list

Tant que l'app Meta n'est pas validee (app review), les appels echouent
proprement et renvoient des valeurs neutres : le pipeline reste fonctionnel.
"""

import os
from datetime import datetime, timedelta, timezone

import requests
from dotenv import load_dotenv

load_dotenv()

GRAPH = "https://graph.facebook.com/v21.0"
IG_USER_ID = os.getenv("IG_USER_ID", "").strip()
IG_ACCESS_TOKEN = os.getenv("IG_ACCESS_TOKEN", "").strip()


class InstagramError(RuntimeError):
    pass


def _get(path, params=None):
    if not IG_USER_ID or not IG_ACCESS_TOKEN:
        raise InstagramError("IG_USER_ID / IG_ACCESS_TOKEN manquants (.env)")
    params = dict(params or {})
    params["access_token"] = IG_ACCESS_TOKEN
    resp = requests.get(f"{GRAPH}/{path}", params=params, timeout=30)
    if resp.status_code != 200:
        raise InstagramError(f"Graph API {resp.status_code}: {resp.text[:300]}")
    return resp.json()


def _paginate(path, params, max_items):
    items, url, p = [], f"{GRAPH}/{path}", dict(params or {})
    p["access_token"] = IG_ACCESS_TOKEN
    while url and len(items) < max_items:
        resp = requests.get(url, params=p, timeout=30)
        if resp.status_code != 200:
            raise InstagramError(f"Graph API {resp.status_code}: {resp.text[:300]}")
        data = resp.json()
        items.extend(data.get("data", []))
        url = data.get("paging", {}).get("next")
        p = None  # l'URL "next" embarque deja les params
    return items[:max_items]


def get_account_summary():
    """followers_count + media_count + username."""
    data = _get(IG_USER_ID, {"fields": "username,followers_count,media_count"})
    return {
        "username": data.get("username"),
        "followers": data.get("followers_count", 0),
        "media_count": data.get("media_count", 0),
    }


def get_account_insights():
    """Vues / portee / interactions au niveau compte (28 derniers jours)."""
    out = {"reach_28d": 0, "profile_views_28d": 0, "accounts_engaged_28d": 0}
    try:
        data = _get(
            f"{IG_USER_ID}/insights",
            {
                "metric": "reach,profile_views,accounts_engaged",
                "period": "days_28",
                "metric_type": "total_value",
            },
        )
        for entry in data.get("data", []):
            name = entry.get("name")
            val = entry.get("total_value", {}).get("value", 0)
            if name == "reach":
                out["reach_28d"] = val
            elif name == "profile_views":
                out["profile_views_28d"] = val
            elif name == "accounts_engaged":
                out["accounts_engaged_28d"] = val
    except InstagramError as exc:
        out["error"] = str(exc)
    return out


def _media_views(media_id):
    """Vues d'un media (reels: 'views', sinon retombe sur 'reach')."""
    for metric in ("views", "plays", "reach"):
        try:
            data = _get(f"{media_id}/insights", {"metric": metric})
            vals = data.get("data", [])
            if vals:
                v = vals[0].get("values", [{}])
                if v:
                    return v[0].get("value", 0)
        except InstagramError:
            continue
    return 0


def get_recent_media(max_items=50):
    fields = (
        "id,caption,media_type,media_product_type,permalink,"
        "timestamp,like_count,comments_count"
    )
    return _paginate(f"{IG_USER_ID}/media", {"fields": fields}, max_items)


def get_messages_count():
    """Nombre de conversations DM (necessite instagram_manage_messages).

    Renvoie un dict avec 'conversations' ou 'error' si non autorise.
    """
    try:
        data = _get(f"{IG_USER_ID}/conversations", {"platform": "instagram"})
        return {"conversations": len(data.get("data", []))}
    except InstagramError as exc:
        return {"conversations": 0, "error": str(exc)}


def _within(ts_iso, days):
    try:
        ts = datetime.fromisoformat(ts_iso.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return False
    return ts >= datetime.now(timezone.utc) - timedelta(days=days)


def collect(top_reels_count=5, windows=None):
    """Retourne un snapshot complet des metriques Instagram."""
    windows = windows or {"daily": 1, "weekly": 7, "monthly": 30}
    snapshot = {
        "source": "instagram",
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "ok": True,
    }

    try:
        summary = get_account_summary()
        snapshot.update(summary)
    except InstagramError as exc:
        return {**snapshot, "ok": False, "error": str(exc)}

    snapshot["account_insights"] = get_account_insights()
    snapshot["messages"] = get_messages_count()

    try:
        media = get_recent_media(max_items=80)
    except InstagramError as exc:
        media = []
        snapshot["media_error"] = str(exc)

    reels = [
        m for m in media
        if m.get("media_product_type") == "REELS"
        or m.get("media_type") == "VIDEO"
    ]
    for m in reels:
        m["views"] = _media_views(m["id"])

    top_reels = sorted(reels, key=lambda m: m.get("views", 0), reverse=True)[
        :top_reels_count
    ]
    snapshot["top_reels"] = [
        {
            "id": m["id"],
            "permalink": m.get("permalink"),
            "caption": (m.get("caption") or "")[:120],
            "views": m.get("views", 0),
            "likes": m.get("like_count", 0),
            "comments": m.get("comments_count", 0),
            "timestamp": m.get("timestamp"),
        }
        for m in top_reels
    ]

    agg = {}
    for label, days in windows.items():
        w_media = [m for m in media if _within(m.get("timestamp", ""), days)]
        w_reels = [m for m in reels if _within(m.get("timestamp", ""), days)]
        likes = sum(m.get("like_count", 0) for m in w_media)
        comments = sum(m.get("comments_count", 0) for m in w_media)
        views = sum(m.get("views", 0) for m in w_reels)
        agg[label] = {
            "posts": len(w_media),
            "views": views,
            "likes": likes,
            "comments": comments,
            "interactions": likes + comments,
        }
    snapshot["aggregates"] = agg
    return snapshot


if __name__ == "__main__":
    import json

    print(json.dumps(collect(), indent=2, ensure_ascii=False))
