"""The move rule."""

from tracker.moves import compute_moves


def row(date, item_id, views):
    return {"date": date, "item_id": item_id, "item": item_id.title(), "views": str(views)}


def test_percent_change_and_ranking():
    rows = [
        row("2026-11-01", "a", 100), row("2026-11-02", "a", 150),   # +50%
        row("2026-11-01", "b", 200), row("2026-11-02", "b", 100),   # -50%
        row("2026-11-01", "c", 100), row("2026-11-02", "c", 110),   # +10%
    ]
    m = compute_moves(rows, "2026-11-02")
    assert m["previous_date"] == "2026-11-01"
    assert [(c["item_id"], c["pct"]) for c in m["top"]] == [("a", 50.0), ("b", -50.0), ("c", 10.0)]
    assert m["top"][0]["old"] == 100 and m["top"][0]["new"] == 150


def test_top_n_limits_the_list():
    rows = []
    for i in range(10):
        rows += [row("2026-11-01", f"i{i}", 100), row("2026-11-02", f"i{i}", 100 + i)]
    assert len(compute_moves(rows, "2026-11-02", top_n=5)["top"]) == 5
    assert compute_moves(rows, "2026-11-02")["top"][0]["item_id"] == "i9"


def test_appeared_and_disappeared():
    rows = [row("2026-11-01", "old", 1), row("2026-11-01", "both", 1),
            row("2026-11-02", "both", 1), row("2026-11-02", "new", 1)]
    m = compute_moves(rows, "2026-11-02")
    assert m["appeared"] == ["new"]
    assert m["disappeared"] == ["old"]


def test_previous_run_skips_missing_days():
    rows = [row("2026-11-01", "a", 100), row("2026-11-05", "a", 200)]
    m = compute_moves(rows, "2026-11-05")
    assert m["previous_date"] == "2026-11-01"
    assert m["top"][0]["pct"] == 100.0


def test_first_day_everything_appears_and_no_moves():
    m = compute_moves([row("2026-11-01", "a", 1)], "2026-11-01")
    assert m["previous_date"] is None and m["top"] == [] and m["appeared"] == ["a"]


def test_zero_or_empty_previous_is_not_ranked():
    rows = [row("2026-11-01", "a", 0), row("2026-11-02", "a", 50),
            {"date": "2026-11-01", "item_id": "b", "item": "B", "views": ""},
            row("2026-11-02", "b", 5)]
    assert compute_moves(rows, "2026-11-02")["top"] == []
