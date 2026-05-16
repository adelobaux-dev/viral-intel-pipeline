"""Classify an inbound contact: BCA expert (skip script) vs. prospect surgeon."""
from .config import settings


def is_bca_expert(username: str, ig_user_id: str) -> bool:
    """True if this person is one of our own BCA experts.

    Matched against the configurable allowlist (config.yaml -> instagram ->
    bca_experts), by username or ig-scoped id. Experts get a warm human
    reply, never the sell-by-chat qualification flow.
    """
    candidates = {
        (username or "").lower().lstrip("@"),
        (ig_user_id or "").lower(),
    }
    return bool(candidates & settings.bca_experts)


def looks_like_surgeon(name: str, username: str, bio: str = "") -> bool:
    """Heuristic surgeon tag from public profile text.

    Used only for CRM tagging / prioritisation — every non-expert still
    goes through the flow regardless, so a miss here is harmless.
    """
    haystack = " ".join(
        x for x in (name or "", username or "", bio or "")
    ).lower()
    return any(kw in haystack for kw in settings.surgeon_keywords)
