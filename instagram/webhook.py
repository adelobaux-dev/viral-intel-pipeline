"""Flask webhook that receives Instagram messaging events from Meta.

Security:
  * GET  /webhook  -> Meta verification handshake (verify token)
  * POST /webhook  -> events, rejected unless the X-Hub-Signature-256 HMAC
                      computed with the app secret matches the raw body.

It only ever reacts to *inbound* user messages and replies within the
24h messaging window, so it is fully within Meta platform policy.
"""
import hashlib
import hmac
import logging

from flask import Flask, request

from . import crm, graph_api
from .config import settings
from .sell_by_chat import handle_message

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("instagram.webhook")

app = Flask(__name__)


def _valid_signature(raw_body: bytes) -> bool:
    header = request.headers.get("X-Hub-Signature-256", "")
    if not header.startswith("sha256=") or not settings.app_secret:
        return False
    expected = hmac.new(
        settings.app_secret.encode(), raw_body, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, header.split("=", 1)[1])


@app.get("/webhook")
def verify():
    mode = request.args.get("hub.mode")
    token = request.args.get("hub.verify_token")
    challenge = request.args.get("hub.challenge")
    if mode == "subscribe" and token == settings.verify_token:
        log.info("Webhook verified by Meta.")
        return challenge or "", 200
    return "Verification failed", 403


@app.get("/health")
def health():
    ok, missing = settings.is_configured()
    return {"ok": ok, "missing_env": missing}, (200 if ok else 503)


def _process_messaging_event(event: dict):
    msg = event.get("message") or {}
    # Skip echoes of our own outbound messages and read/delivery receipts.
    if msg.get("is_echo") or not event.get("message"):
        return
    sender_id = (event.get("sender") or {}).get("id")
    if not sender_id:
        return

    text = msg.get("text")
    if not text:
        # Sticker / media / story share with no caption — nudge back to text.
        text = "(sent an attachment)"

    lead = crm.get_lead(sender_id)
    if lead and lead.get("name"):
        name, username = lead["name"], lead.get("username") or ""
    else:
        profile = graph_api.get_profile(sender_id)
        name = profile.get("name", "")
        username = profile.get("username", "")

    try:
        replies = handle_message(sender_id, username, name, text)
    except Exception:  # one bad conversation must not 500 the webhook
        log.exception("handle_message failed for %s", sender_id)
        return

    for reply in replies:
        graph_api.send_text(sender_id, reply)


@app.post("/webhook")
def receive():
    raw = request.get_data()
    if not _valid_signature(raw):
        log.warning("Rejected webhook with bad signature.")
        return "Invalid signature", 403

    data = request.get_json(silent=True) or {}
    if data.get("object") != "instagram":
        return "ignored", 200

    for entry in data.get("entry", []):
        for event in entry.get("messaging", []):
            _process_messaging_event(event)

    # Always 200 quickly so Meta does not retry/disable the subscription.
    return "EVENT_RECEIVED", 200


def create_app():
    crm.init_crm()
    return app
