"""Thin client over the official Meta Graph API (Instagram messaging).

Only two operations are used, both fully within Meta policy:
  * send a text message in reply to an inbound conversation (24h window)
  * fetch the sender's public profile name for personalisation

No follower enumeration, no proactive/cold sends.
"""
import logging

import requests

from .config import settings

log = logging.getLogger("instagram.graph_api")

_TIMEOUT = 15


def _base():
    return f"https://graph.facebook.com/{settings.graph_api_version}"


def send_text(recipient_id: str, text: str) -> bool:
    """Reply to a user inside the active messaging window.

    Returns True on success. Failures are logged, not raised, so a single
    bad send never tears down the webhook handler.
    """
    url = f"{_base()}/{settings.business_id}/messages"
    payload = {
        "recipient": {"id": recipient_id},
        "message": {"text": text[:980]},  # IG hard limit is 1000 chars
        "messaging_type": "RESPONSE",
    }
    try:
        r = requests.post(
            url,
            params={"access_token": settings.access_token},
            json=payload,
            timeout=_TIMEOUT,
        )
        if r.status_code >= 400:
            log.error("send_text failed %s: %s", r.status_code, r.text[:500])
            return False
        return True
    except requests.RequestException as e:
        log.error("send_text network error: %s", e)
        return False


def get_profile(ig_user_id: str) -> dict:
    """Best-effort fetch of the sender's name/username.

    Requires the instagram_manage_messages permission; if it is not granted
    yet the bot still works, it just personalises with a generic title.
    """
    url = f"{_base()}/{ig_user_id}"
    try:
        r = requests.get(
            url,
            params={
                "fields": "name,username",
                "access_token": settings.access_token,
            },
            timeout=_TIMEOUT,
        )
        if r.status_code >= 400:
            log.warning("get_profile %s: %s", r.status_code, r.text[:300])
            return {}
        return r.json()
    except requests.RequestException as e:
        log.warning("get_profile network error: %s", e)
        return {}
