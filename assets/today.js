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
    `<div class="tile"><div class="label">${esc(l)}</div><div class="value">${esc(v ?? "—")}</div></div>`).join("");

  document.getElementById("sources").innerHTML = status.sources.map(s => `
    <tr><td>${esc(s.name)}</td>
      <td><span class="pill ${s.ok ? "ok" : "fail"}">${s.ok ? "OK" : "Failed"}</span></td>
      <td class="num">${s.count}</td>
      <td class="muted small">${esc(s.error || "")}</td></tr>`).join("");

  const moves = document.getElementById("moves");
  moves.innerHTML = m.top.length ? m.top.map(c => `
    <li><span><strong>${esc(c.item)}</strong></span>
      <span>${fmtInt(c.old)} → ${fmtInt(c.new)} <strong class="${cls(c.pct)}">${fmtPct(c.pct)}</strong></span></li>`).join("")
    : `<li class="muted">No moves yet. Moves appear after the second daily run.</li>`;

  const name = id => (m.today.get(id) || m.before.get(id) || {}).item || id;
  const list = ids => ids.length ? ids.map(name).map(esc).join(", ") : "None";
  document.getElementById("appeared").innerHTML = m.prevDate ? list(m.appeared) : `All ${m.appeared.length} items (first run)`;
  document.getElementById("gone").innerHTML = list(m.disappeared);

  const pctById = new Map(m.changes.map(c => [c.item_id, c]));
  const latest = [...m.today.values()].sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
  document.getElementById("latest").innerHTML = latest.map(r => {
    const c = pctById.get(r.item_id);
    const diff = c ? c.new - c.old : null;
    return `<tr><td>${esc(r.item)}</td><td><span class="pill ${esc(r.category)}">${esc(r.category)}</span></td>
      <td class="num">${fmtInt(r.views)}</td>
      <td class="num ${cls(diff)}">${diff == null ? "—" : (diff > 0 ? "+" : "") + fmtInt(diff)}</td>
      <td class="num ${cls(c && c.pct)}">${fmtPct(c ? c.pct : null)}</td>
      <td class="num">${fmt1(r.views_7d_avg)}</td>
      <td class="muted small">${esc(r.data_date)}</td></tr>`;
  }).join("");
})();
