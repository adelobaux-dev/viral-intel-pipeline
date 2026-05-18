"""Parsers dedies des Google Sheets metier (closing + acquisition + leads).

Les sheets ne sont pas des tableaux propres : en-tetes decales, blocs
mensuels + hebdo, valeurs FR ("140 450", "69,91 %"). On parse donc chaque
sheet specifiquement et on prend la DERNIERE periode renseignee, en
exposant son libelle (transparence sur la fraicheur des donnees).

Limite connue : source_3 / source_4 sont GLOBALES (pas de split
Paris/Agen). Les KPIs par ville restent a definir (cf. source_1).
"""

import csv
import io
from datetime import datetime, timedelta, timezone

import requests

S3 = "1B9pS-WMumtDYLKYUFvKsB1jjmF9FfEWIarvaowU-4Sg"  # closing
S4 = "1W2XjjEElzmpT-qQarnL7Iwe6rJr0r9AAHpK7uCCn4Z4"  # acquisition
S2 = "1wh2_HjJPY18hizGYKBOFIylG-GEI83n-U3BZOY7tkbE"  # leads CRM

MONTHS = {"janvier", "fevrier", "février", "mars", "avril", "mai", "juin",
          "juillet", "aout", "août", "septembre", "octobre", "novembre",
          "decembre", "décembre"}
MONTH_ABBR = {"janv": 1, "fevr": 2, "févr": 2, "mars": 3, "avr": 4,
              "mai": 5, "juin": 6, "juil": 7, "aout": 8, "août": 8,
              "sept": 9, "oct": 10, "nov": 11, "dec": 12, "déc": 12}


def _csv(sheet_id, gid=0):
    url = (f"https://docs.google.com/spreadsheets/d/{sheet_id}"
           f"/export?format=csv&gid={gid}")
    r = requests.get(url, timeout=30)
    r.raise_for_status()
    r.encoding = "utf-8"
    if r.text.lstrip().startswith("<"):
        raise RuntimeError("feuille non accessible (HTML)")
    return list(csv.reader(io.StringIO(r.text)))


def _num(s):
    if s is None:
        return None
    s = str(s).strip().replace(" ", "").replace(" ", "")
    s = s.replace("%", "").replace("€", "").replace(",", ".")
    if not s or s in ("-", "."):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def _cell(row, i):
    return row[i] if i < len(row) else ""


def parse_closing():
    """source_3 : dernier mois + derniere semaine renseignes."""
    rows = _csv(S3)
    monthly = None
    for r in rows:
        label = _cell(r, 2).strip()
        if label.lower() in MONTHS and _num(_cell(r, 3)) is not None:
            monthly = {
                "period": label,
                "devis_proposes": _num(_cell(r, 3)),
                "devis_closes": _num(_cell(r, 4)),
                "closing_rate": _num(_cell(r, 5)),
                "ca_signe": _num(_cell(r, 11)),
                "ca_en_attente": _num(_cell(r, 12)),
                "relances": _num(_cell(r, 9)),
            }
    weekly = None
    for r in rows:
        label = _cell(r, 2).strip()
        if label.lower().startswith("semaine") and _num(_cell(r, 11)):
            weekly = {
                "period": label,
                "closing_rate": _num(_cell(r, 5)),
                "ca_signe": _num(_cell(r, 11)),
                "objectif_bas": _num(_cell(r, 13)),
                "objectif_moyen": _num(_cell(r, 14)),
                "objectif_haut": _num(_cell(r, 15)),
            }
    return {"monthly": monthly, "weekly": weekly}


def parse_acquisition():
    """source_4 : dernier mois renseigne."""
    rows = _csv(S4)
    latest = None
    for r in rows:
        label = _cell(r, 3).strip()
        if label.lower() in MONTHS and _num(_cell(r, 4)) is not None:
            latest = {
                "period": label,
                "contacts_ig": _num(_cell(r, 4)),
                "rdv_pris_ig": _num(_cell(r, 5)),
                "perf_ig": _num(_cell(r, 6)),
                "contacts_site": _num(_cell(r, 8)),
                "rdv_pris_site": _num(_cell(r, 9)),
                "perf_site": _num(_cell(r, 10)),
                "appels_semaine": _num(_cell(r, 12)),
                "rdv_pris_semaine": _num(_cell(r, 13)),
                "perf_appels": _num(_cell(r, 14)),
                "rdv_cotes": _num(_cell(r, 16)),
                "avis_demandes": _num(_cell(r, 18)),
                "avis_recueillis": _num(_cell(r, 19)),
                "followers_dm": _num(_cell(r, 21)),
            }
    return latest


def _parse_fr_date(s):
    parts = str(s).strip().lower().replace(".", "").split()
    if len(parts) != 3:
        return None
    try:
        day = int(parts[0])
        month = MONTH_ABBR.get(parts[1][:4]) or MONTH_ABBR.get(parts[1])
        year = int(parts[2])
        if month:
            return datetime(year, month, day, tzinfo=timezone.utc)
    except (ValueError, TypeError):
        return None
    return None


def parse_leads():
    """source_2 : nb de demandes de RDV par fenetre (jour/semaine/mois)."""
    rows = _csv(S2)
    now = datetime.now(timezone.utc)
    windows = {"daily": 1, "weekly": 7, "monthly": 30}
    counts = {k: 0 for k in windows}
    total = 0
    for r in rows:
        kind = _cell(r, 1).strip().lower()
        if not kind.startswith("demande de rendez-vous"):
            continue
        total += 1
        d = _parse_fr_date(_cell(r, 0))
        if not d:
            continue
        for label, days in windows.items():
            if d >= now - timedelta(days=days):
                counts[label] += 1
    return {"total": total, **counts}


def collect():
    out = {"ok": True, "errors": {}}
    for name, fn in (("closing", parse_closing),
                     ("acquisition", parse_acquisition),
                     ("leads", parse_leads)):
        try:
            out[name] = fn()
        except Exception as exc:
            out[name] = None
            out["errors"][name] = str(exc)
    out["ok"] = any(out.get(k) for k in ("closing", "acquisition", "leads"))
    return out


if __name__ == "__main__":
    import json

    print(json.dumps(collect(), indent=2, ensure_ascii=False))
