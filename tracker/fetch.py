"""Step 1 of a run: call every source and save what it returns.

Each source is saved, gzip-compressed JSON, to data/raw/<date>/<source>.json.gz.
A source that fails writes no file; the result of every source is returned so
the run can record it.
"""

import datetime as dt
import gzip
import json
import shutil
import time
import urllib.parse
from pathlib import Path

import requests

from .config import API_URL, SOURCES, USER_AGENT, WINDOW_DAYS

PAUSE_SECONDS = 1.0  # between requests, to stay under Wikimedia's rate limit
MAX_TRIES = 8


def window(run_date):
    """The days requested on run_date: the WINDOW_DAYS complete days before it."""
    end = run_date - dt.timedelta(days=1)
    start = run_date - dt.timedelta(days=WINDOW_DAYS)
    return start.strftime("%Y%m%d00"), end.strftime("%Y%m%d00")


def get_json(session, url, sleep=time.sleep):
    """GET a URL, waiting and retrying when the server says to slow down (429)."""
    for _ in range(MAX_TRIES):
        resp = session.get(url, timeout=30)
        if resp.status_code == 429:
            wait = min(int(resp.headers.get("retry-after", "10")) + 1, 90)
            sleep(wait)
            continue
        if resp.status_code == 404:
            return None  # Wikimedia has no views for this article in the window
        resp.raise_for_status()
        return resp.json()
    raise RuntimeError(f"still rate limited after {MAX_TRIES} tries: {url}")


def fetch_source(name, run_date, session=None, sleep=time.sleep):
    """Download every article of one source and return the payload as a dict.

    The payload keeps each API response exactly as it came back, keyed by article.
    An article that fails (after retries) is stored as {"error": ...} and the rest
    carry on; the source only fails if no article could be downloaded.
    """
    session = session or requests.Session()
    session.headers["User-Agent"] = USER_AGENT
    start, end = window(run_date)
    responses = {}
    for _label, article in SOURCES[name]["items"]:
        url = API_URL.format(
            access="all-access", article=urllib.parse.quote(article, safe=""), start=start, end=end
        )
        try:
            responses[article] = get_json(session, url, sleep=sleep)
        except Exception as exc:
            responses[article] = {"error": f"{type(exc).__name__}: {exc}"[:200]}
        sleep(PAUSE_SECONDS)
    if not any(r and r.get("items") for r in responses.values()):
        raise RuntimeError(f"source {name} returned no data")
    return {
        "source": name,
        "url_template": API_URL.format(access="all-access", article="{article}", start=start, end=end),
        "responses": responses,
    }


def raw_path(raw_dir, run_date, source):
    return Path(raw_dir) / run_date.isoformat() / f"{source}.json.gz"


def write_raw(path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    data = json.dumps(payload, sort_keys=True, indent=1).encode("utf-8")
    # mtime=0 so the same content always gives the same bytes
    path.write_bytes(gzip.compress(data, mtime=0))


def read_raw(path):
    return json.loads(gzip.decompress(Path(path).read_bytes()))


def fetch_all(run_date, raw_dir, fetcher=fetch_source, sources=None):
    """Fetch every source for run_date. Returns one result dict per source.

    A rerun on the same day replaces that day's raw files: the day's folder is
    emptied first, so a source that fails on the rerun has no file that day.
    """
    day_dir = Path(raw_dir) / run_date.isoformat()
    if day_dir.exists():
        shutil.rmtree(day_dir)
    results = []
    for name in sources or SOURCES:
        try:
            payload = fetcher(name, run_date)
            write_raw(raw_path(raw_dir, run_date, name), payload)
            results.append({"name": name, "ok": True, "error": ""})
        except Exception as exc:  # one source failing must not stop the run
            results.append({"name": name, "ok": False, "error": f"{type(exc).__name__}: {exc}"[:300]})
    return results
