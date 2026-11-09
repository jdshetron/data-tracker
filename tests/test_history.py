"""History logic: built from raw files only, reproducible, and a second run on
the same day replaces that day instead of adding to it."""

import datetime as dt
import json

from conftest import api_response
from tracker.build import read_history, write_history
from tracker.config import SOURCES
from tracker.fetch import fetch_all, get_json
from tracker.status import append_run_log, latest_run, make_status


def fake_fetcher(views, fail=()):
    """A stand-in for the network: every article reports `views` on the day before."""
    def fetch(name, run_date):
        if name in fail:
            raise ConnectionError("source down")
        day = (run_date - dt.timedelta(days=1)).isoformat()
        return {"source": name, "responses": {
            a: api_response(a, {day: views}) for _i, _n, a in SOURCES[name]["items"]}}
    return fetch


N_TV, N_MOVIES = len(SOURCES["tv"]["items"]), len(SOURCES["movies"]["items"])


def test_history_sorted_by_date_then_item(tmp_path):
    raw = tmp_path / "raw"
    fetch_all(dt.date(2026, 11, 2), raw, fake_fetcher(20))
    fetch_all(dt.date(2026, 11, 1), raw, fake_fetcher(10))
    rows = write_history(raw, tmp_path / "history.csv")
    keys = [(r["date"], r["item_id"]) for r in rows]
    assert keys == sorted(keys)
    assert len(rows) == 2 * (N_TV + N_MOVIES)


def test_build_is_reproducible_from_raw_files(tmp_path):
    raw = tmp_path / "raw"
    fetch_all(dt.date(2026, 11, 1), raw, fake_fetcher(10))
    fetch_all(dt.date(2026, 11, 2), raw, fake_fetcher(20))
    write_history(raw, tmp_path / "a.csv")
    write_history(raw, tmp_path / "b.csv")
    assert (tmp_path / "a.csv").read_bytes() == (tmp_path / "b.csv").read_bytes()


def test_second_run_same_day_replaces_that_day(tmp_path):
    raw, hist = tmp_path / "raw", tmp_path / "history.csv"
    day = dt.date(2026, 11, 1)
    fetch_all(day, raw, fake_fetcher(10))
    write_history(raw, hist)
    fetch_all(day, raw, fake_fetcher(99))
    rows = write_history(raw, hist)
    assert len(rows) == N_TV + N_MOVIES            # still one row per item for the day
    assert {r["views"] for r in rows} == {99}      # values from the second run
    assert len(read_history(hist)) == N_TV + N_MOVIES


def test_rerun_where_source_fails_drops_its_file(tmp_path):
    raw = tmp_path / "raw"
    day = dt.date(2026, 11, 1)
    fetch_all(day, raw, fake_fetcher(10))
    results = fetch_all(day, raw, fake_fetcher(10, fail={"movies"}))
    assert not (raw / "2026-11-01" / "movies.json.gz").exists()
    assert [r["ok"] for r in results] == [True, False]


def test_failed_source_does_not_stop_run_and_is_recorded(tmp_path):
    raw = tmp_path / "raw"
    results = fetch_all(dt.date(2026, 11, 1), raw, fake_fetcher(10, fail={"tv"}))
    assert results[0] == {"name": "tv", "ok": False, "error": "ConnectionError: source down"}
    assert results[1]["ok"] is True
    assert not (raw / "2026-11-01" / "tv.json.gz").exists()
    rows = write_history(raw, tmp_path / "h.csv")
    assert {r["source"] for r in rows} == {"movies"}   # no rows from the failed source

    log = tmp_path / "run_log.csv"
    append_run_log(log, "2026-11-01T13:00:00Z", "2026-11-01", results)
    run_time, entries = latest_run(log)
    assert run_time == "2026-11-01T13:00:00Z"
    assert [(e["source"], e["ok"]) for e in entries] == [("tv", "false"), ("movies", "true")]


def test_status_counts(tmp_path):
    raw = tmp_path / "raw"
    fetch_all(dt.date(2026, 11, 1), raw, fake_fetcher(10))
    fetch_all(dt.date(2026, 11, 2), raw, fake_fetcher(10, fail={"tv"}))
    rows = write_history(raw, tmp_path / "h.csv")
    results = [{"name": "tv", "ok": False, "count": 0, "error": "x"},
               {"name": "movies", "ok": True, "count": N_MOVIES, "error": ""}]
    s = make_status(rows, raw, "2026-11-02T13:00:00Z", "2026-11-02", results)
    assert s["first_run_date"] == "2026-11-01"
    assert s["days_with_success"] == 2
    assert s["items"] == N_MOVIES
    assert s["new_today"] == []
    assert len(s["gone_today"]) == N_TV
    assert s["sources"][0] == {"name": "tv", "ok": False, "count": 0, "error": "x"}
    json.dumps(s)  # serialisable


class FakeResp:
    def __init__(self, code, body=None, headers=None):
        self.status_code, self._body, self.headers = code, body, headers or {}

    def json(self):
        return self._body

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(self.status_code)


class FakeSession:
    def __init__(self, responses):
        self.responses = list(responses)

    def get(self, url, timeout):
        return self.responses.pop(0)


def test_rate_limit_is_retried():
    waits = []
    s = FakeSession([FakeResp(429, headers={"retry-after": "3"}), FakeResp(200, {"items": []})])
    assert get_json(s, "u", sleep=waits.append) == {"items": []}
    assert waits == [4]


def test_404_means_not_reported():
    assert get_json(FakeSession([FakeResp(404)]), "u", sleep=lambda s: None) is None
