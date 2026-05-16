import os
import yaml

_CONFIG_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config.yaml")


def _load_yaml():
    with open(_CONFIG_PATH, "r") as f:
        return yaml.safe_load(f) or {}


class Settings:
    """Runtime settings for the Instagram bot.

    Secrets come from environment variables; tunables come from the
    `instagram:` block of config.yaml.
    """

    def __init__(self):
        ig = (_load_yaml().get("instagram") or {})

        # --- Secrets (env only, never committed) ---
        self.verify_token = os.getenv("IG_VERIFY_TOKEN", "")
        self.app_secret = os.getenv("IG_APP_SECRET", "")
        self.access_token = os.getenv("IG_PAGE_ACCESS_TOKEN", "")
        # IG-scoped business account id that owns the inbox.
        self.business_id = os.getenv("IG_BUSINESS_ID", "")

        # --- Tunables (config.yaml) ---
        self.graph_api_version = ig.get("graph_api_version", "v21.0")
        self.brand_name = ig.get("brand_name", "the Body Contouring Academy")
        # Handles OR ig-scoped ids of BCA experts to exclude from the script.
        self.bca_experts = {
            str(x).lower().lstrip("@") for x in (ig.get("bca_experts") or [])
        }
        self.surgeon_keywords = [
            str(k).lower() for k in (ig.get("surgeon_keywords") or [
                "md", "m.d", "plastic surgeon", "cosmetic surgeon",
                "board certified", "facs", "frcs", "dr.", "surgeon",
                "aesthetic surgeon", "bodysculpt", "body contouring",
            ])
        ]
        self.human_handoff_after_offer = bool(
            ig.get("human_handoff_after_offer", True)
        )
        # Event we are closing surgeons for (used in the offer message).
        self.event_name = ig.get("event_name", "our next BCA live event")

    def is_configured(self):
        missing = [
            name for name, val in (
                ("IG_VERIFY_TOKEN", self.verify_token),
                ("IG_APP_SECRET", self.app_secret),
                ("IG_PAGE_ACCESS_TOKEN", self.access_token),
                ("IG_BUSINESS_ID", self.business_id),
            ) if not val
        ]
        return (len(missing) == 0, missing)


settings = Settings()
