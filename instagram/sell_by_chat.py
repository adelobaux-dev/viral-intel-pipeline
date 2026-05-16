"""Sell-by-chat conversation engine.

Implements the BCA discovery script as a deterministic state machine driven
one step per inbound message. Each non-expert prospect is walked through:

  OPENER -> INTENT -> CURRENT STATE -> DESIRED STATE -> ROADBLOCKS ->
  AMPLIFY PAIN -> MAP TO SOLUTION -> TEST COMMITMENT -> OFFER + CONTACT
  CAPTURE -> HUMAN HANDOFF

The goal of the flow is to qualify the surgeon and capture their contact
details so a human closer can lock them in for the event.
"""
import random
import re

from . import crm
from .config import settings
from .segmentation import is_bca_expert, looks_like_surgeon

_EMAIL_RE = re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}")
# Loose international phone matcher (>=8 digits, optional +, spaces, dashes).
_PHONE_RE = re.compile(r"(?<!\w)(\+?\d[\d\s().\-]{7,}\d)(?!\w)")

_LOW_INTENT = (
    "video", "just watch", "just here for", "not interested", "no thanks",
    "free content", "browsing", "just looking", "nothing", "no business",
)

_ACK = [
    "Awesome, thanks for sharing.",
    "Nice, that's really exciting.",
    "Totally get it, that's a common challenge.",
    "Great to hear — let's dig into that.",
    "Got it, that makes a lot of sense.",
]


def _ack():
    return random.choice(_ACK)


def _title(name: str) -> str:
    """Render a 'Dr Lastname' style address from a profile name."""
    if not name:
        return "Doctor"
    parts = [p for p in re.split(r"\s+", name.strip()) if p]
    if not parts:
        return "Doctor"
    last = parts[-1].strip(".,")
    return f"Dr {last}"


def _extract_contact(text: str) -> dict:
    found = {}
    m = _EMAIL_RE.search(text)
    if m:
        found["email"] = m.group(0)
    m = _PHONE_RE.search(text)
    if m:
        digits = re.sub(r"\D", "", m.group(1))
        if 8 <= len(digits) <= 15:
            found["phone"] = m.group(1).strip()
    return found


def _is_low_intent(text: str) -> bool:
    t = text.lower()
    return any(k in t for k in _LOW_INTENT)


# --- Per-stage handlers: return (list_of_replies, fields_to_update) ----------

def _stage_new(lead, text):
    name = lead.get("name") or ""
    opener = (
        f"Hi {_title(name)}! 👋\n\n"
        f"Just saw you reached out — glad to have you connected with "
        f"{settings.brand_name}.\n\n"
        "Quick question: are you here mainly for the videos, or are you "
        "looking to grow your practice?"
    )
    return [opener], {"stage": "AWAITING_INTENT"}


def _stage_intent(lead, text):
    if _is_low_intent(text):
        return (
            [
                "Totally cool — enjoy the content! If you ever decide you "
                "want to scale the practice side, just message me here and "
                "I'll personally help. 🙌"
            ],
            {"stage": "LOW_INTENT", "status": "nurture"},
        )
    msg = (
        f"{_ack()} Tell me a bit more about your practice — what stage are "
        "you at in terms of revenue and team size right now?"
    )
    return [msg], {"stage": "CURRENT_STATE"}


def _stage_current(lead, text):
    msg = (
        "Got it. Where do you want the practice to be 12 months from now — "
        "revenue, the kind of cases you take, the lifestyle you want?"
    )
    return [msg], {"stage": "DESIRED_STATE", "revenue_stage": text[:500]}


def _stage_desired(lead, text):
    msg = (
        "Love that goal. What are the top 2–3 things getting in the way of "
        "reaching it right now?"
    )
    return [msg], {"stage": "ROADBLOCKS", "desired_state": text[:500]}


def _stage_roadblocks(lead, text):
    msg = (
        f"{_ack()} If nothing changes in the next 6–12 months, what does "
        "that cost you — financially, and in time/energy?"
    )
    return [msg], {"stage": "AMPLIFY", "roadblocks": text[:500],
                   "top_challenge": text[:300]}


def _stage_amplify(lead, text):
    msg = (
        "That sounds like it's really costing you. Here's the thing — these "
        "are the exact roadblocks we solve with surgeons inside BCA, without "
        "more ad spend or longer hours.\n\n"
        "If you could fix that quickly, would that change the game for you?"
    )
    return [msg], {"stage": "MAP_SOLUTION"}


def _stage_map(lead, text):
    msg = (
        "On a scale of 1–10, how important is it for you to solve this "
        "*now* rather than 6 months from now?"
    )
    return [msg], {"stage": "TEST_COMMITMENT"}


def _stage_commitment(lead, text):
    score = None
    m = re.search(r"\b(10|[1-9])\b", text)
    if m:
        score = int(m.group(1))
    offer = [
        "Perfect — sounds like this is a priority. 🙌",
        (
            f"Here's what I've got for surgeons like you: a seat at "
            f"{settings.event_name}, where we walk through the exact "
            "frameworks to attract high-value body-contouring patients and "
            "scale without burning out."
        ),
        (
            "Best way to lock your spot and get the details: what's the best "
            "email and mobile number to send your invite to?"
        ),
    ]
    return offer, {"stage": "PRESENT_OFFER",
                   "commitment": score if score is not None else None}


def _stage_offer(lead, text, contact):
    if contact.get("email") or contact.get("phone"):
        return (
            [
                "Perfect — got it. ✅ I'm passing you straight to our team "
                f"to confirm your spot at {settings.event_name}. Talk soon, "
                f"{_title(lead.get('name'))}!"
            ],
            {"stage": "CLOSED_WON", "status": "won"},
        )
    return (
        [
            "No worries! Just drop the best email (and mobile if you can) "
            "right here and I'll get your invite over."
        ],
        {"stage": "AWAITING_CONTACT"},
    )


def _stage_await_contact(lead, text, contact):
    if contact.get("email") or contact.get("phone"):
        status = "won"
        reply = (
            "Got it — thank you! ✅ Handing you to our team now to confirm "
            f"your seat at {settings.event_name}."
        )
    else:
        status = "qualified"
        reply = (
            "All good — I'll have someone from our team follow up with you "
            "right here in your DMs to get you the event details. 🙌"
        )
    return [reply], {"stage": "HANDOFF", "status": status}


_TERMINAL = {"EXPERT", "LOW_INTENT", "CLOSED_WON", "HANDOFF"}

_HANDLERS = {
    "NEW": _stage_new,
    "AWAITING_INTENT": _stage_intent,
    "CURRENT_STATE": _stage_current,
    "DESIRED_STATE": _stage_desired,
    "ROADBLOCKS": _stage_roadblocks,
    "AMPLIFY": _stage_amplify,
    "MAP_SOLUTION": _stage_map,
    "TEST_COMMITMENT": _stage_commitment,
}


def handle_message(ig_user_id: str, username: str, name: str,
                   text: str) -> list:
    """Advance the conversation one step. Returns the list of reply texts.

    Pure orchestration: persistence happens here, message sending is the
    caller's responsibility (keeps this unit testable without the network).
    """
    crm.log_message(ig_user_id, "in", text)

    lead = crm.get_lead(ig_user_id)
    if lead is None:
        expert = is_bca_expert(username, ig_user_id)
        surgeon = looks_like_surgeon(name, username)
        lead = crm.create_lead(
            ig_user_id, username, name, expert, surgeon
        )
        if expert:
            crm.update_lead(ig_user_id, stage="EXPERT", status="expert")
            reply = (
                f"Hey {name or 'team'}! 🙌 Great to hear from you — "
                "I'll make sure the right person on our side picks this up."
            )
            crm.log_message(ig_user_id, "out", reply)
            return [reply]

    # Opportunistic contact capture on every single inbound message.
    contact = _extract_contact(text)
    if contact:
        crm.update_lead(ig_user_id, **contact)
        lead = crm.get_lead(ig_user_id)

    stage = lead["stage"]

    if stage in _TERMINAL:
        # Conversation already concluded — stay warm, don't re-loop.
        reply = (
            "Thanks for the message! Our team has your details and will "
            "follow up here shortly. 🙌"
        )
        crm.log_message(ig_user_id, "out", reply)
        return [reply]

    if stage in ("PRESENT_OFFER", "AWAITING_CONTACT"):
        if stage == "PRESENT_OFFER":
            replies, updates = _stage_offer(lead, text, contact)
        else:
            replies, updates = _stage_await_contact(lead, text, contact)
    else:
        handler = _HANDLERS.get(stage, _stage_new)
        replies, updates = handler(lead, text)

    if updates:
        clean = {k: v for k, v in updates.items() if v is not None}
        if clean:
            crm.update_lead(ig_user_id, **clean)

    for r in replies:
        crm.log_message(ig_user_id, "out", r)
    return replies
