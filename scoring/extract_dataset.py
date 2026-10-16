#!/usr/bin/env python3
"""
Export the lead tier dataset from Snowflake to a local JSON file.

Runs scoring/sql/lead_tier_dataset.sql read-only through the data-sf repo's
Snowflake helper (sfq.py), which owns credentials via that repo's .env.
The output holds deal ids, answers, email domains and outcomes, so it is
written under .sandbox/ (gitignored) and must never be committed.

Usage (run with the data-sf virtualenv):
    ~/Athena/Dev/data-sf/data-sf/.venv/bin/python scoring/extract_dataset.py
    ... scoring/extract_dataset.py --data-sf /path/to/data-sf --out some.json
"""

import argparse
import json
import os
import sys
from datetime import date

HERE = os.path.dirname(os.path.abspath(__file__))
REPO_ROOT = os.path.dirname(HERE)

DEFAULT_DATA_SF = os.path.expanduser("~/Athena/Dev/data-sf/data-sf")
DEFAULT_OUT = os.path.join(REPO_ROOT, ".sandbox", "lead_tier_project", "data", "lead_tier_dataset.json")
SQL_PATH = os.path.join(HERE, "sql", "lead_tier_dataset.sql")


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument("--data-sf", default=os.environ.get("DATA_SF_REPO", DEFAULT_DATA_SF))
    parser.add_argument("--out", default=DEFAULT_OUT)
    args = parser.parse_args()

    sys.path.insert(0, os.path.join(args.data_sf, ".agents", "scripts"))
    from sfq import connect, rows_as_dicts  # noqa: E402

    with open(SQL_PATH) as f:
        sql = f.read()

    conn = connect()
    try:
        rows = rows_as_dicts(conn, sql)
    finally:
        conn.close()

    deals = []
    for row in rows:
        answers = row["answers"]
        row["answers"] = json.loads(answers) if isinstance(answers, str) else (answers or {})
        if row["stored_score"] is not None:
            row["stored_score"] = float(row["stored_score"])
        deals.append(row)

    os.makedirs(os.path.dirname(args.out), exist_ok=True)
    with open(args.out, "w") as f:
        json.dump({"extractedOn": date.today().isoformat(), "deals": deals}, f)

    print(f"Wrote {len(deals):,} deals to {args.out}")


if __name__ == "__main__":
    main()
