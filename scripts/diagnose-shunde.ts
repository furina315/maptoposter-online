import * as fs from "node:fs";
import * as path from "node:path";
import init, { init_panic_hook, render_map_binary } from "../src/pkg/wasm";

type FixtureBundle = {
  configPath: string;
  roadsPath: string;
  waterPath: string;
  parksPath: string;
};

function resolveFixtureBundle(prefix: string): FixtureBundle {
  const fixtureDir = path.resolve(process.cwd(), "fixtures", "shunde");
  return {
    configPath: path.join(fixtureDir, `${prefix}-config.json`),
    roadsPath: path.join(fixtureDir, `${prefix}-roads-shards.json`),
    waterPath: path.join(fixtureDir, `${prefix}-water-bin.json`),
    parksPath: path.join(fixtureDir, `${prefix}-parks-bin.json`),
  };
}

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function toFloat64Array(values: number[]): Float64Array {
  return Float64Array.from(values);
}

function toRoadShards(values: number[][]): Float64Array[] {
  return values.map((shard) => Float64Array.from(shard));
}

function formatMs(durationMs: number): string {
  return `${durationMs.toFixed(2)}ms`;
}

async function main() {
  const outputName = process.argv[2] || "diagnose-output.png";
  const fixturePrefix =
    process.argv[3] || "容桂街道-2026-06-16T08-45-50-720Z";
  const bundle = resolveFixtureBundle(fixturePrefix);
  const scriptStart = performance.now();

  console.log("[diagnose] step=feedback-loop hypothesis=fixture_replay_matches_browser");
  console.log("[diagnose] evidence=browser captured processed shards + bins + config");
  console.log("[diagnose] observation=load exact render_map_binary inputs and measure CLI round-trip");
  console.log(`[diagnose] fixture_prefix=${fixturePrefix}`);

  const loadStart = performance.now();
  const config = readJsonFile<Record<string, unknown>>(bundle.configPath);
  const roads = toRoadShards(readJsonFile<number[][]>(bundle.roadsPath));
  const water = toFloat64Array(readJsonFile<number[]>(bundle.waterPath));
  const parks = toFloat64Array(readJsonFile<number[]>(bundle.parksPath));
  const loadDuration = performance.now() - loadStart;

  console.log(
    `[diagnose] fixture config=${path.basename(bundle.configPath)} roads_shards=${roads.length} water_points=${water.length} parks_points=${parks.length} load=${formatMs(loadDuration)}`
  );

  await init();
  init_panic_hook();

  const renderStart = performance.now();
  const result = render_map_binary(roads, water, parks, JSON.stringify(config));
  const renderDuration = performance.now() - renderStart;

  if (!result.is_success()) {
    console.log(`[diagnose] result=failed error=${result.get_error()}`);
    process.exitCode = 1;
    return;
  }

  const png = result.get_data();
  if (!png) {
    console.log("[diagnose] result=failed error=render succeeded but returned empty png buffer");
    process.exitCode = 1;
    return;
  }

  const outputPath = path.resolve(process.cwd(), "fixtures", "shunde", outputName);
  fs.writeFileSync(outputPath, png);

  const totalDuration = performance.now() - scriptStart;
  console.log(
    `[diagnose] result=success png_bytes=${png.length} render=${formatMs(renderDuration)} total=${formatMs(totalDuration)} output=${outputPath}`
  );
  console.log(
    "[diagnose] next=if wasm internal timings are in same order of magnitude as browser logs, start hypothesis_1"
  );
}

main().catch((error) => {
  console.error("[diagnose] unhandled_error", error);
  process.exitCode = 1;
});
