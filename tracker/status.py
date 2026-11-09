"""Step 3 of a run: write data/status.json, and keep the log of every source result."""

import csv
import json
from pathlib import Path

from .build import raw_days
from .moves import compute_moves

LOG_COLUMNS = ["run_time", "date", "source", "ok", "count", "error"]


def append_run_log(log_path, run_time, run_date, results):
    """Record every source's result (success or failure) in data/run_log.csv."""
    log_path = Path(log_path)
    new_file = not log_path.exists()
    with open(log_path, "a", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=LOG_COLUMNS, lineterminator="\n")
        if new_file:
            writer.writeheader()
        for r in results:
            writer.writerow({
                "run_time": run_time, "date": run_date, "source": r["name"],
                "ok": str(r["ok"]).lower(), "count": r.get("count", 0), "error": r.get("error", ""),
            })


def latest_run(log_path):
    """The run_time and per-source results of the most recent run in the log."""
    with open(log_path, encoding="utf-8", newline="") as f:
        entries = list(csv.DictReader(f))
    if not entries:
        return None, []
    last = entries[-1]["run_time"]
    return last, [e for e in entries if e["run_time"] == last]


def make_status(rows, raw_dir, run_time, run_date, source_results):
    days = raw_days(raw_dir)
    moves = compute_moves(rows, run_date)
    return {
        "run_time": run_time,
        "run_date": str(run_date),
        "first_run_date": days[0] if days else None,
        "days_with_success": len(days),
        "items": sum(1 for r in rows if str(r["date"]) == str(run_date)),
        "new_today": moves["appeared"],
        "gone_today": moves["disappeared"],
        "previous_date": moves["previous_date"],
        "sources": [
            {
                "name": r["name"],
                "ok": r["ok"] in (True, "true"),
                "count": int(r.get("count", 0) or 0),
                "error": r.get("error", ""),
            }
            for r in source_results
        ],
    }


def write_status(path, status):
    Path(path).write_text(json.dumps(status, indent=2) + "\n", encoding="utf-8", newline="")
