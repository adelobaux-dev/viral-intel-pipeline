"""Couche data du dashboard CEO.

Collecte Instagram + YouTube (+ app de closing), agrege les KPIs,
applique le systeme de couleurs par tiers et genere des recommandations
et "KPIs urgents a corriger" par role. Sortie : JSON + (option) Google Sheets.

Systeme de couleurs (cf. palette du dashboard) :
  bleu   = sur-performance
  vert   = a l'objectif
  jaune / orange / rouge / noir = sous l'objectif (de plus en plus critique)
"""

import io
import json
import os
import sqlite3
from datetime import datetime, timezone

import requests
import yaml
from dotenv import load_dotenv

import instagram_fetcher
import youtube_fetcher

load_dotenv()

CONFIG_PATH = os.path.join(os.path.dirname(__file__), "config.yaml")
SNAP_DB = os.path.join(os.path.dirname(__file__), "social_metrics.db")
OUT_JSON = os.path.join(os.path.dirname(__file__), "social_metrics.json")

# Objectifs par defaut (surchageables via config.yaml > targets).
DEFAULT_TARGETS = {
    "followers": 10000,
    "views_weekly": 50000,
    "interactions_weekly": 2000,
    "messages_received": 100,
    "instagram_replies": 90,
    "youtube_subscribers": 5000,
    "appointments_paris": 40,
    "appointments_agen": 30,
    "response_time": 2,          # heures, plus bas = mieux
    "leads_paris": 50,
    "leads_agen": 40,
    "calls_done": 60,
    "closing_rate": 25,          # %
    "closing_rate_agen": 25,
    "revenue_paris": 30000,      # CA signe mensuel closing (source_3)
    "revenue_agen": 150000,       # CA realise annuel Agen (source_1)
    "revenue_realized_paris": 2000000,  # CA realise annuel Paris (source_1)
    "patients_paris": 200,
    "procedures_done": 300,
    "satisfaction": 90,          # %
    "no_show_rate": 10,          # %, plus bas = mieux
    "team_activity_agen": 80,    # %
}

LOWER_IS_BETTER = {"response_time", "no_show_rate"}


def _load_config():
    with open(CONFIG_PATH, "r") as f:
        return yaml.safe_load(f)


def tier(value, target, lower_is_better=False):
    """Retourne (couleur, ratio) selon l'ecart a l'objectif."""
    if target in (None, 0):
        return "vert", 1.0
    ratio = value / target
    if lower_is_better:
        ratio = target / value if value else 2.0
    if ratio >= 1.15:
        return "bleu", round(ratio, 2)
    if ratio >= 1.0:
        return "vert", round(ratio, 2)
    if ratio >= 0.8:
        return "jaune", round(ratio, 2)
    if ratio >= 0.6:
        return "orange", round(ratio, 2)
    if ratio >= 0.3:
        return "rouge", round(ratio, 2)
    return "noir", round(ratio, 2)


def _persist_snapshot(payload):
    conn = sqlite3.connect(SNAP_DB)
    conn.execute(
        "CREATE TABLE IF NOT EXISTS snapshots "
        "(ts TEXT PRIMARY KEY, json TEXT)"
    )
    conn.execute(
        "INSERT OR REPLACE INTO snapshots VALUES (?, ?)",
        (payload["collected_at"], json.dumps(payload, ensure_ascii=False)),
    )
    conn.commit()
    conn.close()


def _csv_export_url(sheet_id, gid="0"):
    return (f"https://docs.google.com/spreadsheets/d/{sheet_id}"
            f"/export?format=csv&gid={gid}")


def _fetch_closing(cfg):
    import csv

    cl = cfg.get("closing_app", {})
    if not cl.get("enabled"):
        return {"ok": False, "reason": "closing_app desactive"}

    sources = cl.get("sources")
    if not sources and cl.get("data_url"):  # retro-compat ancien format
        sources = [{"id": None, "url": cl["data_url"],
                    "label": "data_url", "gid": "0"}]
    if not sources:
        return {"ok": False, "reason": "aucune source configuree"}

    by_source, errors, rows = {}, {}, []
    for src in sources:
        label = src.get("label") or src.get("id", "src")
        url = src.get("url") or _csv_export_url(
            src["id"], str(src.get("gid", "0")))
        try:
            resp = requests.get(url, timeout=30)
            resp.raise_for_status()
            text = resp.text
            if text.lstrip().startswith("<"):  # HTML = feuille non accessible
                raise RuntimeError(
                    "reponse HTML (feuille non publiee / non partagee)")
            src_rows = list(csv.DictReader(io.StringIO(text)))
            by_source[label] = src_rows
            rows.extend(src_rows)
        except Exception as exc:
            errors[label] = str(exc)

    return {
        "ok": bool(rows),
        "data": rows,
        "by_source": by_source,
        "errors": errors or None,
    }


def collect_all():
    cfg = _load_config()
    payload = {
        "collected_at": datetime.now(timezone.utc).isoformat(),
        "instagram": None,
        "youtube": None,
        "closing": None,
    }

    ig_cfg = cfg.get("instagram", {})
    if ig_cfg.get("enabled"):
        payload["instagram"] = instagram_fetcher.collect(
            top_reels_count=ig_cfg.get("top_reels_count", 5),
            windows=ig_cfg.get("windows"),
        )

    yt_cfg = cfg.get("youtube_channel", {})
    if yt_cfg.get("enabled"):
        payload["youtube"] = youtube_fetcher.get_channel_stats(
            channel_id=yt_cfg.get("channel_id") or None,
            handle=yt_cfg.get("handle") or None,
        )

    try:
        import closing_sources

        payload["closing"] = closing_sources.collect()
    except Exception as exc:
        payload["closing"] = {"ok": False, "error": str(exc)}

    payload["kpis"] = _build_kpis(payload, cfg)
    return payload


def _kpi(name, value, targets, scope=None):
    target = targets.get(name)
    color, ratio = tier(
        value, target, lower_is_better=name in LOWER_IS_BETTER
    )
    out = {"name": name, "value": value, "target": target,
           "color": color, "ratio": ratio}
    if scope:
        out["scope"] = scope
    return out


def _build_kpis(payload, cfg):
    """Construit le dictionnaire de KPIs normalises (toutes sources)."""
    targets = {**DEFAULT_TARGETS, **(cfg.get("targets") or {})}
    kpis = {}

    ig = payload.get("instagram") or {}
    if ig.get("ok"):
        weekly = ig.get("aggregates", {}).get("weekly", {})
        kpis["followers"] = _kpi("followers", ig.get("followers", 0), targets)
        kpis["views_weekly"] = _kpi(
            "views_weekly", weekly.get("views", 0), targets)
        kpis["interactions_weekly"] = _kpi(
            "interactions_weekly", weekly.get("interactions", 0), targets)
        kpis["messages_received"] = _kpi(
            "messages_received",
            ig.get("messages", {}).get("conversations", 0), targets)

    yt = payload.get("youtube") or {}
    if yt.get("ok"):
        kpis["youtube_subscribers"] = _kpi(
            "youtube_subscribers", yt.get("subscribers", 0), targets)

    # KPIs metier issus des sheets parses (closing / acquisition / leads).
    # NOTE: source_3/source_4 sont GLOBALES (pas de split Paris/Agen) :
    # les variantes _paris portent la valeur globale, _agen restent vides
    # tant que la regle de ville n'est pas fournie.
    closing = payload.get("closing") or {}
    if closing.get("ok"):
        mois = (closing.get("closing") or {}).get("monthly") or {}
        acq = closing.get("acquisition") or {}
        leads = closing.get("leads") or {}
        ops = closing.get("operations") or {}
        paris = ops.get("paris") or {}
        agen = ops.get("agen") or {}

        def add(name, value, scope):
            if value is not None and name in targets:
                kpis[name] = _kpi(name, value, targets, scope=scope)

        # Closing global (source_3 mensuel)
        add("closing_rate", mois.get("closing_rate"),
            f"global {mois.get('period','')}")
        add("closing_rate_agen", mois.get("closing_rate"),
            f"global {mois.get('period','')}")
        add("revenue_paris", mois.get("ca_signe"),
            f"CA signe {mois.get('period','')} (global)")

        # Acquisition (source_4 mensuel) - global
        if acq:
            add("calls_done", acq.get("appels_semaine"),
                f"global {acq.get('period','')}")
            add("leads_paris",
                (acq.get("contacts_ig") or 0) + (acq.get("contacts_site") or 0),
                f"global {acq.get('period','')}")
            add("leads_agen",
                (acq.get("contacts_ig") or 0) + (acq.get("contacts_site") or 0),
                f"global {acq.get('period','')}")
            add("appointments_paris",
                (acq.get("rdv_pris_ig") or 0) + (acq.get("rdv_pris_site") or 0),
                f"global {acq.get('period','')}")
            add("appointments_agen",
                (acq.get("rdv_pris_ig") or 0) + (acq.get("rdv_pris_site") or 0),
                f"global {acq.get('period','')}")
            add("team_activity_agen", acq.get("perf_appels"),
                f"global {acq.get('period','')}")

        # Leads CRM (source_2) - fenetre glissante
        if leads.get("monthly") is not None:
            add("messages_received", leads["monthly"], "30 derniers jours")

        # Operations chirurgicales par ville (source_1, cumul 2025)
        if paris:
            add("revenue_realized_paris", paris.get("revenue_realized"),
                "Paris (CEPE+Alphand+Lille) - cumul 2025")
            add("patients_paris", paris.get("patients"),
                "Paris - cumul 2025")
            add("no_show_rate", paris.get("no_show_rate"),
                "Paris - cumul 2025")
        if agen:
            soins = closing.get("agen_soins") or {}
            agen_total = (agen.get("revenue_realized") or 0) + (
                soins.get("total_revenue") or 0)
            scope_agen = ("Agen total : chirurgies (cumul) "
                          f"{agen.get('revenue_realized',0):.0f}€ + "
                          f"soins 2026 {soins.get('total_revenue',0):.0f}€")
            add("revenue_agen", agen_total, scope_agen)
        total_proc = (paris.get("procedures") or 0) + (
            agen.get("procedures") or 0)
        if total_proc:
            add("procedures_done", total_proc, "global - cumul 2025")

        payload["business"] = {
            "data_period": {
                "closing_month": mois.get("period"),
                "closing_week": (closing.get("closing") or {}).get(
                    "weekly", {}).get("period") if closing.get(
                    "closing") else None,
                "acquisition_month": acq.get("period"),
                "operations_scope": ops.get("scope"),
            },
            "city_rule": ops.get("city_rule"),
            "raw": {"closing": closing.get("closing"),
                    "acquisition": acq, "leads": leads,
                    "operations": ops},
        }

    return kpis


def _recommendation(kpi):
    """Action concrete selon la couleur d'un KPI."""
    name, color = kpi["name"], kpi["color"]
    if color in ("bleu", "vert"):
        return None
    sev = {"jaune": "a surveiller", "orange": "important",
           "rouge": "urgent", "noir": "critique"}[color]
    return {
        "kpi": name,
        "severity": sev,
        "color": color,
        "value": kpi["value"],
        "target": kpi["target"],
        "action": _action_for(name, color),
    }


def _action_for(name, color):
    book = {
        "followers": "Augmenter la cadence de publication et les collaborations.",
        "views_weekly": "Reposter les 3 meilleurs reels, tester de nouveaux hooks.",
        "interactions_weekly": "Ajouter CTA + sondages/questions en story.",
        "messages_received": "Activer une story 'posez vos questions' + DM auto.",
        "instagram_replies": "Reduire le delai de reponse aux DM (< 2h).",
        "youtube_subscribers": "Ajouter cards/end-screens d'abonnement.",
        "appointments_paris": "Relancer les leads chauds Paris non convertis.",
        "appointments_agen": "Relancer les leads chauds Agen non convertis.",
        "response_time": "Prioriser la file de messages le matin.",
        "leads_paris": "Augmenter le budget acquisition Paris.",
        "leads_agen": "Augmenter le budget acquisition Agen.",
        "calls_done": "Bloquer 2 creneaux d'appels supplementaires/jour.",
        "closing_rate": "Revoir le script de closing + objections.",
        "closing_rate_agen": "Coaching closing equipe Agen.",
        "revenue_paris": "Pousser les offres premium sur les leads Paris.",
        "revenue_agen": "Pousser les offres premium sur les leads Agen.",
        "patients_paris": "Optimiser le planning de consultations Paris.",
        "procedures_done": "Reduire les creneaux libres non remplis.",
        "satisfaction": "Mettre en place un suivi post-consultation.",
        "no_show_rate": "Rappels SMS/email J-1 systematiques.",
        "team_activity_agen": "Point d'equipe quotidien + objectifs clairs.",
    }
    base = book.get(name, "Analyser la cause et definir un plan d'action.")
    if color in ("rouge", "noir"):
        return "[A CORRIGER CETTE SEMAINE] " + base
    return base


def build_role_view(payload, role, members_cfg):
    """Vue filtree pour un role : KPIs + reco + KPIs urgents."""
    all_kpis = payload.get("kpis", {})
    if role == "ceo":
        selected = all_kpis
        label = "CEO"
    else:
        role_cfg = members_cfg.get(role, {})
        wanted = role_cfg.get("kpis", [])
        selected = {k: v for k, v in all_kpis.items() if k in wanted}
        label = role_cfg.get("label", role)

    recos, urgent = [], []
    for kpi in selected.values():
        r = _recommendation(kpi)
        if r:
            recos.append(r)
            if r["color"] in ("rouge", "noir"):
                urgent.append(r)

    recos.sort(key=lambda r: ["jaune", "orange", "rouge", "noir"].index(
        r["color"]), reverse=True)

    return {
        "role": role,
        "label": label,
        "is_admin": role == "ceo",
        "collected_at": payload["collected_at"],
        "freshness": payload.get("freshness"),
        "kpis": selected,
        "recommendations": recos,
        "urgent_kpis": urgent,
    }


SOURCE_LABEL = {
    "source_2_leads": "CRM leads",
    "source_1_operations": "Bloc operatoire",
    "source_3_closing": "Closing",
    "source_4_acquisition": "Acquisition",
    "soins_2026_agen": "Soins Agen 2026",
}


def _compute_freshness(payload):
    """Date de la donnee la plus recente vue dans une sheet + score 0-100."""
    sources = {}
    closing = payload.get("closing") or {}
    leads = closing.get("leads") or {}
    if leads.get("latest_data_date"):
        sources["source_2_leads"] = leads["latest_data_date"]
    soins = closing.get("agen_soins") or {}
    if soins.get("latest_data_date"):
        sources["soins_2026_agen"] = soins["latest_data_date"]
    ops = closing.get("operations") or {}
    if ops.get("latest_data_date"):
        sources["source_1_operations"] = ops["latest_data_date"]
    cl = closing.get("closing") or {}
    if cl.get("latest_data_date"):
        sources["source_3_closing"] = cl["latest_data_date"]
    acq = closing.get("acquisition") or {}
    if acq.get("latest_data_date"):
        sources["source_4_acquisition"] = acq["latest_data_date"]

    if not sources:
        return {"score": 0, "latest_date": None, "latest_source": None,
                "days_since": None, "by_source": {}, "message": "Aucune donnee"}

    latest_label, latest_iso = max(sources.items(), key=lambda kv: kv[1])
    latest_dt = datetime.fromisoformat(latest_iso)
    if latest_dt.tzinfo is None:
        latest_dt = latest_dt.replace(tzinfo=timezone.utc)
    days = (datetime.now(timezone.utc) - latest_dt).days
    score = max(0, min(100, int(round(100 - days * (100 / 30)))))
    label = SOURCE_LABEL.get(latest_label, latest_label)
    message = (
        f"Mis a jour le {payload['collected_at'][:10]} — "
        f"derniere donnee dans {label} le {latest_iso[:10]} "
        f"(il y a {days} j)"
    )
    return {
        "score": score,
        "latest_date": latest_iso,
        "latest_source": latest_label,
        "latest_source_label": label,
        "days_since": days,
        "by_source": sources,
        "message": message,
    }


def resolve_role(email, cfg):
    """email -> role. Renvoie None si l'email n'est pas autorise."""
    email = (email or "").strip().lower()
    roles = cfg.get("roles", {})
    if email in [e.lower() for e in roles.get("admin_emails", [])]:
        return "ceo"
    for role, rc in roles.get("members", {}).items():
        if email in [e.lower() for e in rc.get("emails", [])]:
            return role
    return None


def run():
    cfg = _load_config()
    payload = collect_all()
    _persist_snapshot(payload)

    payload["freshness"] = _compute_freshness(payload)

    members = cfg.get("roles", {}).get("members", {})
    payload["views_by_role"] = {
        "ceo": build_role_view(payload, "ceo", members)
    }
    for role in members:
        payload["views_by_role"][role] = build_role_view(
            payload, role, members)

    with open(OUT_JSON, "w") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    if cfg.get("sheets", {}).get("enabled"):
        try:
            import sheets_publisher

            sheets_publisher.publish(payload, cfg["sheets"])
        except Exception as exc:
            print(f"Avertissement Sheets: {exc}")

    print(f"Metriques ecrites dans {OUT_JSON}")
    return payload


if __name__ == "__main__":
    run()
