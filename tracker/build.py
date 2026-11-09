"""Step 2 of a run: build data/history.csv from the raw files alone.

Every day's raw files are converted to one row per item with the common columns
below, then all rows are sorted by date and item_id. Running the build again on
the same raw files always gives the same file.
"""

import csv
import io
from pathlib import Path

from .config import article_lookup
from .fetch import read_raw

COLUMNS = [
    "date",            # UTC date of the run (YYYY-MM-DD)
    "item_id",         # stable key for the show or movie
    "item",            # display name
    "source",          # tv or movies
    "category",        # TV or Movie
    "data_date",       # the day the view counts are for (latest complete day)
    "views",           # page views on data_date
    "views_prev_day",  # page views the day before data_date
    "views_7d_avg",    # mean daily views over the 7 days ending data_date
    "views_7d_high",   # highest daily views in those 7 days
    "views_7d_low",    # lowest daily views in those 7 days
    "article",         # Wikipedia article title the numbers come from
]
NUMERIC = ["views", "views_prev_day", "views_7d_avg", "views_7d_high", "views_7d_low"]


def slugify(text):
    out = "".join(c.lower() if c.isalnum() else "-" for c in text)
    return "-".join(part for part in out.split("-") if part)


def ymd(timestamp):
    """'2026110800' -> '2026-11-08'."""
    return f"{timestamp[0:4]}-{timestamp[4:6]}-{timestamp[6:8]}"


def parse_source(source, payload, run_date):
    """Convert one raw file to rows with the common columns."""
    lookup = article_lookup()
    rows = []
    for article, response in sorted(payload.get("responses", {}).items()):
        if not response or not response.get("items"):
            continue  # not reported that day: no row
        series = sorted((ymd(p["timestamp"]), int(p["views"])) for p in response["items"])
        data_date, views = series[-1]
        last7 = [v for _, v in series[-7:]]
        item_id, name, _src, category = lookup.get(
            article, (slugify(article), article.replace("_", " "), source, "")
        )
        rows.append({
            "date": run_date,
            "item_id": item_id,
            "item": name,
            "source": source,
            "category": category,
            "data_date": data_date,
            "views": views,
            "views_prev_day": series[-2][1] if len(series) > 1 else "",
            "views_7d_avg": round(sum(last7) / len(last7), 1),
            "views_7d_high": max(last7),
            "views_7d_low": min(last7),
            "article": article,
        })
    return rows


def raw_days(raw_dir):
    """Dates (folder names) that have at least one raw file, oldest first."""
    raw_dir = Path(raw_dir)
    if not raw_dir.exists():
        return []
    return sorted(d.name for d in raw_dir.iterdir() if d.is_dir() and any(d.glob("*.json.gz")))


def build_rows(raw_dir):
    rows = []
    for day in raw_days(raw_dir):
        for path in sorted((Path(raw_dir) / day).glob("*.json.gz")):
            source = path.name.split(".")[0]
            rows.extend(parse_source(source, read_raw(path), day))
    rows.sort(key=lambda r: (r["date"], r["item_id"]))
    return rows


def to_csv(rows):
    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=COLUMNS, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    return buf.getvalue()


def write_history(raw_dir, history_path):
    rows = build_rows(raw_dir)
    Path(history_path).parent.mkdir(parents=True, exist_ok=True)
    Path(history_path).write_text(to_csv(rows), encoding="utf-8", newline="")
    return rows


def read_history(history_path):
    with open(history_path, encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))
