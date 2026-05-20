"""Genere un apercu HTML statique des dashboards par role.

But : donner un rendu visuel concret (palette bleu profond / indigo /
violet + systeme de couleurs par tiers) AVANT le travail sur le repo
dashboard, et servir de reference d'implementation.

Usage :
    python preview_dashboard.py            # demo si pas de donnees reelles
Sortie : preview/index.html
"""

import json
import os

import social_metrics as sm

OUT_DIR = os.path.join(os.path.dirname(__file__), "preview")
OUT = os.path.join(OUT_DIR, "index.html")

TIER_HEX = {
    "bleu": "#3b82f6", "vert": "#22c55e", "jaune": "#eab308",
    "orange": "#f97316", "rouge": "#ef4444", "noir": "#0f172a",
}

SOURCE_HUMAN = {
    "source_2_leads": "CRM leads",
    "source_1_operations": "Bloc operatoire",
    "source_3_closing": "Closing",
    "source_4_acquisition": "Acquisition",
    "soins_2026_agen": "Soins Agen 2026",
}

DEMO = {
    "instagram": {
        "source": "instagram", "ok": True, "followers": 7400,
        "messages": {"conversations": 63},
        "aggregates": {
            "daily": {"views": 2100, "likes": 180, "comments": 22,
                      "interactions": 202, "posts": 1},
            "weekly": {"views": 41000, "likes": 2300, "comments": 260,
                       "interactions": 2560, "posts": 6},
            "monthly": {"views": 158000, "likes": 9100, "comments": 980,
                        "interactions": 10080, "posts": 24},
        },
        "top_reels": [
            {"id": "r1", "views": 22000, "likes": 1400, "comments": 130,
             "permalink": "#", "caption": "Reel acquisition patients"},
            {"id": "r2", "views": 15800, "likes": 980, "comments": 88,
             "permalink": "#", "caption": "Avant / apres"},
            {"id": "r3", "views": 12400, "likes": 760, "comments": 64,
             "permalink": "#", "caption": "Temoignage"},
        ],
    },
    "youtube": {"source": "youtube_channel", "ok": True,
                "title": "Dr Alexis Delobaux", "subscribers": 3100,
                "total_views": 210000, "video_count": 48},
    "closing": {"ok": True, "data": [
        {"leads_paris": 38, "calls_done": 52, "closing_rate": 21,
         "revenue_paris": 24000, "appointments_paris": 33,
         "messages_received": 71, "leads_agen": 29, "closing_rate_agen": 18,
         "revenue_agen": 14000, "appointments_agen": 22,
         "patients_paris": 47, "procedures_done": 39, "satisfaction": 86,
         "no_show_rate": 14, "team_activity_agen": 62, "response_time": 3}
    ]},
}


def _build():
    cfg = sm._load_config()
    if os.path.exists(sm.OUT_JSON):
        with open(sm.OUT_JSON) as f:
            payload = json.load(f)
    else:
        payload = {"collected_at": "DEMO", **DEMO}
        payload["kpis"] = sm._build_kpis(payload, cfg)
        members = cfg["roles"]["members"]
        payload["views_by_role"] = {
            "ceo": sm.build_role_view(payload, "ceo", members)}
        for r in members:
            payload["views_by_role"][r] = sm.build_role_view(
                payload, r, members)
    return payload


def _kpi_card(k):
    color = TIER_HEX.get(k["color"], "#64748b")
    tgt = k["target"] if k["target"] is not None else "-"
    return f"""
      <div class="card" style="border-left:6px solid {color}">
        <div class="kname">{k['name'].replace('_',' ')}</div>
        <div class="kval">{k['value']}</div>
        <div class="ktgt">objectif : {tgt} &nbsp;|&nbsp;
          <span style="color:{color};font-weight:700">{k['color'].upper()}</span>
        </div>
      </div>"""


def _reco_row(r):
    color = TIER_HEX.get(r["color"], "#64748b")
    return f"""
      <li><span class="badge" style="background:{color}">{r['severity']}</span>
      <b>{r['kpi'].replace('_',' ')}</b> — {r['action']}</li>"""


def _role_section(rid, view, active):
    kpis = "".join(_kpi_card(k) for k in view["kpis"].values()) \
        or "<p class='muted'>Aucun KPI (brancher l'app de closing).</p>"
    recos = "".join(_reco_row(r) for r in view["recommendations"]) \
        or "<li class='muted'>Tout est au vert.</li>"
    urgent = "".join(_reco_row(r) for r in view["urgent_kpis"]) \
        or "<li class='muted'>Aucune urgence cette semaine.</li>"
    return f"""
    <section class="role {'active' if active else ''}" id="{rid}">
      <h2>{view['label']}</h2>
      <h3>KPIs</h3><div class="grid">{kpis}</div>
      <h3>A corriger cette semaine / ce mois</h3><ul class="urgent">{urgent}</ul>
      <h3>Recommandations</h3><ul class="recos">{recos}</ul>
    </section>"""


def render():
    payload = _build()
    views = payload["views_by_role"]
    order = ["ceo"] + [r for r in views if r != "ceo"]
    btns = "".join(
        f'<button onclick="show(\'{r}\')">{views[r]["label"]}'
        f'{" (admin)" if r == "ceo" else ""}</button>' for r in order)
    sections = "".join(
        _role_section(r, views[r], i == 0) for i, r in enumerate(order))

    fresh = payload.get("freshness") or {}
    score = fresh.get("score", 0)
    fresh_msg = fresh.get("message", "Pas de donnees")
    by_src = " · ".join(
        f"{SOURCE_HUMAN.get(k, k)}: {v[:10]}"
        for k, v in (fresh.get("by_source") or {}).items()
    ) if fresh.get("by_source") else ""
    html = f"""<!doctype html><html lang="fr"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Dashboard CEO — apercu</title><style>
:root{{--bg:#0b1026;--bg2:#141b3c;--ind:#4f46e5;--vio:#7c3aed;--txt:#e5e9ff}}
*{{box-sizing:border-box}}body{{margin:0;font-family:Inter,system-ui,sans-serif;
background:linear-gradient(160deg,var(--bg),#1e1b4b 60%,#2e1065);color:var(--txt)}}
header{{padding:22px 28px;background:rgba(10,14,40,.7);border-bottom:1px solid #2a2f55}}
header h1{{margin:0;font-size:20px}}.sub{{color:#9aa3d4;font-size:13px;margin-top:4px}}
.fresh{{margin-top:14px}}.fresh-msg{{font-size:13px;color:#cfd5ff;margin-bottom:6px}}
.fresh-bysrc{{font-size:11px;color:#8b93c2;margin-top:6px}}
.bar{{height:8px;background:rgba(255,255,255,.07);border-radius:99px;overflow:hidden}}
.bar>span{{display:block;height:100%;background:linear-gradient(90deg,#16a34a,#22c55e);
transition:width .6s ease}}.score{{font-size:11px;color:#9aa3d4;margin-top:4px}}
nav{{display:flex;flex-wrap:wrap;gap:8px;padding:16px 28px}}
nav button{{background:linear-gradient(135deg,var(--ind),var(--vio));color:#fff;
border:0;padding:9px 16px;border-radius:9px;cursor:pointer;font-size:13px;font-weight:600}}
nav button:hover{{opacity:.88}}main{{padding:8px 28px 48px}}
.role{{display:none}}.role.active{{display:block}}
h2{{font-size:22px;margin:14px 0}}h3{{color:#aab2e8;font-size:14px;
text-transform:uppercase;letter-spacing:.5px;margin:26px 0 10px}}
.grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:12px}}
.card{{background:rgba(255,255,255,.05);border-radius:12px;padding:14px}}
.kname{{font-size:12px;color:#9aa3d4;text-transform:capitalize}}
.kval{{font-size:26px;font-weight:800;margin:4px 0}}
.ktgt{{font-size:11px;color:#8b93c2}}
ul{{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:8px}}
li{{background:rgba(255,255,255,.04);padding:10px 12px;border-radius:9px;font-size:14px}}
.urgent li{{border:1px solid rgba(239,68,68,.45)}}
.badge{{display:inline-block;color:#fff;font-size:11px;padding:2px 8px;
border-radius:999px;margin-right:8px;text-transform:uppercase}}
.muted{{color:#7d85b5}}footer{{padding:18px 28px;color:#7d85b5;font-size:12px}}
</style></head><body>
<header><h1>Dashboard CEO — apercu des dashboards par role</h1>
<div class="sub">Genere ({payload['collected_at']}). Palette bleu profond /
indigo / violet · couleurs par tiers (bleu=sur-perf → noir=critique).
Les boutons ci-dessous = acces admin a chaque dashboard.</div>
<div class="fresh">
  <div class="fresh-msg">{fresh_msg}</div>
  <div class="bar"><span style="width:{score}%"></span></div>
  <div class="score">Fraicheur des donnees : {score} / 100</div>
  <div class="fresh-bysrc">{by_src}</div>
</div></header>
<nav>{btns}</nav><main>{sections}</main>
<footer>Apercu statique de reference. L'auth email + le rendu final
vivent dans le repo du dashboard CEO ; les donnees viennent de
/api/social (filtrage par role).</footer>
<script>function show(id){{document.querySelectorAll('.role').forEach(
e=>e.classList.remove('active'));document.getElementById(id).classList.add('active');}}
</script></body></html>"""

    os.makedirs(OUT_DIR, exist_ok=True)
    with open(OUT, "w") as f:
        f.write(html)
    print(f"Apercu ecrit : {OUT}")
    return OUT


if __name__ == "__main__":
    render()
