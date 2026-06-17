import fs from "node:fs";
import path from "node:path";

const logsDir = path.resolve("fixtures/log");
const outFile = path.resolve("fixtures/log/render-scale-report.html");

const files = fs
  .readdirSync(logsDir)
  .filter((name) => name.endsWith("-render-log.txt"))
  .sort();

const ROAD_TYPES = ["Motorway", "Primary", "Secondary", "Tertiary", "Residential", "Default"];
const MAIN_STAGES = [
  "draw_background",
  "draw_water",
  "draw_parks",
  "draw_roads",
  "draw_pois",
  "draw_gradients",
  "draw_text",
  "encode_png",
];

function parseLog(fileName) {
  const fullPath = path.join(logsDir, fileName);
  const text = fs.readFileSync(fullPath, "utf8");
  const lines = text.split(/\r?\n/);
  const meta = {};
  const metrics = {
    roadsBreakdown: {},
    roadsCasing: {},
    roadsFill: {},
    roadsPoints: {},
    roadPhases: {},
    mainStages: {},
  };

  for (const line of lines) {
    if (!line) continue;
    const metaMatch = line.match(/^([a-z_]+)=(.+)$/);
    if (metaMatch) {
      meta[metaMatch[1]] = metaMatch[2];
      continue;
    }

    let m = line.match(/\[Timing\]\[wasm\]\[renderer_new\].*render_scale=(\d+).*total_pixels=(\d+).*main_pixmap_bytes=(\d+)/);
    if (m) {
      metrics.rendererScale = Number(m[1]);
      metrics.totalPixels = Number(m[2]);
      metrics.mainPixmapBytes = Number(m[3]);
      continue;
    }

    m = line.match(/\[Timing\]\[wasm\]\[render_map_binary_internal_total\] total=([\d.]+)ms/);
    if (m) {
      metrics.renderTotal = Number(m[1]);
      continue;
    }

    m = line.match(/\[Timing\]\[render\]\[poster\] total=(\d+)ms/);
    if (m) {
      metrics.poster = Number(m[1]);
      continue;
    }

    m = line.match(/\[Timing\]\[generation\]\[total\] total=(\d+)ms/);
    if (m) {
      metrics.generation = Number(m[1]);
      continue;
    }

    m = line.match(/\[Timing\]\[mapData\]\[getMapData\] total=(\d+)ms cacheLevel=([^\s]+)/);
    if (m) {
      metrics.mapData = Number(m[1]);
      metrics.cacheLevel = m[2];
      continue;
    }

    m = line.match(/\[Timing\]\[processing\]\[wasmAll\] total=(\d+)ms/);
    if (m) {
      metrics.wasmAll = Number(m[1]);
      continue;
    }

    m = line.match(/\[Timing\]\[processing\]\[prepareRenderConfig\] total=(\d+)ms/);
    if (m) {
      metrics.prepareRenderConfig = Number(m[1]);
      continue;
    }

    m = line.match(/render_map_bin: (draw_[a-z_]+): ([\d.]+) ms/);
    if (m) {
      metrics.mainStages[m[1]] = Number(m[2]);
      continue;
    }

    m = line.match(/\[Timing\]\[wasm\]\[encode_png\]\[downsample_rgba\] total=([\d.]+)ms.*out_rgba_bytes=(\d+).*raw_rgba_bytes=(\d+)/);
    if (m) {
      metrics.downsample = Number(m[1]);
      metrics.outRgbaBytes = Number(m[2]);
      metrics.rawRgbaBytes = Number(m[3]);
      continue;
    }

    m = line.match(/\[Timing\]\[wasm\]\[encode_png\]\[png_encode\] total=([\d.]+)ms raw_png_bytes=(\d+)/);
    if (m) {
      metrics.pngEncode = Number(m[1]);
      metrics.rawPngBytes = Number(m[2]);
      continue;
    }

    m = line.match(/\[Memory\]\[wasm\]\[encode_png\] final_png_bytes=(\d+)/);
    if (m) {
      metrics.finalPngBytes = Number(m[1]);
      continue;
    }
  }

  const sectionIndices = {};
  lines.forEach((line, idx) => {
    if (line.includes("render_map_bin: draw_roads breakdown:")) sectionIndices.breakdown = idx;
    if (line.includes("render_map_bin: draw_roads casing breakdown:")) sectionIndices.casing = idx;
    if (line.includes("render_map_bin: draw_roads fill breakdown:")) sectionIndices.fill = idx;
    if (line.includes("render_map_bin: draw_roads points:")) sectionIndices.points = idx;
    if (line.includes("render_map_bin: draw_roads phases:")) sectionIndices.phases = idx;
  });

  function parseIndentedMap(startIdx, target, kind) {
    if (startIdx == null) return;
    for (let i = startIdx + 1; i < lines.length; i += 1) {
      const line = lines[i];
      if (!line.includes("[Worker][poster] [log]   ")) break;
      if (kind === "points") {
        const pm = line.match(/\s+([A-Za-z]+): (\d+) -> (\d+) points \(([\d.]+)% reduced\)/);
        if (pm) {
          target[pm[1]] = {
            raw: Number(pm[2]),
            simplified: Number(pm[3]),
            reducedPct: Number(pm[4]),
          };
        }
      } else {
        const mm = line.match(/\s+([A-Za-z_]+): ([\d.]+)ms/);
        if (mm) target[mm[1]] = Number(mm[2]);
      }
    }
  }

  parseIndentedMap(sectionIndices.phases, metrics.roadPhases, "timing");
  parseIndentedMap(sectionIndices.breakdown, metrics.roadsBreakdown, "timing");
  parseIndentedMap(sectionIndices.casing, metrics.roadsCasing, "timing");
  parseIndentedMap(sectionIndices.fill, metrics.roadsFill, "timing");
  parseIndentedMap(sectionIndices.points, metrics.roadsPoints, "points");

  const renderScaleConfig = JSON.parse(meta.render_scale_config);
  const roadValues = Object.values(renderScaleConfig.roads);
  const allRoad1x = roadValues.every((v) => v === 1);
  const allRoad2x = roadValues.every((v) => v === 2);
  let sampleLabel = "Mixed";
  if (allRoad1x && renderScaleConfig.background === 1 && renderScaleConfig.text === 1) sampleLabel = "All 1x";
  if (allRoad2x && renderScaleConfig.background === 2 && renderScaleConfig.text === 2) sampleLabel = "All 2x";
  if (
    renderScaleConfig.roads.motorway === 2 &&
    renderScaleConfig.roads.primary === 2 &&
    renderScaleConfig.roads.secondary === 1 &&
    renderScaleConfig.roads.tertiary === 1 &&
    renderScaleConfig.roads.residential === 1 &&
    renderScaleConfig.roads.default === 1
  ) sampleLabel = "Motorway+Primary 2x";

  return {
    fileName,
    meta,
    metrics,
    renderScaleConfig,
    exportScale: Number(meta.export_resolution_scale),
    sampleLabel,
    key: `${sampleLabel} / Export ${meta.export_resolution_label}`,
  };
}

const reports = files.map(parseLog);

const order = [
  "All 1x / Export 1x",
  "All 1x / Export 2x",
  "All 2x / Export 1x",
  "All 2x / Export 2x",
  "Motorway+Primary 2x / Export 1x",
  "Motorway+Primary 2x / Export 2x",
];
reports.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));

function fmtMs(v) {
  if (v == null) return "-";
  return v >= 1000 ? `${(v / 1000).toFixed(2)}s` : `${v.toFixed ? v.toFixed(1) : v}ms`;
}
function fmtInt(v) {
  return new Intl.NumberFormat("en-US").format(v);
}
function fmtMb(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}
function pct(delta, base) {
  if (!base) return "-";
  const n = (delta / base) * 100;
  return `${n > 0 ? "+" : ""}${n.toFixed(1)}%`;
}

const baseline = reports.find((r) => r.key === "All 1x / Export 1x");
const worst = reports.reduce((acc, item) => (item.metrics.renderTotal > acc.metrics.renderTotal ? item : acc), reports[0]);

function makeScenarioTableRows() {
  return reports
    .map((r) => {
      const delta = r.metrics.renderTotal - baseline.metrics.renderTotal;
      return `<tr>
        <td>${r.key}</td>
        <td>${fmtMs(r.metrics.renderTotal)}</td>
        <td>${fmtMs(r.metrics.poster)}</td>
        <td>${fmtMs(r.metrics.generation)}</td>
        <td>${r.metrics.rendererScale}x</td>
        <td>${fmtInt(r.metrics.totalPixels)}</td>
        <td>${fmtMb(r.metrics.mainPixmapBytes)}</td>
        <td>${pct(delta, baseline.metrics.renderTotal)}</td>
      </tr>`;
    })
    .join("");
}

function makeStageTableRows() {
  return MAIN_STAGES.map((stage) => {
    const cells = reports
      .map((r) => `<td>${fmtMs(r.metrics.mainStages[stage])}</td>`)
      .join("");
    return `<tr><td>${stage}</td>${cells}</tr>`;
  }).join("");
}

function makeRoadRows(kind) {
  return ROAD_TYPES.map((type) => {
    const cells = reports.map((r) => {
      const source =
        kind === "total" ? r.metrics.roadsBreakdown : kind === "casing" ? r.metrics.roadsCasing : r.metrics.roadsFill;
      return `<td>${fmtMs(source[type])}</td>`;
    }).join("");
    return `<tr><td>${type}</td>${cells}</tr>`;
  }).join("");
}

function makePointRows() {
  return ROAD_TYPES.map((type) => {
    const cells = reports.map((r) => {
      const p = r.metrics.roadsPoints[type];
      return `<td>${fmtInt(p.raw)} -> ${fmtInt(p.simplified)}<br><span class="muted">${p.reducedPct.toFixed(1)}%</span></td>`;
    }).join("");
    return `<tr><td>${type}</td>${cells}</tr>`;
  }).join("");
}

function chartDatasetFor(metricAccessor, colorPalette) {
  return reports.map((report, idx) => ({
    label: report.key,
    data: metricAccessor(report),
    backgroundColor: colorPalette[idx],
    borderRadius: 4,
  }));
}

const colors = ["#264653", "#2A9D8F", "#E9C46A", "#F4A261", "#E76F51", "#8E5A9F"];

const html = `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Render Scale Report</title>
  <style>
    :root {
      --bg: #f5f1e8;
      --card: #fffdf8;
      --ink: #1f2937;
      --muted: #6b7280;
      --line: #d8d2c3;
      --accent: #0f6e56;
      --accent2: #a32d2d;
      --shadow: 0 10px 30px rgba(0,0,0,.06);
      --radius: 16px;
    }
    * { box-sizing: border-box; }
    body { margin:0; font-family: "Segoe UI", "PingFang SC", sans-serif; background: radial-gradient(circle at top right, #efe4c8, transparent 30%), var(--bg); color:var(--ink); }
    .wrap { max-width: 1500px; margin: 0 auto; padding: 32px 24px 64px; }
    h1 { font-size: 34px; margin: 0 0 8px; }
    h2 { font-size: 22px; margin: 0 0 16px; }
    p.lead { color: var(--muted); max-width: 900px; line-height: 1.65; margin: 0 0 28px; }
    .grid { display:grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 14px; margin-bottom: 26px; }
    .card { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); padding: 18px 18px 16px; }
    .stat-label { font-size: 12px; color: var(--muted); margin-bottom: 8px; text-transform: uppercase; letter-spacing: .04em; }
    .stat-value { font-size: 28px; font-weight: 700; margin-bottom: 4px; }
    .stat-sub { font-size: 13px; color: var(--muted); line-height: 1.5; }
    .section { margin-top: 28px; }
    .charts-2 { display:grid; grid-template-columns: 1.2fr .8fr; gap: 16px; }
    .charts-1 { display:grid; grid-template-columns: 1fr; gap: 16px; }
    .chart-card { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); padding: 18px; }
    .chart-box { position: relative; width: 100%; height: 360px; }
    .chart-box.tall { height: 480px; }
    table { width:100%; border-collapse: collapse; font-size: 13px; }
    th, td { border-bottom: 1px solid var(--line); padding: 10px 8px; text-align: left; vertical-align: top; }
    th { font-size: 12px; color: var(--muted); font-weight: 600; background: rgba(0,0,0,.02); position: sticky; top: 0; }
    .table-card { background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); padding: 0; overflow:auto; }
    .table-head { padding: 18px 18px 0; }
    .muted { color: var(--muted); }
    .note { font-size: 13px; color: var(--muted); line-height: 1.65; }
    .badge { display:inline-block; padding: 4px 8px; border-radius: 999px; background:#efe8d8; color:#574b38; font-size:12px; margin-right:8px; }
    .legend { display:flex; flex-wrap:wrap; gap:10px 14px; margin: 8px 0 16px; font-size: 12px; color: var(--muted); }
    .legend span { display:flex; align-items:center; gap:6px; }
    .dot { width:10px; height:10px; border-radius:2px; }
    @media (max-width: 1100px) {
      .grid { grid-template-columns: repeat(2,minmax(0,1fr)); }
      .charts-2 { grid-template-columns: 1fr; }
    }
    @media (max-width: 640px) {
      .grid { grid-template-columns: 1fr; }
      h1 { font-size: 28px; }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>Render Scale × Export Resolution 报告</h1>
    <p class="lead">本报告比较 6 组导出组合：3 套采样配置（All 1x / All 2x / Motorway+Primary 2x）与 2 档导出分辨率（1x / 2x）。重点覆盖总体 wall-clock、WASM 主链路、渲染阶段、道路细分、点数简化、编码与内存占用。</p>

    <div class="grid">
      <div class="card">
        <div class="stat-label">最快方案</div>
        <div class="stat-value">${baseline.key}</div>
        <div class="stat-sub">WASM 渲染 ${fmtMs(baseline.metrics.renderTotal)}，总生成 ${fmtMs(baseline.metrics.generation)}</div>
      </div>
      <div class="card">
        <div class="stat-label">最慢方案</div>
        <div class="stat-value">${worst.key}</div>
        <div class="stat-sub">WASM 渲染 ${fmtMs(worst.metrics.renderTotal)}，比最快慢 ${pct(worst.metrics.renderTotal - baseline.metrics.renderTotal, baseline.metrics.renderTotal)}</div>
      </div>
      <div class="card">
        <div class="stat-label">2x 统一采样代价</div>
        <div class="stat-value">${fmtMs(reports.find(r => r.key === "All 2x / Export 2x").metrics.renderTotal)}</div>
        <div class="stat-sub">相对 All 1x / Export 1x 增加 ${pct(reports.find(r => r.key === "All 2x / Export 2x").metrics.renderTotal - baseline.metrics.renderTotal, baseline.metrics.renderTotal)}</div>
      </div>
      <div class="card">
        <div class="stat-label">混合采样代价</div>
        <div class="stat-value">${fmtMs(reports.find(r => r.key === "Motorway+Primary 2x / Export 1x").metrics.renderTotal)}</div>
        <div class="stat-sub">相对 All 1x / Export 1x 增加 ${pct(reports.find(r => r.key === "Motorway+Primary 2x / Export 1x").metrics.renderTotal - baseline.metrics.renderTotal, baseline.metrics.renderTotal)}</div>
      </div>
    </div>

    <div class="section charts-2">
      <div class="chart-card">
        <h2>总体耗时总览</h2>
        <div class="legend">${reports.map((r, i) => `<span><span class="dot" style="background:${colors[i]}"></span>${r.key}</span>`).join("")}</div>
        <div class="chart-box"><canvas id="overallChart"></canvas></div>
      </div>
      <div class="chart-card">
        <h2>关键结论</h2>
        <p class="note"><span class="badge">采样配置</span>All 1x 仍然是绝对性能基线。Motorway+Primary 2x 在 1x 输出时保留主干道高采样，只为主干道额外付费，整体位于两端之间。</p>
        <p class="note"><span class="badge">导出分辨率</span>从 Export 1x 切到 Export 2x 会显著放大所有阶段，尤其是道路、渐变和编码。这个维度和 render_scale_config 是乘法关系，不应混看。</p>
        <p class="note"><span class="badge">道路</span>道路始终是绝对主瓶颈。统一 2x 时，Primary / Secondary / Tertiary / Residential 成本都显著抬升；混合采样把额外成本主要限定在 Motorway / Primary。</p>
        <p class="note"><span class="badge">架构</span>当前 uniform fast path 已恢复正常，All 2x 不再走多 layer 合成慢路径；mixed 只在真正混合时才走 layer compositor。</p>
      </div>
    </div>

    <div class="section chart-card">
      <h2>渲染阶段对比</h2>
      <div class="chart-box tall"><canvas id="stagesChart"></canvas></div>
    </div>

    <div class="section charts-2">
      <div class="chart-card">
        <h2>道路总 breakdown</h2>
        <div class="chart-box tall"><canvas id="roadsBreakdownChart"></canvas></div>
      </div>
      <div class="chart-card">
        <h2>道路 phases</h2>
        <div class="chart-box"><canvas id="roadsPhasesChart"></canvas></div>
      </div>
    </div>

    <div class="section charts-2">
      <div class="chart-card">
        <h2>道路 casing breakdown</h2>
        <div class="chart-box tall"><canvas id="roadsCasingChart"></canvas></div>
      </div>
      <div class="chart-card">
        <h2>道路 fill breakdown</h2>
        <div class="chart-box tall"><canvas id="roadsFillChart"></canvas></div>
      </div>
    </div>

    <div class="section charts-2">
      <div class="chart-card">
        <h2>点数简化后规模</h2>
        <div class="chart-box tall"><canvas id="pointsChart"></canvas></div>
      </div>
      <div class="chart-card">
        <h2>编码与内存</h2>
        <div class="chart-box"><canvas id="encodeChart"></canvas></div>
      </div>
    </div>

    <div class="section table-card">
      <div class="table-head"><h2>方案总表</h2></div>
      <table>
        <thead>
          <tr>
            <th>方案</th>
            <th>WASM 总渲染</th>
            <th>render.poster</th>
            <th>generation.total</th>
            <th>renderer_scale</th>
            <th>总像素</th>
            <th>主画布</th>
            <th>相对基线</th>
          </tr>
        </thead>
        <tbody>${makeScenarioTableRows()}</tbody>
      </table>
    </div>

    <div class="section table-card">
      <div class="table-head"><h2>主阶段明细</h2></div>
      <table>
        <thead>
          <tr><th>阶段</th>${reports.map((r) => `<th>${r.key}</th>`).join("")}</tr>
        </thead>
        <tbody>${makeStageTableRows()}</tbody>
      </table>
    </div>

    <div class="section table-card">
      <div class="table-head"><h2>道路总 breakdown 表</h2></div>
      <table>
        <thead><tr><th>道路类型</th>${reports.map((r) => `<th>${r.key}</th>`).join("")}</tr></thead>
        <tbody>${makeRoadRows("total")}</tbody>
      </table>
    </div>

    <div class="section table-card">
      <div class="table-head"><h2>道路 casing breakdown 表</h2></div>
      <table>
        <thead><tr><th>道路类型</th>${reports.map((r) => `<th>${r.key}</th>`).join("")}</tr></thead>
        <tbody>${makeRoadRows("casing")}</tbody>
      </table>
    </div>

    <div class="section table-card">
      <div class="table-head"><h2>道路 fill breakdown 表</h2></div>
      <table>
        <thead><tr><th>道路类型</th>${reports.map((r) => `<th>${r.key}</th>`).join("")}</tr></thead>
        <tbody>${makeRoadRows("fill")}</tbody>
      </table>
    </div>

    <div class="section table-card">
      <div class="table-head"><h2>点数简化表</h2></div>
      <table>
        <thead><tr><th>道路类型</th>${reports.map((r) => `<th>${r.key}</th>`).join("")}</tr></thead>
        <tbody>${makePointRows()}</tbody>
      </table>
    </div>
  </div>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js"></script>
  <script>
    const reports = ${JSON.stringify(reports)};
    const colors = ${JSON.stringify(colors)};
    const stageLabels = ${JSON.stringify(MAIN_STAGES)};
    const roadTypes = ${JSON.stringify(ROAD_TYPES)};

    function msTick(v) { return v >= 1000 ? (v / 1000).toFixed(1) + 's' : v + 'ms'; }

    new Chart(document.getElementById('overallChart'), {
      type: 'bar',
      data: {
        labels: reports.map(r => r.key),
        datasets: [
          { label: 'WASM 总渲染', data: reports.map(r => r.metrics.renderTotal), backgroundColor: colors, borderRadius: 4 },
          { label: '总生成时间', data: reports.map(r => r.metrics.generation), backgroundColor: colors.map(c => c + '88'), borderRadius: 4 }
        ]
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { y: { ticks: { callback: msTick } } }
      }
    });

    new Chart(document.getElementById('stagesChart'), {
      type: 'bar',
      data: {
        labels: stageLabels,
        datasets: reports.map((r, i) => ({
          label: r.key,
          data: stageLabels.map(stage => r.metrics.mainStages[stage] ?? 0),
          backgroundColor: colors[i],
          borderRadius: 4
        }))
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { y: { ticks: { callback: msTick } } }
      }
    });

    function horizontalRoadChart(id, extractor, titleLabel) {
      new Chart(document.getElementById(id), {
        type: 'bar',
        data: {
          labels: roadTypes,
          datasets: reports.map((r, i) => ({
            label: r.key,
            data: roadTypes.map(type => extractor(r, type)),
            backgroundColor: colors[i],
            borderRadius: 4
          }))
        },
        options: {
          indexAxis: 'y',
          responsive: true, maintainAspectRatio: false,
          scales: { x: { ticks: { callback: msTick } } }
        }
      });
    }
    horizontalRoadChart('roadsBreakdownChart', (r, type) => r.metrics.roadsBreakdown[type] ?? 0);
    horizontalRoadChart('roadsCasingChart', (r, type) => r.metrics.roadsCasing[type] ?? 0);
    horizontalRoadChart('roadsFillChart', (r, type) => r.metrics.roadsFill[type] ?? 0);

    new Chart(document.getElementById('roadsPhasesChart'), {
      type: 'bar',
      data: {
        labels: ['build_road_paths', 'stroke_casing', 'stroke_fill'],
        datasets: reports.map((r, i) => ({
          label: r.key,
          data: [
            r.metrics.roadPhases.build_road_paths ?? 0,
            r.metrics.roadPhases.stroke_casing ?? 0,
            r.metrics.roadPhases.stroke_fill ?? 0
          ],
          backgroundColor: colors[i],
          borderRadius: 4
        }))
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { y: { ticks: { callback: msTick } } }
      }
    });

    new Chart(document.getElementById('pointsChart'), {
      type: 'bar',
      data: {
        labels: roadTypes,
        datasets: reports.map((r, i) => ({
          label: r.key,
          data: roadTypes.map(type => r.metrics.roadsPoints[type]?.simplified ?? 0),
          backgroundColor: colors[i],
          borderRadius: 4
        }))
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        scales: { y: { ticks: { callback: v => new Intl.NumberFormat('en-US').format(v) } } }
      }
    });

    new Chart(document.getElementById('encodeChart'), {
      type: 'bar',
      data: {
        labels: ['downsample_rgba', 'png_encode', 'main_pixmap_bytes(MB)', 'final_png_bytes(MB)'],
        datasets: reports.map((r, i) => ({
          label: r.key,
          data: [
            r.metrics.downsample ?? 0,
            r.metrics.pngEncode ?? 0,
            (r.metrics.mainPixmapBytes ?? 0) / (1024 * 1024),
            (r.metrics.finalPngBytes ?? 0) / (1024 * 1024)
          ],
          backgroundColor: colors[i],
          borderRadius: 4
        }))
      },
      options: { responsive: true, maintainAspectRatio: false }
    });
  </script>
</body>
</html>`;

fs.writeFileSync(outFile, html, "utf8");
console.log(`Generated ${outFile}`);
