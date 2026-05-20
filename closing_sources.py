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
S1 = "1m7ITSo_sbDY6XxHufA0FONGyXG3GBOPSKyKtEIrjzNI"  # operations chirurgie
S1_AGEN_SOINS_GID = 1816506397  # onglet "soins 2026" (centre esthetique Agen)

# Regle de ville fournie par le CEO : Lille est rattachee a Paris.
PARIS_TOKENS = ("cepe", "alphand", "lille")
AGEN_TOKENS = ("agen",)
CANCELLED_TOKENS = ("annul", "reporte", "reporté")

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


MONTH_NUM = {"janvier": 1, "fevrier": 2, "février": 2, "mars": 3, "avril": 4,
             "mai": 5, "juin": 6, "juillet": 7, "aout": 8, "août": 8,
             "septembre": 9, "octobre": 10, "novembre": 11,
             "decembre": 12, "décembre": 12}


def _month_to_date(label, ref_year=None):
    """Libelle FR -> date du 1er du mois (annee = courante si <= mois courant)."""
    m = MONTH_NUM.get(label.strip().lower())
    if not m:
        return None
    now = datetime.now(timezone.utc)
    ref_year = ref_year or now.year
    year = ref_year if m <= now.month else ref_year - 1
    return datetime(year, m, 1, tzinfo=timezone.utc)


def _week_to_date(label):
    """'Semaine N' -> lundi de l'ISO-week N de l'annee courante."""
    parts = label.strip().split()
    if len(parts) < 2 or not parts[1].isdigit():
        return None
    week = int(parts[1])
    try:
        return datetime.fromisocalendar(
            datetime.now(timezone.utc).year, week, 1
        ).replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def parse_closing():
    """source_3 : dernier mois + derniere semaine renseignes."""
    rows = _csv(S3)
    monthly, monthly_date = None, None
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
            monthly_date = _month_to_date(label)
    weekly, weekly_date = None, None
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
            weekly_date = _week_to_date(label)
    latest = max((d for d in (monthly_date, weekly_date) if d), default=None)
    return {"monthly": monthly, "weekly": weekly,
            "latest_data_date": latest.isoformat() if latest else None}


def parse_acquisition():
    """source_4 : dernier mois renseigne."""
    rows = _csv(S4)
    latest, latest_date = None, None
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
            latest_date = _month_to_date(label)
    if latest:
        latest["latest_data_date"] = (
            latest_date.isoformat() if latest_date else None)
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
    total, latest = 0, None
    for r in rows:
        kind = _cell(r, 1).strip().lower()
        if not kind.startswith("demande de rendez-vous"):
            continue
        total += 1
        d = _parse_fr_date(_cell(r, 0))
        if not d:
            continue
        if latest is None or d > latest:
            latest = d
        for label, days in windows.items():
            if d >= now - timedelta(days=days):
                counts[label] += 1
    return {"total": total, **counts,
            "latest_data_date": latest.isoformat() if latest else None}


def _classify_city(value):
    v = (value or "").strip().lower()
    if any(t in v for t in PARIS_TOKENS):
        return "paris"
    if any(t in v for t in AGEN_TOKENS):
        return "agen"
    return None


def _is_cancelled(status):
    s = (status or "").strip().lower()
    return any(t in s for t in CANCELLED_TOKENS)


def parse_operations():
    """source_1 : interventions chirurgicales, agregees par ville.

    Paris = CEPE + ALPHAND + LILLE ; Agen = AGEN. Lignes annulees /
    reportees exclues du chiffre d'affaires et du compte d'actes,
    mais comptees dans le taux d'annulation.
    """
    rows = _csv(S1)
    by = {
        "paris": {"procedures": 0, "patients": set(), "revenue": 0.0,
                  "cancelled": 0},
        "agen": {"procedures": 0, "patients": set(), "revenue": 0.0,
                 "cancelled": 0},
    }
    total_rows, latest_date = 0, None
    for r in rows:
        city = _classify_city(_cell(r, 7))
        if city is None:
            continue
        total_rows += 1
        date_cell = _cell(r, 1).strip().replace(" ", "")
        if "/" in date_cell:
            parts = date_cell.split("/")
            try:
                day, month = int(parts[0].lstrip("O")), int(parts[1])
                y = int(parts[2]) if len(parts) > 2 and parts[2] else 2025
                if y < 100:
                    y += 2000
                d = datetime(y, month, day, tzinfo=timezone.utc)
                now = datetime.now(timezone.utc)
                if d > now:
                    continue  # date future (planning) -> ignorer
                if latest_date is None or d > latest_date:
                    latest_date = d
            except (ValueError, IndexError):
                pass
        cancelled = _is_cancelled(_cell(r, 0))
        if cancelled:
            by[city]["cancelled"] += 1
            continue
        by[city]["procedures"] += 1
        patient = _cell(r, 3).strip()
        if patient:
            by[city]["patients"].add(patient)
        montant = _num(_cell(r, 8))
        if montant is not None:
            by[city]["revenue"] += montant

    def _pack(d):
        total_acts = d["procedures"] + d["cancelled"]
        no_show = (d["cancelled"] / total_acts * 100) if total_acts else None
        return {
            "procedures": d["procedures"],
            "patients": len(d["patients"]),
            "revenue_realized": round(d["revenue"], 2),
            "cancelled": d["cancelled"],
            "no_show_rate": round(no_show, 2) if no_show is not None else None,
        }

    return {"paris": _pack(by["paris"]), "agen": _pack(by["agen"]),
            "scope": "cumul 2025",
            "city_rule": "Paris=CEPE+Alphand+Lille, Agen=AGEN",
            "latest_data_date": (latest_date.isoformat()
                                 if latest_date else None)}


def parse_agen_soins():
    """Onglet 'soins 2026' (gid=1816506397) du sheet S1.

    Centre esthetique Agen : une ligne = un soin. col3 = prix paye
    (FR avec '€'), col0 = date du jour (DD/MM ou DD/MM/YYYY).
    Total = CA encaisse Agen sur 2026 hors chirurgies.
    """
    rows = _csv(S1, gid=S1_AGEN_SOINS_GID)
    total, count, latest = 0.0, 0, None
    now = datetime.now(timezone.utc)
    current_date = None
    for r in rows:
        if _cell(r, 0).strip():
            d = _cell(r, 0).strip().replace(" ", "")
            parts = d.split("/")
            if len(parts) >= 2 and parts[0].isdigit() and parts[1].isdigit():
                try:
                    day = int(parts[0])
                    month = int(parts[1])
                    year = (int(parts[2]) if len(parts) > 2
                            and parts[2].isdigit() else 2026)
                    if year < 100:
                        year += 2000
                    cd = datetime(year, month, day, tzinfo=timezone.utc)
                    if cd <= now:
                        current_date = cd
                except ValueError:
                    pass
        patient = _cell(r, 1).strip()
        if not patient:
            continue
        price = _num(_cell(r, 3))
        if price is None:
            continue
        total += price
        count += 1
        if current_date and (latest is None or current_date > latest):
            latest = current_date
    return {
        "scope": "Agen - soins 2026 (esthetique)",
        "total_revenue": round(total, 2),
        "soins_count": count,
        "latest_data_date": latest.isoformat() if latest else None,
    }


def collect():
    out = {"ok": True, "errors": {}}
    for name, fn in (("closing", parse_closing),
                     ("acquisition", parse_acquisition),
                     ("leads", parse_leads),
                     ("operations", parse_operations),
                     ("agen_soins", parse_agen_soins)):
        try:
            out[name] = fn()
        except Exception as exc:
            out[name] = None
            out["errors"][name] = str(exc)
    out["ok"] = any(out.get(k) for k in (
        "closing", "acquisition", "leads", "operations", "agen_soins"))
    return out


if __name__ == "__main__":
    import json

    print(json.dumps(collect(), indent=2, ensure_ascii=False))
