// Today page: last run, source status, counts, latest values and biggest moves.

(async () => {
  let data;
  try { data = await loadData(); } catch (e) { showError(e); return; }
  const { rows, status } = data;
  const runDate = status.run_date;
  const m = computeMoves(rows, runDate);

  document.getElementById("last-run").textContent = fmtTime(status.run_time);
  document.getElementById("compare").textContent = m.prevDate
    ? `Changes are measured against the previous run on ${m.prevDate}.`
    : "This is the first run, so there is nothing to compare with yet.";

  const tiles = [
    ["Days with a successful run", status.days_with_success],
    ["Items in latest run", status.items],
    ["New today", status.new_today.length],
    ["Gone today", status.gone_today.length],
    ["First run", status.first_run_date],
  ];
  document.getElementById("tiles").innerHTML = tiles.map(([l, v]) =>
    `<div class="tile reveal"><div class="label">${esc(l)}</div><div class="value${String(v).includes("-") ? " date" : ""}">${esc(v ?? "—")}</div></div>`).join("");

  document.getElementById("sources").innerHTML = status.sources.map(s => `
    <tr><td>${esc(s.name)}</td>
      <td><span class="pill ${s.ok ? "ok" : "fail"}">${s.ok ? "OK" : "Failed"}</span></td>
      <td class="num">${s.count}</td>
      <td class="muted small">${esc(s.error || "")}</td></tr>`).join("");

  const biggest = Math.max(1, ...m.top.map(c => Math.abs(c.pct)));
  document.getElementById("moves").innerHTML = m.top.length ? m.top.map(c => `
    <li class="ranked"><span class="name">${esc(c.item)}</span>
      <span class="delta">${fmtInt(c.old)} → ${fmtInt(c.new)}<strong class="${cls(c.pct)}">${fmtPct(c.pct)}</strong></span>
      <span class="bar-track"><span style="width:${Math.abs(c.pct) / biggest * 100}%;background:var(--${c.pct >= 0 ? "up" : "down"})"></span></span></li>`).join("")
    : `<li class="muted">No moves yet. Moves appear after the second daily run.</li>`;

  const name = id => (m.today.get(id) || m.before.get(id) || {}).item || id;
  const list = ids => ids.length ? ids.map(name).map(esc).join(", ") : "None";
  document.getElementById("appeared").innerHTML = m.prevDate ? list(m.appeared) : `All ${m.appeared.length} items (first run)`;
  document.getElementById("gone").innerHTML = list(m.disappeared);

  const pctById = new Map(m.changes.map(c => [c.item_id, c]));
  const latest = [...m.today.values()].sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
  const SHORT = 25;
  let showAll = false;
  const btn = document.getElementById("show-all");
  const renderLatest = () => {
    const shown = showAll ? latest : latest.slice(0, SHORT);
    document.getElementById("latest-count").textContent = `${shown.length} of ${latest.length} titles`;
    btn.hidden = latest.length <= SHORT;
    btn.textContent = showAll ? `Show top ${SHORT} only` : `Show all ${latest.length} titles`;
    document.getElementById("latest").innerHTML = rowsHTML(shown);
  };
  btn.addEventListener("click", () => { showAll = !showAll; renderLatest(); });
  const rowsHTML = list => list.map((r, i) => {
    const c = pctById.get(r.item_id);
    const diff = c ? c.new - c.old : null;
    return `<tr><td class="rank">${String(i + 1).padStart(2, "0")}</td><td><strong>${esc(r.item)}</strong></td><td><span class="pill ${esc(r.category)}">${esc(r.category)}</span></td>
      <td class="num">${fmtInt(r.views)}</td>
      <td class="num ${cls(diff)}">${diff == null ? "—" : (diff > 0 ? "+" : "") + fmtInt(diff)}</td>
      <td class="num ${cls(c && c.pct)}">${fmtPct(c ? c.pct : null)}</td>
      <td class="num">${fmt1(r.views_7d_avg)}</td>
      <td class="muted small">${esc(r.data_date)}</td></tr>`;
  }).join("");
  renderLatest();
})();
