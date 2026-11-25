// MapLibre v6 finds its web worker relative to its own bundle URL, which
// bundlers rename. Serve the worker from /public and point MapLibre at it.
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const dir = path.dirname(require.resolve("maplibre-gl/package.json"));
mkdirSync("public", { recursive: true });
copyFileSync(path.join(dir, "dist/maplibre-gl-worker.mjs"), "public/maplibre-gl-worker.mjs");
console.log("copied maplibre-gl-worker.mjs → public/");
