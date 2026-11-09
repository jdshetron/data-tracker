"""Command line entry point.

    python -m tracker run      # fetch every source, build history, write status
    python -m tracker build    # rebuild data/history.csv from data/raw/ only
    python -m tracker issue    # open/update today's GitHub Issue (needs GITHUB_TOKEN)
"""

import argparse
import datetime as dt
import os
import sys
from pathlib import Path

from .build import write_history
from .fetch import fetch_all
from .issue import issue_body, sync_issue
from .moves import compute_moves
from .status import append_run_log, latest_run, make_status, write_status

DATA = Path("data")
RAW = DATA / "raw"
HISTORY = DATA / "history.csv"
STATUS = DATA / "status.json"
RUN_LOG = DATA / "run_log.csv"


def utc_now():
    return dt.datetime.now(dt.timezone.utc).replace(microsecond=0)


def cmd_run(run_date=None):
    now = utc_now()
    run_date = run_date or now.date()
    results = fetch_all(run_date, RAW)
    rows = write_history(RAW, HISTORY)
    for r in results:
        r["count"] = sum(1 for row in rows if row["date"] == run_date.isoformat() and row["source"] == r["name"])
    run_time = now.isoformat().replace("+00:00", "Z")
    append_run_log(RUN_LOG, run_time, run_date.isoformat(), results)
    status = make_status(rows, RAW, run_time, run_date.isoformat(), results)
    write_status(STATUS, status)
    for r in results:
        print(f"{r['name']}: {'ok' if r['ok'] else 'FAILED ' + r['error']} ({r['count']} items)")
    print(f"history rows: {len(rows)}; days with success: {status['days_with_success']}")


def cmd_build():
    rows = write_history(RAW, HISTORY)
    print(f"wrote {HISTORY} with {len(rows)} rows")


def cmd_issue():
    import json
    from .build import read_history
    status = json.loads(STATUS.read_text(encoding="utf-8"))
    rows = read_history(HISTORY)
    moves = compute_moves(rows, status["run_date"])
    body = issue_body(moves, status)
    repo, token = os.environ.get("GITHUB_REPOSITORY"), os.environ.get("GITHUB_TOKEN")
    if not (repo and token):
        print(body)
        print("GITHUB_REPOSITORY / GITHUB_TOKEN not set; issue not posted.")
        return
    number = sync_issue(repo, token, status["run_date"], body)
    print(f"issue #{number} is up to date")


def main(argv=None):
    p = argparse.ArgumentParser(prog="tracker")
    p.add_argument("command", choices=["run", "build", "issue"])
    p.add_argument("--date", help="override the UTC run date (YYYY-MM-DD), for testing")
    args = p.parse_args(argv)
    if args.command == "run":
        cmd_run(dt.date.fromisoformat(args.date) if args.date else None)
    elif args.command == "build":
        cmd_build()
    else:
        cmd_issue()


if __name__ == "__main__":
    sys.exit(main())
