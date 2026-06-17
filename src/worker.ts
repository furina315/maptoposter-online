import init, {
  process_roads_bin_wasm,
  process_polygons_bin_wasm,
  render_map_binary,
  render_map_binary_with_font,
  init_panic_hook,
} from "./pkg/wasm";

// Initialize WASM
const wasmPromise = init().then(() => {
  init_panic_hook();
});

declare var self: Worker;

const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
  time: console.time.bind(console),
  timeEnd: console.timeEnd.bind(console),
};

let activeWorkerLogs: string[] | null = null;
const activeTimers = new Map<string, number>();

function formatConsoleArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === "string") return arg;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(" ");
}

function pushWorkerLog(level: string, message: string) {
  if (activeWorkerLogs) {
    activeWorkerLogs.push(`[${level}] ${message}`);
  }
}

console.log = (...args: unknown[]) => {
  pushWorkerLog("log", formatConsoleArgs(args));
  originalConsole.log(...args);
};

console.warn = (...args: unknown[]) => {
  pushWorkerLog("warn", formatConsoleArgs(args));
  originalConsole.warn(...args);
};

console.error = (...args: unknown[]) => {
  pushWorkerLog("error", formatConsoleArgs(args));
  originalConsole.error(...args);
};

console.time = (label?: string) => {
  const key = label ?? "default";
  activeTimers.set(key, performance.now());
  pushWorkerLog("time", key);
  originalConsole.time(label);
};

console.timeEnd = (label?: string) => {
  const key = label ?? "default";
  const start = activeTimers.get(key);
  const duration = start === undefined ? null : performance.now() - start;
  activeTimers.delete(key);
  pushWorkerLog("timeEnd", duration === null ? key : `${key}: ${duration.toFixed(3)} ms`);
  originalConsole.timeEnd(label);
};

self.onmessage = async (event: MessageEvent) => {
  await wasmPromise;
  const { id, type, data } = event.data;
  activeWorkerLogs = [];

  try {
    let result;
    const start = performance.now();

    // 执行全链路处理
    if (type === "roads") {
      result = process_roads_bin_wasm(data as Float64Array);
    } else if (type === "polygons") {
      result = process_polygons_bin_wasm(data as Float64Array);
    } else if (type === "pois") {
      // POI 数据已经是最简形式 [poi_count, x1, y1, x2, y2, ...], 直接返回
      result = data as Float64Array;
    } else if (type === "render") {
      const { roads_shards, water_bin, parks_bin, config_json, custom_font } = data as any;

      let renderResult;
      if (custom_font && custom_font instanceof Uint8Array && custom_font.length > 0) {
        renderResult = render_map_binary_with_font(
          roads_shards,
          water_bin,
          parks_bin,
          config_json,
          custom_font
        );
      } else {
        renderResult = render_map_binary(roads_shards, water_bin, parks_bin, config_json);
      }

      if (renderResult.is_success()) {
        result = renderResult.get_data(); // 返回 Uint8Array
      } else {
        throw new Error(renderResult.get_error());
      }
    } else {
      throw new Error(`Unknown task type: ${type}`);
    }

    const duration = performance.now() - start;

    // 返回结果
    self.postMessage({
      id,
      success: true,
      result,
      duration,
      logs: activeWorkerLogs,
    });
  } catch (error) {
    self.postMessage({
      id,
      success: false,
      error: String(error),
      logs: activeWorkerLogs,
    });
  } finally {
    activeWorkerLogs = null;
  }
};
