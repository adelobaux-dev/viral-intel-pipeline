"""Endpoint serverless Vercel : metriques sociales filtrees par role.

Frontiere de securite : ce service NE fait PAS le login. Le dashboard CEO
authentifie l'utilisateur par email (sa responsabilite), puis appelle cette
API avec :
  - header  X-API-Token : doit valoir DASHBOARD_API_TOKEN (env Vercel)
  - query   email       : email de l'utilisateur deja authentifie
  - query   as_role      : (admin uniquement) consulter le dashboard d'un role

Reponses :
  200 -> vue du role (KPIs + recommandations + KPIs urgents)
  401 -> token API invalide
  403 -> email non autorise / as_role refuse (non admin)
  503 -> donnees pas encore generees (lancer social_metrics.run())
"""

import json
import os
import sys
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

import yaml

ROOT = os.path.dirname(os.path.dirname(__file__))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
CONFIG_PATH = os.path.join(ROOT, "config.yaml")
DATA_PATH = os.path.join(ROOT, "social_metrics.json")


def _load_config():
    with open(CONFIG_PATH, "r") as f:
        return yaml.safe_load(f)


def _load_data(cfg):
    """Source des metriques : fichier local sinon snapshot Google Sheets."""
    try:
        with open(DATA_PATH, "r") as f:
            return json.load(f)
    except FileNotFoundError:
        pass
    sheets_cfg = cfg.get("sheets", {})
    if sheets_cfg.get("enabled") and sheets_cfg.get("spreadsheet_id"):
        try:
            import sheets_publisher

            return sheets_publisher.read_snapshot(
                sheets_cfg["spreadsheet_id"])
        except Exception:
            return None
    return None


def _resolve_roles(email, cfg):
    """Un email peut couvrir plusieurs roles (ex: secretaire + closer)."""
    email = (email or "").strip().lower()
    roles = cfg.get("roles", {})
    if email in [e.lower() for e in roles.get("admin_emails", [])]:
        return ["ceo"]
    matched = [
        role for role, rc in roles.get("members", {}).items()
        if email in [e.lower() for e in rc.get("emails", [])]
    ]
    return matched


def _merge_views(views):
    """Fusionne plusieurs vues de role en une seule (union des KPIs)."""
    if len(views) == 1:
        return views[0]
    merged = {
        "role": "+".join(v["role"] for v in views),
        "label": " + ".join(v["label"] for v in views),
        "is_admin": False,
        "collected_at": views[0].get("collected_at"),
        "kpis": {}, "recommendations": [], "urgent_kpis": [],
    }
    seen = set()
    for v in views:
        merged["kpis"].update(v.get("kpis", {}))
        for r in v.get("recommendations", []):
            if r["kpi"] not in seen:
                seen.add(r["kpi"])
                merged["recommendations"].append(r)
        for r in v.get("urgent_kpis", []):
            merged["urgent_kpis"].append(r)
    return merged


class handler(BaseHTTPRequestHandler):
    def _send(self, code, body):
        payload = json.dumps(body, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        expected = os.getenv("DASHBOARD_API_TOKEN", "")
        provided = self.headers.get("X-API-Token", "")
        if not expected or provided != expected:
            return self._send(401, {"error": "token API invalide"})

        qs = parse_qs(urlparse(self.path).query)
        email = (qs.get("email", [""])[0])
        as_role = (qs.get("as_role", [""])[0])

        cfg = _load_config()
        matched = _resolve_roles(email, cfg)
        if not matched:
            return self._send(403, {"error": "email non autorise"})
        is_admin = matched == ["ceo"]

        if as_role:
            if not is_admin:
                return self._send(
                    403, {"error": "consultation d'un autre role reservee a l'admin"})
            matched = [as_role]
            is_admin = False

        data = _load_data(cfg)
        if data is None:
            return self._send(503, {
                "error": "metriques non generees",
                "hint": "lancer le pipeline (python social_metrics.py) "
                        "ou configurer sheets.spreadsheet_id",
            })

        views_by_role = data.get("views_by_role", {})
        views = [views_by_role[r] for r in matched if r in views_by_role]
        if not views:
            return self._send(403, {"error": f"role inconnu: {matched}"})

        view = _merge_views(views)
        if is_admin:
            view = dict(view)
            view["available_role_dashboards"] = [
                {"role": r, "label": rc.get("label", r)}
                for r, rc in cfg.get("roles", {}).get("members", {}).items()
            ]
        return self._send(200, view)
