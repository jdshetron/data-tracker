"""The move rule: what counts as a big move since the previous run.

A move is the percent change in `views` between an item's row on the run date
and its row on the previous date in the history:

    move_pct = (views_today - views_previous) / views_previous * 100

Items are ranked by the size of the move (absolute percent, largest first; ties
by item_id) and the top TOP_N are reported. Items with no previous row, or with
0 views previously, have no percent move and are not ranked. An item that has a
row today but not on the previous date "appeared"; one that had a row on the
previous date but not today "disappeared". On the first day every item appears.
"""

TOP_N = 5


def _num(value):
    if value in ("", None):
        return None
    return float(value)


def compute_moves(rows, run_date, top_n=TOP_N):
    run_date = str(run_date)
    today = {r["item_id"]: r for r in rows if str(r["date"]) == run_date}
    earlier = sorted({str(r["date"]) for r in rows if str(r["date"]) < run_date})
    previous_date = earlier[-1] if earlier else None
    before = {r["item_id"]: r for r in rows if str(r["date"]) == previous_date}

    changes = []
    for item_id in sorted(set(today) & set(before)):
        old, new = _num(before[item_id]["views"]), _num(today[item_id]["views"])
        if old is None or new is None or old == 0:
            continue
        changes.append({
            "item_id": item_id,
            "item": today[item_id]["item"],
            "old": old,
            "new": new,
            "pct": round((new - old) / old * 100, 2),
        })
    changes.sort(key=lambda c: (-abs(c["pct"]), c["item_id"]))
    return {
        "date": run_date,
        "previous_date": previous_date,
        "top": changes[:top_n],
        "changes": changes,
        "appeared": sorted(set(today) - set(before)),
        "disappeared": sorted(set(before) - set(today)),
        "names": {**{k: v["item"] for k, v in before.items()}, **{k: v["item"] for k, v in today.items()}},
    }
