# TV & Movie Tracker

[![Tests](https://github.com/jdshetron/data-tracker/actions/workflows/tests.yml/badge.svg)](https://github.com/jdshetron/data-tracker/actions/workflows/tests.yml)
[![Daily run](https://github.com/jdshetron/data-tracker/actions/workflows/daily.yml/badge.svg)](https://github.com/jdshetron/data-tracker/actions/workflows/daily.yml)

Every day, on its own, this tool downloads the latest **English Wikipedia page views** for
14 TV shows and 14 movies, adds them to a history with one row per item per day, opens a
GitHub Issue listing what moved, and publishes the result to a website.

**Live site:** https://jdshetron.github.io/data-tracker/

## Sources

| Source | What it is | Format | Items |
|---|---|---|---|
| `tv` | [Wikimedia Pageviews API](https://doc.wikimedia.org/generated-data-platform/aqs/analytics-api/reference/page-views.html), per-article daily views | JSON (saved as `data/raw/<date>/tv.json.gz`) | 14 TV shows |
| `movies` | Same API, for a different list of articles | JSON (saved as `data/raw/<date>/movies.json.gz`) | 14 movies |

No login or API key is needed. Each run makes one request per article:

```
https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/user/<article>/daily/<start>/<end>
```

**What is kept:** only the articles listed in [`tracker/config.py`](tracker/config.py), only
English Wikipedia, only human readers (`agent=user`, which leaves out bots and crawlers), all
devices combined (`all-access`), and only the 8 complete days before the run date. The raw
file stores each article's API response unchanged, keyed by article title.

Wikimedia limits anonymous clients to about 10 requests in a burst, so the fetcher pauses
1 second between requests and waits for the time the server's `retry-after` header gives when
it answers `429 Too Many Requests`. A run takes about 2â€“3 minutes.

**Item key:** each item has a fixed `item_id` (for example `breaking-bad`) set in
`tracker/config.py`, so the same show lines up day after day even if its display name changes.

## The history file: `data/history.csv`

One row per item per day, sorted by `date`, then `item_id`.

| Column | Meaning | Unit |
|---|---|---|
| `date` | UTC date of the run that fetched the row | YYYY-MM-DD |
| `item_id` | Fixed key for the show or movie | text |
| `item` | Display name | text |
| `source` | Source the row came from: `tv` or `movies` | text |
| `category` | `TV` or `Movie` | text |
| `data_date` | The day the view counts are for: the latest complete day Wikimedia reported (usually the day before `date`) | YYYY-MM-DD |
| `views` | Page views of the article on `data_date` | views per day |
| `views_prev_day` | Page views on the day before `data_date` | views per day |
| `views_7d_avg` | Mean daily views over the 7 days ending on `data_date` (1 decimal) | views per day |
| `views_7d_high` | Highest daily views in those 7 days | views per day |
| `views_7d_low` | Lowest daily views in those 7 days | views per day |
| `article` | Wikipedia article title the numbers come from | text |

A value the source does not report for an item on a day is left empty. An article Wikimedia
does not return on a day has no row that day.

## The status file: `data/status.json`

Describes the latest run: `run_time` (UTC), `run_date`, `first_run_date` (date of the earliest
raw file), `days_with_success` (number of dates with a raw file), `items` (rows in the latest
run), `new_today` and `gone_today` (item_ids that appeared or disappeared since the previous
run), `previous_date`, and `sources` (one entry per source with `name`, `ok`, `count`, and
`error`).

Every source's result on every run, success or failure, is also appended to
`data/run_log.csv` (`run_time, date, source, ok, count, error`).

## Move rule

A move is the **percent change in `views`** between an item's row on the run date and its row
on the previous date in the history:

```
move % = (views today âˆ’ views on the previous run) Ã· views on the previous run Ã— 100
```

Items are ranked by the size of the move (absolute percent, largest first; ties broken by
`item_id`) and the **top 5** are listed in the daily issue and on the Today page, with old and
new values. Items with no previous row, or 0 views previously, are not ranked. An item with a
row today but not on the previous run **appeared**; one with a row on the previous run but not
today **disappeared**. The issue is opened every day, even when nothing moved.

## Building the history from the raw files

```bash
python -m tracker build
```

This reads only `data/raw/`, so running it again gives the same `data/history.csv`, and a change
to a rule applies to every day of the history.

Other commands:

```bash
python -m tracker run     # fetch every source, rebuild history, write status and run log
python -m tracker issue   # open/update today's issue (needs GITHUB_TOKEN and GITHUB_REPOSITORY)
python -m pytest          # run the tests
```

## What a daily run does

1. **Fetch** every source and save its response, gzip-compressed, to
   `data/raw/<date>/<source>.json.gz`. A source that fails writes no file, the run continues,
   and the failure is recorded in the status and run log.
2. **Build** `data/history.csv` from all raw files.
3. **Write** `data/status.json` and append to `data/run_log.csv`.
4. **Open a GitHub Issue** titled with the date (label `daily-report`) listing the biggest
   moves and any items that appeared or disappeared, and **close** the previous day's issue.
5. **Commit** the raw files, history, status and run log, then deploy the site.

A second run on the same day empties that day's raw folder before fetching, rebuilds the
history, and updates the same issue, so each day counts once.

## Website

Three pages share one navigation bar, one stylesheet and one set of fonts and colours: a dark
cinema theme with marquee gold for movies and TV-screen cyan for shows (Bebas Neue and Inter).
They load `data/history.csv` and `data/status.json` in the browser and compute everything there.

Each page opens with a 3D film set built with [Three.js](https://threejs.org/) from code (no
model files): a retro TV whose screen cycles through today's most-viewed titles, spinning film
reels, a clapperboard, a popcorn bucket and a scrolling film strip. The Today page has a 3D
"box-office skyline" of today's views, and the Trends page has a 3D "view landscape" of the top
titles across run dates; both can be rotated by dragging, and hovering a bar shows its numbers.

- **Today** (`index.html`): time of the last run, status of every source, the status counts,
  latest values with change since the previous run, and the biggest moves.
- **Browse** (`browse.html`): latest values with filters (type, direction since last run,
  minimum views, starred only), a title search, sorting by every numeric column in both
  directions, and a â˜† shortlist saved in the browser's `localStorage`.
- **Trends** (`trends.html`): a chart of each numeric value over the days with an item picker,
  and five findings (biggest riser and faller since the first run, the run with the biggest
  moves, how far apart the items are, TV vs movies, and which titles swing most within a week),
  each with the numbers, how they are computed from the history file, and a chart.

The site is installable: `manifest.webmanifest` describes the app and `sw.js` is a service
worker that loads pages and data from the network when online and serves the last saved copy
when offline.

## Files

| File | What it does |
|---|---|
| `tracker/config.py` | The two sources, their items (`item_id`, name, Wikipedia article), and API settings |
| `tracker/fetch.py` | Calls each source with rate-limit handling and writes the raw `.json.gz` files |
| `tracker/build.py` | Converts raw files to the common columns and writes `data/history.csv` |
| `tracker/moves.py` | The move rule: percent moves, top 5, appeared and disappeared items |
| `tracker/status.py` | Writes `data/status.json` and appends to `data/run_log.csv` |
| `tracker/issue.py` | Writes the issue text and opens/updates/closes issues through the GitHub API |
| `tracker/__main__.py` | Command line: `run`, `build`, `issue` |
| `tracker/__init__.py` | Marks `tracker` as a package |
| `tests/conftest.py` | Test setup and a helper that builds fake API responses |
| `tests/test_convert.py` | Conversion of each source to the common columns |
| `tests/test_moves.py` | The move rule |
| `tests/test_history.py` | History logic: sorting, reproducible builds, second run on the same day, failed sources, status, rate-limit retries |
| `.github/workflows/daily.yml` | Runs the pipeline every day at 13:23 UTC, opens the issue, commits the data, deploys the site |
| `.github/workflows/tests.yml` | Runs the tests on every push |
| `.github/workflows/pages.yml` | Publishes the site to GitHub Pages |
| `index.html`, `browse.html`, `trends.html` | The three pages |
| `assets/style.css` | Shared fonts, colours and layout |
| `assets/app.js` | Shared code: loading and parsing the data files, the move rule, formatting, service worker registration |
| `assets/today.js`, `assets/browse.js`, `assets/trends.js` | Page-specific code |
| `assets/scene.js` | 3D models and charts (Three.js): the film-set hero (retro TV showing today's top titles, film reels, clapperboard, popcorn, film strip) and the rotatable 3D bar charts |
| `manifest.webmanifest` | Web app manifest (makes the site installable) |
| `sw.js` | Service worker (offline support) |
| `icons/` | App icons (SVG and PNG) |
| `tools/make_icons.py` | Draws the PNG icons with the standard library |
| `data/raw/<date>/<source>.json.gz` | What each source returned on each day |
| `data/history.csv` | The history file |
| `data/status.json` | The status of the latest run |
| `data/run_log.csv` | Every source's result on every run |
| `requirements.txt` | Python packages: `requests`, `pytest` |
