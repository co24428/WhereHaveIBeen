import "server-only";
// Turns pasted text (link / share text / address / name) into place candidates.

import { distanceM } from "@/lib/geo";
import { addressSearch, coordToAddress, keywordSearch, kakaoConfigured } from "@/lib/kakao";
import { isAllowedMapHost, parseMapUrl, type LinkHints } from "@/lib/parse/links";
import { parsePastedText, type PasteHints } from "@/lib/parse/shareText";
import type { Candidate } from "@/lib/types";

/**
 * Follows a short link (maps.app.goo.gl, kko.to, naver.me) by reading only the
 * redirect `Location` headers — the page body is never read. Every hop must stay
 * on a known map host.
 */
export async function followShortLink(url: string, maxHops = 6): Promise<string | null> {
  let current = url;
  for (let i = 0; i < maxHops; i++) {
    const u = new URL(current);
    if (!/^https?:$/.test(u.protocol) || !isAllowedMapHost(u.hostname.toLowerCase())) return null;
    const res = await fetch(current, {
      method: "GET",
      redirect: "manual",
      headers: { "User-Agent": "Mozilla/5.0 (Linux; Android 14) WhereHaveIBeen/1.0" },
      signal: AbortSignal.timeout(6000),
    });
    res.body?.cancel().catch(() => {});
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      current = new URL(loc, current).toString();
      continue;
    }
    return current;
  }
  return current;
}

export type ResolveResult = {
  hints: PasteHints;
  candidates: Candidate[];
  /** true when the first candidate is a confident match and can be applied directly */
  confident: boolean;
  warnings: string[];
};

export async function resolvePaste(text: string): Promise<ResolveResult> {
  const hints = parsePastedText(text);
  const warnings: string[] = [];
  let link: LinkHints | undefined = hints.link;

  // 1. expand short links
  if (link?.isShortLink) {
    try {
      const finalUrl = await followShortLink(link.url);
      const parsed = finalUrl ? parseMapUrl(finalUrl) : null;
      if (parsed && !parsed.isShortLink) {
        link = { ...parsed, url: link.url };
        hints.link = link;
        if (!hints.name && parsed.name) hints.name = parsed.name;
      } else {
        warnings.push("shortLinkUnresolved");
      }
    } catch {
      warnings.push("shortLinkUnresolved");
    }
  }
  const sourceUrl = link?.url;
  const name = hints.name ?? link?.name;
  const kakao = kakaoConfigured();
  if (!kakao) warnings.push("kakaoMissing");

  const safe = async <T,>(p: Promise<T>, fallback: T): Promise<T> => {
    try {
      return await p;
    } catch (e) {
      console.error("[resolve]", e);
      warnings.push("lookupFailed");
      return fallback;
    }
  };

  // 2. link has coordinates → exact pin, add address (+ category via nearby keyword match)
  if (link?.lat !== undefined && link.lng !== undefined) {
    const pin = { lat: link.lat, lng: link.lng };
    const c: Candidate = { name: name ?? link.query ?? "", ...pin, sourceUrl, via: "link" };
    if (kakao) {
      const addr = await safe(coordToAddress(pin.lat, pin.lng), {} as Awaited<ReturnType<typeof coordToAddress>>);
      c.address = addr.address;
      c.jibunAddress = addr.jibunAddress;
      if (!c.name) c.name = addr.building || addr.address || "";
      if (name) {
        const near = await safe(keywordSearch(name, { ...pin, radius: 300 }), []);
        const match = near.find((n) => distanceM(n, pin) < 300);
        if (match) {
          c.category = match.category;
          c.kakaoPlaceId = match.kakaoPlaceId;
          if (link.precision === "approx") {
            c.lat = match.lat;
            c.lng = match.lng;
          }
        }
      }
    }
    return { hints, candidates: [c], confident: link.precision === "exact" || !!c.kakaoPlaceId, warnings };
  }

  if (!kakao) return { hints, candidates: [], confident: false, warnings };

  // 3. address present → building coordinates, refined by keyword match nearby
  if (hints.address) {
    const found = await safe(addressSearch(hints.address), []);
    if (found.length) {
      const building = found[0];
      let best: Candidate = { ...building, name: name ?? building.name, sourceUrl };
      if (name) {
        const near = await safe(keywordSearch(name, { lat: building.lat, lng: building.lng, radius: 200 }), []);
        const match =
          near.find((n) => link?.kakaoPlaceId && n.kakaoPlaceId === link.kakaoPlaceId) ??
          near.find((n) => distanceM(n, building) < 150);
        if (match) best = { ...match, sourceUrl: sourceUrl ?? match.sourceUrl, via: "address" };
      }
      return { hints, candidates: [best, ...found.slice(1).map((f) => ({ ...f, sourceUrl }))], confident: true, warnings };
    }
    warnings.push("addressNotFound");
  }

  // 4. name (+ maybe Kakao place id) → keyword search
  const q = name ?? hints.query ?? link?.query;
  if (q) {
    const list = await safe(keywordSearch(q), []);
    const byId = link?.kakaoPlaceId ? list.find((c) => c.kakaoPlaceId === link!.kakaoPlaceId) : undefined;
    if (byId) return { hints, candidates: [{ ...byId, sourceUrl }], confident: true, warnings };
    // plain text might itself be an address
    if (!list.length && !hints.address) {
      const addr = await safe(addressSearch(q), []);
      if (addr.length) return { hints, candidates: addr, confident: addr.length === 1, warnings };
    }
    return {
      hints,
      candidates: list.map((c) => ({ ...c, sourceUrl: sourceUrl ?? c.sourceUrl })),
      confident: false,
      warnings,
    };
  }
  return { hints, candidates: [], confident: false, warnings };
}

/** Search box: keyword search plus address search, merged. */
export async function searchPlaces(q: string, near?: { lat: number; lng: number }): Promise<Candidate[]> {
  const [kw, addr] = await Promise.all([
    keywordSearch(q, near ? { ...near } : undefined).catch(() => []),
    addressSearch(q).catch(() => []),
  ]);
  return [...addr.slice(0, 3), ...kw];
}
