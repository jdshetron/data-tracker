import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def api_response(article, views_by_day):
    """A Wikimedia pageviews response shaped like the real API's."""
    return {
        "items": [
            {"project": "en.wikipedia", "article": article, "granularity": "daily",
             "timestamp": day.replace("-", "") + "00", "access": "all-access",
             "agent": "user", "views": v}
            for day, v in views_by_day.items()
        ]
    }
