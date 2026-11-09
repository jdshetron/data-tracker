// Browse page: latest values with filters, search, sort and a saved shortlist.

const STAR_KEY = "tv-movie-tracker.shortlist";
const loadStars = () => { try { return new Set(JSON.parse(localStorage.getItem(STAR_KEY) || "[]")); } catch { return new Set(); } };
const saveStars = s => { try { localStorage.setItem(STAR_KEY, JSON.stringify([...s])); } catch { /* storage blocked */ } };

const SORT_COLS = [...NUMERIC, "change_pct"];
const state = { q: "", category: "", trend: "", minViews: "", starredOnly: false, sort: "views", dir: "desc" };
let items = [];
let stars = loadStars();

function render() {
  const q = state.q.trim().toLowerCase();
  const min = state.minViews === "" ? null : Number(state.minViews);
  let list = items.filter(r =>
    (!q || r.item.toLowerCase().includes(q)) &&
    (!state.category || r.category === state.category) &&
    (!state.trend || (state.trend === "up" ? r.change_pct > 0 : state.trend === "down" ? r.change_pct < 0 : r.change_pct == null || r.change_pct === 0)) &&
    (min == null || (r.views ?? 0) >= min) &&
    (!state.starredOnly || stars.has(r.item_id)));
  const k = state.sort, d = state.dir === "asc" ? 1 : -1;
  list.sort((a, b) => {
    const x = a[k], y = b[k];
    if (x == null && y == null) return a.item.localeCompare(b.item);
    if (x == null) return 1;
    if (y == null) return -1;
    return (x - y) * d || a.item.localeCompare(b.item);
  });

  document.getElementById("count").textContent = `${list.length} of ${items.length} items`;
  document.getElementById("rows").innerHTML = list.map(r => `
    <tr>
      <td><button class="star ${stars.has(r.item_id) ? "on" : ""}" data-id="${esc(r.item_id)}" aria-pressed="${stars.has(r.item_id)}" aria-label="Star ${esc(r.item)}" title="Add to shortlist">${stars.has(r.item_id) ? "★" : "☆"}</button></td>
      <td><a href="https://en.wikipedia.org/wiki/${encodeURIComponent(r.article)}" target="_blank" rel="noopener">${esc(r.item)}</a></td>
      <td><span class="pill ${esc(r.category)}">${esc(r.category)}</span></td>
      <td class="num">${fmtInt(r.views)}</td>
      <td class="num">${fmtInt(r.views_prev_day)}</td>
      <td class="num">${fmt1(r.views_7d_avg)}</td>
      <td class="num">${fmtInt(r.views_7d_high)}</td>
      <td class="num">${fmtInt(r.views_7d_low)}</td>
      <td class="num ${cls(r.change_pct)}">${fmtPct(r.change_pct)}</td>
    </tr>`).join("") || `<tr><td colspan="9" class="muted">No items match these filters.</td></tr>`;

  document.querySelectorAll("th.sortable").forEach(th => {
    const on = th.dataset.col === state.sort;
    th.setAttribute("aria-sort", on ? (state.dir === "asc" ? "ascending" : "descending") : "none");
    th.querySelector(".arrow").textContent = on ? (state.dir === "asc" ? " ▲" : " ▼") : "";
  });
  document.getElementById("sort").value = `${state.sort}:${state.dir}`;

  const short = items.filter(r => stars.has(r.item_id));
  document.getElementById("shortlist").innerHTML = short.length
    ? short.map(r => `<li><span>${esc(r.item)}</span><span>${fmtInt(r.views)} views</span></li>`).join("")
    : `<li class="muted">Star an item (☆) to add it to your shortlist. It is saved in this browser.</li>`;
}

(async () => {
  let data;
  try { data = await loadData(); } catch (e) { showError(e); return; }
  const m = computeMoves(data.rows, data.status.run_date);
  const pct = new Map(m.changes.map(c => [c.item_id, c.pct]));
  items = [...m.today.values()].map(r => ({ ...r, change_pct: pct.has(r.item_id) ? pct.get(r.item_id) : null }));
  document.getElementById("as-of").textContent = `Latest run: ${data.status.run_date}`;

  const sortSel = document.getElementById("sort");
  sortSel.innerHTML = SORT_COLS.flatMap(c => [
    `<option value="${c}:desc">${LABELS[c]} — high to low</option>`,
    `<option value="${c}:asc">${LABELS[c]} — low to high</option>`]).join("");

  const bind = (id, key, ev = "input", get = el => el.value) =>
    document.getElementById(id).addEventListener(ev, e => { state[key] = get(e.target); render(); });
  bind("q", "q");
  bind("category", "category", "change");
  bind("trend", "trend", "change");
  bind("min-views", "minViews");
  bind("starred", "starredOnly", "change", el => el.checked);
  sortSel.addEventListener("change", e => { [state.sort, state.dir] = e.target.value.split(":"); render(); });
  document.querySelectorAll("th.sortable").forEach(th => th.addEventListener("click", () => {
    if (state.sort === th.dataset.col) state.dir = state.dir === "asc" ? "desc" : "asc";
    else { state.sort = th.dataset.col; state.dir = "desc"; }
    render();
  }));
  document.getElementById("rows").addEventListener("click", e => {
    const b = e.target.closest(".star");
    if (!b) return;
    const id = b.dataset.id;
    stars.has(id) ? stars.delete(id) : stars.add(id);
    saveStars(stars);
    render();
  });
  render();
})();
