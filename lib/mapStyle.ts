import { setWorkerUrl } from "maplibre-gl";
import { version } from "maplibre-gl/package.json";

// Free OpenStreetMap vector tiles, no API key: https://openfreemap.org
export const MAP_STYLE = process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/liberty";

// see scripts/copy-maplibre-worker.mjs
if (typeof window !== "undefined") setWorkerUrl(`/maplibre-gl-worker.mjs?v=${version}`);
