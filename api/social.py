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
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

import yaml

ROOT = os.path.dirname(os.path.dirname(__file__))
CONFIG_PATH = os.path.join(ROOT, "config.yaml")
DATA_PATH = os.path.join(ROOT, "social_metrics.json")


def _load_config():
    with open(CONFIG_PATH, "r") as f:
        return yaml.safe_load(f)


def _resolve_role(email, cfg):
    email = (email or "").strip().lower()
    roles = cfg.get("roles", {})
    if email in [e.lower() for e in roles.get("admin_emails", [])]:
        return "ceo"
    for role, rc in roles.get("members", {}).items():
        if email in [e.lower() for e in rc.get("emails", [])]:
            return role
    return None


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
        role = _resolve_role(email, cfg)
        if role is None:
            return self._send(403, {"error": "email non autorise"})

        if as_role:
            if role != "ceo":
                return self._send(
                    403, {"error": "consultation d'un autre role reservee a l'admin"})
            role = as_role

        try:
            with open(DATA_PATH, "r") as f:
                data = json.load(f)
        except FileNotFoundError:
            return self._send(503, {
                "error": "metriques non generees",
                "hint": "lancer python social_metrics.py",
            })

        view = data.get("views_by_role", {}).get(role)
        if view is None:
            return self._send(403, {"error": f"role inconnu: {role}"})

        if role == "ceo":
            view = dict(view)
            view["available_role_dashboards"] = [
                {"role": r, "label": rc.get("label", r)}
                for r, rc in cfg.get("roles", {}).get("members", {}).items()
            ]
        return self._send(200, view)
