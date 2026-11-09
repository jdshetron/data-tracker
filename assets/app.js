// Shared code for every page: loading the two data files, CSV parsing,
// the move rule (same as tracker/moves.py), formatting, and the service worker.

const NUMERIC = ["views", "views_prev_day", "views_7d_avg", "views_7d_high", "views_7d_low"];
const LABELS = {
  views: "Daily views",
  views_prev_day: "Views (day before)",
  views_7d_avg: "7-day average",
  views_7d_high: "7-day high",
  views_7d_low: "7-day low",
  change_pct: "Change since last run",
};
const TOP_N = 5;

function parseCSV(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift() || [];
  return rows.filter(r => r.length === header.length).map(r => {
    const o = {};
    header.forEach((h, i) => {
      o[h] = NUMERIC.includes(h) ? (r[i] === "" ? null : Number(r[i])) : r[i];
    });
    return o;
  });
}

let dataPromise = null;
function loadData() {   // fetched once per page; every caller shares the result
  return dataPromise || (dataPromise = fetchData());
}

async function fetchData() {
  const [histText, status] = await Promise.all([
    fetch("data/history.csv", { cache: "no-store" }).then(r => { if (!r.ok) throw new Error(r.status); return r.text(); }),
    fetch("data/status.json", { cache: "no-store" }).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }),
  ]);
  const rows = parseCSV(histText);
  const dates = [...new Set(rows.map(r => r.date))].sort();
  return { rows, status, dates };
}

// The move rule: percent change in `views` since the previous date in the history.
function computeMoves(rows, date) {
  const earlier = [...new Set(rows.map(r => r.date))].filter(d => d < date).sort();
  const prevDate = earlier.length ? earlier[earlier.length - 1] : null;
  const today = new Map(rows.filter(r => r.date === date).map(r => [r.item_id, r]));
  const before = new Map(rows.filter(r => r.date === prevDate).map(r => [r.item_id, r]));
  const changes = [];
  for (const [id, r] of today) {
    const p = before.get(id);
    if (!p || p.views == null || r.views == null || p.views === 0) continue;
    changes.push({ item_id: id, item: r.item, old: p.views, new: r.views, pct: Math.round((r.views - p.views) / p.views * 10000) / 100 });
  }
  changes.sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct) || a.item_id.localeCompare(b.item_id));
  return {
    date, prevDate, changes, top: changes.slice(0, TOP_N),
    appeared: [...today.keys()].filter(k => !before.has(k)).sort(),
    disappeared: [...before.keys()].filter(k => !today.has(k)).sort(),
    today, before,
  };
}

// What the 3D TV's screen cycles through: the day's most-viewed titles.
async function screenItems(n = 8) {
  const { rows, status } = await loadData();
  const m = computeMoves(rows, status.run_date);
  const pct = new Map(m.changes.map(c => [c.item_id, c.pct]));
  return [...m.today.values()].sort((a, b) => (b.views ?? 0) - (a.views ?? 0)).slice(0, n).map((r, i) => ({
    kicker: `#${i + 1} today · ${r.category === "TV" ? "TV show" : "Movie"}`.toUpperCase(),
    title: r.item.toUpperCase(),
    value: `${fmtInt(r.views)} views`,
    change: pct.has(r.item_id) ? `${fmtPct(pct.get(r.item_id))} since last run` : "",
    up: (pct.get(r.item_id) ?? 0) > 0,
  }));
}

function tipHTML(title, lines) {
  return `<strong>${esc(title)}</strong>${lines.join("<br>")}`;
}

const fmtInt =n => n == null ? "—" : Math.round(n).toLocaleString("en-US");
const fmt1 = n => n == null ? "—" : n.toLocaleString("en-US", { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const fmtPct = n => n == null ? "—" : `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
const cls = n => n == null || n === 0 ? "" : n > 0 ? "up" : "down";
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function fmtTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })} (${iso.replace("T", " ").replace("Z", " UTC")})`;
}

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// A palette that reads in both light and dark mode, for many-series charts.
const PALETTE = ["#ffc94d", "#4cc9f0", "#fb7185", "#a78bfa", "#4ade80", "#f97316", "#38bdf8", "#f472b6", "#facc15", "#2dd4bf", "#c084fc", "#fda4af", "#93c5fd", "#bef264"];

function chartDefaults() {
  if (!window.Chart) return;
  Chart.defaults.color = cssVar("--muted");
  Chart.defaults.borderColor = cssVar("--border");
  Chart.defaults.font.family = cssVar("--font");
  Chart.defaults.maintainAspectRatio = false;
  Chart.defaults.layout.padding = { left: 10, right: 10 };
  Chart.defaults.borderColor = "rgba(255,255,255,.07)";
  Chart.defaults.elements.bar.borderRadius = 5;
}

function showError(err) {
  const el = document.getElementById("error");
  if (el) { el.hidden = false; el.textContent = `Could not load the data files (${err.message || err}). If you are offline, open the site once while online first.`; }
}

function showOfflineBanner() {
  const el = document.getElementById("offline");
  if (!el) return;
  const update = () => { el.hidden = navigator.onLine; };
  window.addEventListener("online", update);
  window.addEventListener("offline", update);
  update();
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
document.addEventListener("DOMContentLoaded", showOfflineBanner);
