#!/usr/bin/env python3
"""Entry point for the BCA Instagram sell-by-chat bot.

Usage:
    python instagram_bot.py serve              # run the webhook server
    python instagram_bot.py export [file.csv]  # export captured leads to CSV
    python instagram_bot.py check              # verify env configuration
"""
import csv
import sys

from dotenv import load_dotenv

load_dotenv()

from instagram import crm  # noqa: E402
from instagram.config import settings  # noqa: E402


def _serve():
    ok, missing = settings.is_configured()
    if not ok:
        print(f"Missing required env vars: {', '.join(missing)}")
        print("Set them in your .env file before serving (see README).")
        sys.exit(1)
    from instagram.webhook import create_app

    app = create_app()
    port = 8000
    print(f"BCA Instagram bot listening on :{port}/webhook")
    print("Point your Meta app webhook (Instagram messages) at this URL.")
    app.run(host="0.0.0.0", port=port)


def _export(path: str):
    crm.init_crm()
    leads = crm.export_leads()
    if not leads:
        print("No leads captured yet.")
        return
    with open(path, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=list(leads[0].keys()))
        writer.writeheader()
        writer.writerows(leads)
    print(f"Exported {len(leads)} leads -> {path}")


def _check():
    ok, missing = settings.is_configured()
    print("Configuration OK." if ok else f"Missing: {', '.join(missing)}")
    print(f"Graph API version : {settings.graph_api_version}")
    print(f"BCA experts excluded: {len(settings.bca_experts)}")
    print(f"Event: {settings.event_name}")
    sys.exit(0 if ok else 1)


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "serve"
    if cmd == "serve":
        _serve()
    elif cmd == "export":
        _export(sys.argv[2] if len(sys.argv) > 2 else "ig_leads.csv")
    elif cmd == "check":
        _check()
    else:
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
