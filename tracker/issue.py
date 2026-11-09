"""Step 4 of a run: open (or update) the GitHub Issue for the day, close older ones."""

import requests

LABEL = "daily-report"
API = "https://api.github.com"


def _fmt(n):
    return f"{n:,.0f}"


def issue_body(moves, status):
    lines = [f"Daily report for **{moves['date']}** (run at {status['run_time']}).", ""]
    if moves["previous_date"]:
        lines.append(f"Compared with the previous run on {moves['previous_date']}.")
    else:
        lines.append("This is the first run, so there is no previous run to compare with.")
    lines += [
        "",
        "Move rule: percent change in daily Wikipedia page views (`views`) since the previous run; "
        "the 5 largest moves by absolute percent are listed.",
        "",
        "## Biggest moves",
    ]
    if moves["top"]:
        lines += ["| Item | Old views | New views | Change |", "|---|---:|---:|---:|"]
        for m in moves["top"]:
            lines.append(f"| {m['item']} | {_fmt(m['old'])} | {_fmt(m['new'])} | {m['pct']:+.1f}% |")
    else:
        lines.append("No moves to report today.")
    names = moves["names"]
    lines += ["", "## Appeared"]
    lines += [f"- {names.get(i, i)} (`{i}`)" for i in moves["appeared"]] or ["None."]
    lines += ["", "## Disappeared"]
    lines += [f"- {names.get(i, i)} (`{i}`)" for i in moves["disappeared"]] or ["None."]
    lines += ["", "## Sources"]
    for s in status["sources"]:
        state = "ok" if s["ok"] else f"FAILED ({s['error']})"
        lines.append(f"- {s['name']}: {state}, {s['count']} items")
    return "\n".join(lines) + "\n"


def sync_issue(repo, token, title, body, session=None):
    """Create or update the issue titled `title`; close every other open daily issue."""
    s = session or requests.Session()
    s.headers.update({"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"})
    existing = s.get(f"{API}/repos/{repo}/issues",
                     params={"state": "all", "labels": LABEL, "per_page": 100}, timeout=30)
    existing.raise_for_status()
    issues = [i for i in existing.json() if "pull_request" not in i]
    match = next((i for i in issues if i["title"] == title), None)
    if match:
        r = s.patch(f"{API}/repos/{repo}/issues/{match['number']}",
                    json={"body": body, "state": "open"}, timeout=30)
    else:
        r = s.post(f"{API}/repos/{repo}/issues",
                   json={"title": title, "body": body, "labels": [LABEL]}, timeout=30)
    r.raise_for_status()
    number = r.json()["number"]
    for i in issues:
        if i["state"] == "open" and i["title"] != title:
            s.patch(f"{API}/repos/{repo}/issues/{i['number']}",
                    json={"state": "closed"}, timeout=30).raise_for_status()
    return number
