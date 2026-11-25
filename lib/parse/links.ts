// Pure URL parsing for Google Maps, Kakao Map and Naver Map links.
// Nothing here does network access; see lib/resolve.ts for following short links.

import { decodePlusCode } from "./plusCode";

export type Source = "google" | "kakao" | "naver" | "unknown";

export type LinkHints = {
  source: Source;
  url: string;
  name?: string;
  query?: string; // free-text search from the URL (?q=…, /search/…)
  lat?: number;
  lng?: number;
  /** "exact" = place pin, "approx" = only the map viewport centre */
  precision?: "exact" | "approx";
  kakaoPlaceId?: string;
  naverPlaceId?: string;
  /** short links that must be followed on the server first */
  isShortLink?: boolean;
};

const SHORT_HOSTS = new Set(["maps.app.goo.gl", "goo.gl", "kko.to", "kko.kakao.com", "naver.me"]);

export function isGoogleHost(host: string) {
  return /(^|\.)google\.[a-z.]{2,6}$/.test(host) || host === "maps.app.goo.gl" || host === "goo.gl";
}
export function isKakaoHost(host: string) {
  return host === "kko.to" || host === "kko.kakao.com" || /(^|\.)map\.kakao\.com$/.test(host);
}
export function isNaverHost(host: string) {
  return host === "naver.me" || /(^|\.)map\.naver\.com$/.test(host) || /(^|\.)place\.naver\.com$/.test(host);
}

/** Hosts we are willing to contact when following redirects (SSRF guard). */
export function isAllowedMapHost(host: string) {
  return isGoogleHost(host) || isKakaoHost(host) || isNaverHost(host);
}

function validLatLng(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);
}

function decodeSegment(s: string) {
  try {
    return decodeURIComponent(s.replace(/\+/g, " ")).trim();
  } catch {
    return s.replace(/\+/g, " ").trim();
  }
}

const LATLNG_RE = /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/;

export function parseGoogleMapsUrl(u: URL): LinkHints {
  const hints: LinkHints = { source: "google", url: u.toString() };
  if (SHORT_HOSTS.has(u.hostname)) {
    hints.isShortLink = true;
    return hints;
  }
  const path = u.pathname;

  const place = path.match(/\/maps\/place\/([^/]+)/);
  if (place) {
    const name = decodeSegment(place[1]);
    // "/place/37.5,127.0" is a dropped pin, not a name
    const ll = name.match(LATLNG_RE);
    if (ll) {
      setCoords(hints, +ll[1], +ll[2], "exact");
    } else {
      hints.name = name;
    }
  }
  const search = path.match(/\/maps\/search\/([^/]+)/);
  if (search) {
    const q = decodeSegment(search[1]);
    const ll = q.match(LATLNG_RE);
    if (ll) setCoords(hints, +ll[1], +ll[2], "exact");
    else hints.query = q;
  }

  // 1) exact place pin: last "!3d<lat>!4d<lng>" in the data blob
  const full = decodeSegment(u.pathname + u.search);
  const pins = [...(u.pathname + u.search).matchAll(/!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/g)];
  if (pins.length) {
    const last = pins[pins.length - 1];
    setCoords(hints, +last[1], +last[2], "exact");
  }

  // 2) plus code: "!20s8Q98CX2H+2P3" (the "+" is usually percent-encoded)
  if (hints.precision !== "exact") {
    const pc = full.match(/!20s([23456789CFGHJMPQRVWX]{8}[+ ][23456789CFGHJMPQRVWX]{0,7})/i);
    if (pc) {
      const d = decodePlusCode(pc[1].replace(" ", "+"));
      if (d) setCoords(hints, d.lat, d.lng, "exact");
    }
  }

  // 3) query parameters: ?q=lat,lng | ?q=text | ?query=… | ?ll=lat,lng
  if (hints.precision !== "exact") {
    for (const key of ["q", "query", "ll", "destination"]) {
      const v = u.searchParams.get(key);
      if (!v) continue;
      const ll = v.match(LATLNG_RE);
      if (ll) {
        setCoords(hints, +ll[1], +ll[2], key === "ll" ? "approx" : "exact");
        break;
      } else if (key !== "ll" && !hints.name && !hints.query) {
        hints.query = v.trim();
      }
    }
  }

  // 4) viewport centre "@lat,lng,17z": only a fallback
  if (hints.lat === undefined) {
    const at = path.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
    if (at) setCoords(hints, +at[1], +at[2], "approx");
  }
  return hints;
}

export function parseKakaoMapUrl(u: URL): LinkHints {
  const hints: LinkHints = { source: "kakao", url: u.toString() };
  if (SHORT_HOSTS.has(u.hostname)) {
    hints.isShortLink = true;
    return hints;
  }
  // place.map.kakao.com/12345 | map.kakao.com/link/map/12345 | map.kakao.com/?itemId=12345
  const id =
    u.pathname.match(/^\/(?:m\/)?(\d{3,})/)?.[1] ??
    u.pathname.match(/\/link\/(?:map|to)\/(\d{3,})/)?.[1] ??
    u.searchParams.get("itemId") ??
    undefined;
  if (id && /^\d+$/.test(id)) hints.kakaoPlaceId = id;

  // map.kakao.com/link/map/<name>,<lat>,<lng>
  const link = u.pathname.match(/\/link\/(?:map|to)\/([^/]+)/);
  if (link) {
    const parts = decodeSegment(link[1]).split(",");
    if (parts.length >= 3) {
      const lat = +parts[parts.length - 2];
      const lng = +parts[parts.length - 1];
      if (validLatLng(lat, lng)) {
        setCoords(hints, lat, lng, "exact");
        hints.name = parts.slice(0, -2).join(",");
      }
    }
  }
  return hints;
}

export function parseNaverMapUrl(u: URL): LinkHints {
  const hints: LinkHints = { source: "naver", url: u.toString() };
  if (SHORT_HOSTS.has(u.hostname)) {
    hints.isShortLink = true;
    return hints;
  }
  // map.naver.com/p/entry/place/123 | m.place.naver.com/restaurant/123/home
  const id = u.pathname.match(/\/(?:place|restaurant|cafe|hairshop|accommodation|attraction|hospital)\/(\d{3,})/)?.[1];
  if (id) hints.naverPlaceId = id;
  const lat = Number(u.searchParams.get("lat"));
  const lng = Number(u.searchParams.get("lng"));
  if (u.searchParams.has("lat") && validLatLng(lat, lng)) setCoords(hints, lat, lng, "exact");
  const title = u.searchParams.get("title") ?? u.searchParams.get("name");
  if (title) hints.name = title;
  return hints;
}

export function parseMapUrl(raw: string): LinkHints | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (!/^https?:$/.test(u.protocol)) return null;
  const host = u.hostname.toLowerCase();
  if (isGoogleHost(host)) return parseGoogleMapsUrl(u);
  if (isKakaoHost(host)) return parseKakaoMapUrl(u);
  if (isNaverHost(host)) return parseNaverMapUrl(u);
  return { source: "unknown", url: u.toString() };
}

function setCoords(h: LinkHints, lat: number, lng: number, precision: "exact" | "approx") {
  if (!validLatLng(lat, lng)) return;
  h.lat = lat;
  h.lng = lng;
  h.precision = precision;
}
