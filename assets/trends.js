// Trends page: every number here is computed in the browser from data/history.csv.

const charts = {};
function draw(id, config) {
  if (charts[id]) charts[id].destroy();
  charts[id] = new Chart(document.getElementById(id), config);
}
const set = (id, html) => { document.getElementById(id).innerHTML = html; };
const byDate = (rows, d) => rows.filter(r => r.date === d);
const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
const median = xs => { const s = [...xs].sort((a, b) => a - b); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const colorFor = cat => cat === "TV" ? cssVar("--tv") : cssVar("--movie");
const barOpts = (horizontal, unit = "") => ({
  indexAxis: horizontal ? "y" : "x",
  plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${c.formattedValue}${unit}` } } },
  scales: { [horizontal ? "x" : "y"]: { ticks: { callback: v => `${Number(v).toLocaleString()}${unit}` } } },
});

// ---------- Section 0: every numeric value over the days, with an item picker ----------
function overTime(rows, dates) {
  const items = [...new Map(rows.map(r => [r.item_id, r])).values()].sort((a, b) => a.item.localeCompare(b.item));
  const latest = new Map(byDate(rows, dates[dates.length - 1]).map(r => [r.item_id, r.views ?? 0]));
  const topIds = [...latest.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(e => e[0]);
  const chosen = new Set(topIds);
  const metricSel = document.getElementById("metric");
  metricSel.innerHTML = NUMERIC.map(c => `<option value="${c}">${LABELS[c]}</option>`).join("");
  const picker = document.getElementById("picker");
  const renderPicker = () => {
    picker.innerHTML = items.map(r => `<label><input type="checkbox" value="${esc(r.item_id)}" ${chosen.has(r.item_id) ? "checked" : ""}> ${esc(r.item)}</label>`).join("");
  };
  const render = () => {
    const metric = metricSel.value;
    const lookup = new Map(rows.map(r => [`${r.date}|${r.item_id}`, r[metric]]));
    const shown = items.filter(r => chosen.has(r.item_id));
    draw("chart-over-time", {
      type: "line",
      data: {
        labels: dates,
        datasets: shown.map((r, i) => ({
          label: r.item, data: dates.map(d => lookup.get(`${d}|${r.item_id}`) ?? null),
          borderColor: PALETTE[items.indexOf(r) % PALETTE.length], backgroundColor: PALETTE[items.indexOf(r) % PALETTE.length],
          tension: .25, spanGaps: true, pointRadius: dates.length < 15 ? 4 : 2,
        })),
      },
      options: { interaction: { mode: "nearest", intersect: false }, scales: { y: { title: { display: true, text: LABELS[metric] } } } },
    });
  };
  metricSel.addEventListener("change", render);
  picker.addEventListener("change", e => { e.target.checked ? chosen.add(e.target.value) : chosen.delete(e.target.value); render(); });
  const setAll = ids => { chosen.clear(); ids.forEach(id => chosen.add(id)); renderPicker(); render(); };
  document.getElementById("pick-all").onclick = () => setAll(items.map(r => r.item_id));
  document.getElementById("pick-none").onclick = () => setAll([]);
  document.getElementById("pick-top").onclick = () => setAll(topIds);
  document.getElementById("pick-tv").onclick = () => setAll(items.filter(r => r.category === "TV").map(r => r.item_id));
  document.getElementById("pick-movie").onclick = () => setAll(items.filter(r => r.category === "Movie").map(r => r.item_id));
  renderPicker();
  render();
}

// ---------- Finding 1: biggest riser and faller since the first run ----------
function riseFall(rows, dates) {
  const first = dates[0], last = dates[dates.length - 1];
  const firstRow = new Map(), lastRow = new Map();
  for (const r of rows) {
    if (r.views_7d_avg == null) continue;
    if (!firstRow.has(r.item_id) || r.date < firstRow.get(r.item_id).date) firstRow.set(r.item_id, r);
    if (!lastRow.has(r.item_id) || r.date > lastRow.get(r.item_id).date) lastRow.set(r.item_id, r);
  }
  const ch = [...lastRow.values()]
    .filter(r => firstRow.get(r.item_id).date !== r.date && firstRow.get(r.item_id).views_7d_avg > 0)
    .map(r => { const f = firstRow.get(r.item_id); return { item: r.item, cat: r.category, from: f.views_7d_avg, to: r.views_7d_avg, fromDate: f.date, toDate: r.date, pct: (r.views_7d_avg - f.views_7d_avg) / f.views_7d_avg * 100 }; })
    .sort((a, b) => b.pct - a.pct);
  const how = `How it's computed: for each item, take <code>views_7d_avg</code> on the first date the item appears in the history and on the latest date, then (latest − first) ÷ first × 100.`;
  if (!ch.length) {
    set("f1-h", `Rises and falls will show after the second daily run`);
    set("f1-p", `The history has ${dates.length} run date${dates.length === 1 ? "" : "s"} (${first}${dates.length > 1 ? ` to ${last}` : ""}), so no item has two dates to compare yet.`);
    set("f1-how", how);
    draw("f1-chart", { type: "bar", data: { labels: [], datasets: [{ data: [] }] }, options: barOpts(true, "%") });
    return;
  }
  const up = ch[0], down = ch[ch.length - 1];
  set("f1-h", `${esc(up.item)} rose the most since the first run (${fmtPct(up.pct)}); ${esc(down.item)} fell the most (${fmtPct(down.pct)})`);
  set("f1-p", `${esc(up.item)}'s 7-day average went from ${fmt1(up.from)} views a day on ${up.fromDate} to ${fmt1(up.to)} on ${up.toDate}. ${esc(down.item)} went from ${fmt1(down.from)} to ${fmt1(down.to)}. ` +
    `${ch.filter(c => c.pct > 0).length} of ${ch.length} items are up and ${ch.filter(c => c.pct < 0).length} are down; the median change is ${fmtPct(median(ch.map(c => c.pct)))}.`);
  set("f1-how", how);
  draw("f1-chart", {
    type: "bar",
    data: { labels: ch.map(c => c.item), datasets: [{ data: ch.map(c => +c.pct.toFixed(2)), backgroundColor: ch.map(c => c.pct >= 0 ? cssVar("--up") : cssVar("--down")) }] },
    options: barOpts(true, "%"),
  });
}

// ---------- Finding 2: the day with the biggest moves ----------
function biggestDay(rows, dates) {
  const perDay = dates.map(d => {
    const ms = byDate(rows, d).filter(r => r.views != null && r.views_prev_day > 0)
      .map(r => ({ item: r.item, pct: (r.views - r.views_prev_day) / r.views_prev_day * 100, dataDate: r.data_date }));
    const top = ms.reduce((a, b) => (!a || Math.abs(b.pct) > Math.abs(a.pct) ? b : a), null);
    return { date: d, n: ms.length, avg: ms.length ? mean(ms.map(m => Math.abs(m.pct))) : null, top };
  }).filter(x => x.avg != null);
  const best = perDay.reduce((a, b) => (!a || b.avg > a.avg ? b : a), null);
  set("f2-how", `How it's computed: for every row, the day-over-day move is (<code>views</code> − <code>views_prev_day</code>) ÷ <code>views_prev_day</code> × 100. For each run date, the chart shows the average of the absolute moves across all items on that date.`);
  if (!best) { set("f2-h", "No day-over-day moves yet"); set("f2-p", "No rows have both views and views_prev_day."); return; }
  set("f2-h", `The run on ${best.date} caught the biggest moves: items changed ${best.avg.toFixed(1)}% on average`);
  set("f2-p", `On that run (views for ${best.top.dataDate}), the average item's daily views moved ${best.avg.toFixed(1)}% from the day before, across ${best.n} items. The single biggest move was ${esc(best.top.item)} at ${fmtPct(best.top.pct)}. ` +
    `Across all ${perDay.length} run date${perDay.length === 1 ? "" : "s"}, the average daily move is ${mean(perDay.map(p => p.avg)).toFixed(1)}%.`);
  draw("f2-chart", {
    type: "bar",
    data: { labels: perDay.map(p => p.date), datasets: [{ data: perDay.map(p => +p.avg.toFixed(2)), backgroundColor: perDay.map(p => p === best ? cssVar("--accent") : cssVar("--muted")) }] },
    options: barOpts(false, "%"),
  });
}

// ---------- Finding 3: how far apart the items are ----------
function spread(rows, dates) {
  const last = dates[dates.length - 1];
  const r = byDate(rows, last).filter(x => x.views_7d_avg != null).sort((a, b) => b.views_7d_avg - a.views_7d_avg);
  const total = r.reduce((s, x) => s + x.views_7d_avg, 0);
  const top3 = r.slice(0, 3).reduce((s, x) => s + x.views_7d_avg, 0);
  const hi = r[0], lo = r[r.length - 1];
  set("f3-h", `${esc(hi.item)} gets ${(hi.views_7d_avg / lo.views_7d_avg).toFixed(1)}× the daily views of ${esc(lo.item)}`);
  set("f3-p", `On the latest run (${last}), ${esc(hi.item)} averages ${fmt1(hi.views_7d_avg)} views a day over the last 7 days, while ${esc(lo.item)} averages ${fmt1(lo.views_7d_avg)}. ` +
    `The top 3 items take ${(top3 / total * 100).toFixed(1)}% of the ${fmtInt(total)} daily views across all ${r.length} items; the median item gets ${fmt1(median(r.map(x => x.views_7d_avg)))}.`);
  set("f3-how", `How it's computed: rows with <code>date</code> = ${last}, sorted by <code>views_7d_avg</code>. The ratio is the highest divided by the lowest; the share is the sum of the top 3 divided by the sum of all items.`);
  draw("f3-chart", {
    type: "bar",
    data: { labels: r.map(x => x.item), datasets: [{ data: r.map(x => x.views_7d_avg), backgroundColor: r.map(x => colorFor(x.category)) }] },
    options: barOpts(true),
  });
}

// ---------- Finding 4: TV shows vs movies ----------
function tvVsMovies(rows, dates) {
  const sums = dates.map(d => {
    const r = byDate(rows, d);
    const tv = r.filter(x => x.category === "TV").reduce((s, x) => s + (x.views ?? 0), 0);
    const mv = r.filter(x => x.category === "Movie").reduce((s, x) => s + (x.views ?? 0), 0);
    return { d, tv, mv, ntv: r.filter(x => x.category === "TV").length, nmv: r.filter(x => x.category === "Movie").length };
  });
  const last = sums[sums.length - 1];
  const share = last.tv / (last.tv + last.mv) * 100;
  const leader = share >= 50 ? "TV shows" : "Movies";
  const avgShare = mean(sums.filter(s => s.tv + s.mv > 0).map(s => s.tv / (s.tv + s.mv) * 100));
  set("f4-h", `${leader} draw ${(share >= 50 ? share : 100 - share).toFixed(1)}% of tracked views on the latest run`);
  set("f4-p", `On ${last.d}, the ${last.ntv} TV shows had ${fmtInt(last.tv)} views and the ${last.nmv} movies had ${fmtInt(last.mv)}, ` +
    `or ${fmtInt(last.tv / Math.max(last.ntv, 1))} vs ${fmtInt(last.mv / Math.max(last.nmv, 1))} per title. Over all ${sums.length} run date${sums.length === 1 ? "" : "s"}, TV's share averages ${avgShare.toFixed(1)}%.`);
  set("f4-how", `How it's computed: for each run date, the sum of <code>views</code> for rows with <code>category</code> = TV and for rows with <code>category</code> = Movie. The share is TV ÷ (TV + Movie).`);
  draw("f4-chart", {
    type: "bar",
    data: { labels: sums.map(s => s.d), datasets: [
      { label: "TV", data: sums.map(s => s.tv), backgroundColor: cssVar("--tv") },
      { label: "Movies", data: sums.map(s => s.mv), backgroundColor: cssVar("--movie") }] },
    options: { plugins: { legend: { display: true } } },
  });
}

// ---------- Finding 5: which items swing the most within a week ----------
function volatility(rows, dates) {
  const last = dates[dates.length - 1];
  const r = byDate(rows, last).filter(x => x.views_7d_avg > 0)
    .map(x => ({ item: x.item, cat: x.category, hi: x.views_7d_high, lo: x.views_7d_low, avg: x.views_7d_avg, swing: (x.views_7d_high - x.views_7d_low) / x.views_7d_avg * 100 }))
    .sort((a, b) => b.swing - a.swing);
  const top = r[0], calm = r[r.length - 1];
  set("f5-h", `${esc(top.item)} has the most uneven week: its daily views swing ${top.swing.toFixed(0)}% of its average`);
  set("f5-p", `In the 7 days up to the latest run (${last}), ${esc(top.item)} ranged from ${fmtInt(top.lo)} to ${fmtInt(top.hi)} views a day around an average of ${fmt1(top.avg)}. ` +
    `The steadiest title is ${esc(calm.item)}, with a swing of ${calm.swing.toFixed(0)}% (${fmtInt(calm.lo)} to ${fmtInt(calm.hi)}). The median swing is ${median(r.map(x => x.swing)).toFixed(0)}%.`);
  set("f5-how", `How it's computed: rows with <code>date</code> = ${last}; swing = (<code>views_7d_high</code> − <code>views_7d_low</code>) ÷ <code>views_7d_avg</code> × 100.`);
  draw("f5-chart", {
    type: "bar",
    data: { labels: r.map(x => x.item), datasets: [{ data: r.map(x => +x.swing.toFixed(1)), backgroundColor: r.map(x => colorFor(x.cat)) }] },
    options: barOpts(true, "%"),
  });
}

(async () => {
  let data;
  try { data = await loadData(); } catch (e) { showError(e); return; }
  chartDefaults();
  const { rows, dates } = data;
  document.getElementById("span").textContent =
    `${rows.length} rows in data/history.csv, covering ${dates.length} run date${dates.length === 1 ? "" : "s"} (${dates[0]} to ${dates[dates.length - 1]}).`;
  overTime(rows, dates);
  riseFall(rows, dates);
  biggestDay(rows, dates);
  spread(rows, dates);
  tvVsMovies(rows, dates);
  volatility(rows, dates);
})();
