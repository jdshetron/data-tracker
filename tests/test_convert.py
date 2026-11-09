"""Conversion of each source's raw payload to the common columns."""

import pytest

from conftest import api_response
from tracker.build import COLUMNS, parse_source
from tracker.config import SOURCES

DAYS = {f"2026-11-0{d}": 100 * d for d in range(1, 9)}  # 100, 200, ... 800


@pytest.mark.parametrize("source", list(SOURCES))
def test_each_source_converts_to_common_columns(source):
    item_id, name, article = SOURCES[source]["items"][0]
    payload = {"source": source, "responses": {article: api_response(article, DAYS)}}
    rows = parse_source(source, payload, "2026-11-09")
    assert len(rows) == 1
    row = rows[0]
    assert list(row) == COLUMNS
    assert row["date"] == "2026-11-09"
    assert row["item_id"] == item_id
    assert row["item"] == name
    assert row["source"] == source
    assert row["category"] == SOURCES[source]["category"]
    assert row["data_date"] == "2026-11-08"
    assert row["views"] == 800
    assert row["views_prev_day"] == 700
    assert row["views_7d_avg"] == 500.0  # mean of 200..800
    assert row["views_7d_high"] == 800
    assert row["views_7d_low"] == 200


def test_missing_article_gives_no_row():
    payload = {"responses": {"Breaking_Bad": None, "Friends": {"items": []}}}
    assert parse_source("tv", payload, "2026-11-09") == []


def test_unknown_article_gets_slug_key():
    payload = {"responses": {"Some_New_Show": api_response("Some_New_Show", {"2026-11-08": 5})}}
    row = parse_source("tv", payload, "2026-11-09")[0]
    assert row["item_id"] == "some-new-show"
    assert row["item"] == "Some New Show"
    assert row["views_prev_day"] == ""  # only one day reported: left empty
    assert row["views_7d_avg"] == 5.0


def test_unsorted_api_days_are_ordered():
    days = dict(reversed(list(DAYS.items())))
    payload = {"responses": {"Friends": api_response("Friends", days)}}
    row = parse_source("tv", payload, "2026-11-09")[0]
    assert row["data_date"] == "2026-11-08" and row["views"] == 800
