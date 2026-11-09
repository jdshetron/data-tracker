"""What the tracker watches: two sources, each a list of Wikipedia articles.

Each item is (item_id, display name, Wikipedia article title). The item_id is the
key that lines an item up from one day to the next; it never changes even if the
display name does.
"""

API_URL = (
    "https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/"
    "en.wikipedia/{access}/user/{article}/daily/{start}/{end}"
)

# Each access type is a separate request; their sum is the total daily views.
ACCESS_TYPES = ["desktop", "mobile-web", "mobile-app"]

# Days of history requested per run (the 7-day average needs 7 complete days).
WINDOW_DAYS = 8

USER_AGENT = "fda-data-tracker/1.0 (educational project; python-requests)"

SOURCES = {
    "tv": {
        "category": "TV",
        "items": [
            ("breaking-bad", "Breaking Bad", "Breaking_Bad"),
            ("game-of-thrones", "Game of Thrones", "Game_of_Thrones"),
            ("stranger-things", "Stranger Things", "Stranger_Things"),
            ("the-office-us", "The Office (US)", "The_Office_(American_TV_series)"),
            ("friends", "Friends", "Friends"),
            ("the-last-of-us", "The Last of Us", "The_Last_of_Us_(TV_series)"),
            ("wednesday", "Wednesday", "Wednesday_(TV_series)"),
            ("the-bear", "The Bear", "The_Bear_(TV_series)"),
            ("severance", "Severance", "Severance_(TV_series)"),
            ("the-boys", "The Boys", "The_Boys_(TV_series)"),
            ("squid-game", "Squid Game", "Squid_Game"),
            ("house-of-the-dragon", "House of the Dragon", "House_of_the_Dragon"),
            ("succession", "Succession", "Succession_(TV_series)"),
            ("the-white-lotus", "The White Lotus", "The_White_Lotus"),
        ],
    },
    "movies": {
        "category": "Movie",
        "items": [
            ("the-godfather", "The Godfather", "The_Godfather"),
            ("shawshank-redemption", "The Shawshank Redemption", "The_Shawshank_Redemption"),
            ("inception", "Inception", "Inception"),
            ("interstellar", "Interstellar", "Interstellar_(film)"),
            ("pulp-fiction", "Pulp Fiction", "Pulp_Fiction"),
            ("the-dark-knight", "The Dark Knight", "The_Dark_Knight"),
            ("titanic", "Titanic", "Titanic_(1997_film)"),
            ("oppenheimer", "Oppenheimer", "Oppenheimer_(film)"),
            ("barbie", "Barbie", "Barbie_(film)"),
            ("dune-part-two", "Dune: Part Two", "Dune:_Part_Two"),
            ("avatar", "Avatar", "Avatar_(2009_film)"),
            ("forrest-gump", "Forrest Gump", "Forrest_Gump"),
            ("spirited-away", "Spirited Away", "Spirited_Away"),
            ("parasite", "Parasite", "Parasite_(2019_film)"),
        ],
    },
}


def article_lookup():
    """Map article title -> (item_id, name, source, category) for every configured item."""
    out = {}
    for source, cfg in SOURCES.items():
        for item_id, name, article in cfg["items"]:
            out[article] = (item_id, name, source, cfg["category"])
    return out
