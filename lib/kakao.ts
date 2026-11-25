import "server-only";
// Kakao Local API (https://developers.kakao.com/docs/latest/ko/local/dev-guide)
// Called only from the server so the REST key never reaches the browser.

import type { Candidate, Category } from "@/lib/types";

const BASE = "https://dapi.kakao.com/v2/local";

export class KakaoNotConfigured extends Error {
  constructor() {
    super("KAKAO_REST_API_KEY is not set");
  }
}

export const kakaoConfigured = () => Boolean(process.env.KAKAO_REST_API_KEY);

async function call<T>(path: string, params: Record<string, string | number | undefined>): Promise<T> {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key) throw new KakaoNotConfigured();
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
  const res = await fetch(`${BASE}${path}?${qs}`, {
    headers: { Authorization: `KakaoAK ${key}` },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`Kakao ${path} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  return res.json() as Promise<T>;
}

type KeywordDoc = {
  id: string;
  place_name: string;
  category_name: string;
  category_group_code: string;
  phone: string;
  address_name: string;
  road_address_name: string;
  x: string;
  y: string;
  place_url: string;
  distance?: string;
};

type AddressDoc = {
  address_name: string;
  x: string;
  y: string;
  address: { address_name: string } | null;
  road_address: { address_name: string; building_name: string } | null;
};

type Coord2AddressDoc = {
  address: { address_name: string } | null;
  road_address: { address_name: string; building_name: string } | null;
};

/** Kakao category group → our category */
export function mapKakaoCategory(code: string, name = ""): Category | undefined {
  switch (code) {
    case "FD6":
      return "food";
    case "CE7":
      return "cafe";
    case "AT4":
    case "CT1":
      return "sightseeing";
    case "MT1":
    case "CS2":
      return "shopping";
  }
  if (/쇼핑|백화점|아울렛/.test(name)) return "shopping";
  if (/관광|명소|공원|박물관|미술관/.test(name)) return "sightseeing";
  return undefined;
}

function keywordToCandidate(d: KeywordDoc): Candidate {
  return {
    name: d.place_name,
    lat: Number(d.y),
    lng: Number(d.x),
    address: d.road_address_name || d.address_name || undefined,
    jibunAddress: d.road_address_name ? d.address_name || undefined : undefined,
    category: mapKakaoCategory(d.category_group_code, d.category_name),
    kakaoPlaceId: d.id,
    phone: d.phone || undefined,
    sourceUrl: d.place_url?.replace(/^http:/, "https:") || undefined,
    via: "keyword",
  };
}

export async function keywordSearch(
  query: string,
  near?: { lat: number; lng: number; radius?: number }
): Promise<Candidate[]> {
  const data = await call<{ documents: KeywordDoc[] }>("/search/keyword.json", {
    query,
    size: 15,
    x: near?.lng,
    y: near?.lat,
    radius: near?.radius,
    sort: near?.radius ? "distance" : undefined,
  });
  return data.documents.map(keywordToCandidate);
}

export async function addressSearch(query: string): Promise<Candidate[]> {
  const data = await call<{ documents: AddressDoc[] }>("/search/address.json", { query, size: 10 });
  return data.documents.map((d) => ({
    name: d.road_address?.building_name || d.road_address?.address_name || d.address_name,
    lat: Number(d.y),
    lng: Number(d.x),
    address: d.road_address?.address_name || d.address_name,
    jibunAddress: d.road_address ? d.address?.address_name : undefined,
    via: "address" as const,
  }));
}

export async function coordToAddress(lat: number, lng: number): Promise<{ address?: string; jibunAddress?: string; building?: string }> {
  const data = await call<{ documents: Coord2AddressDoc[] }>("/geo/coord2address.json", { x: lng, y: lat });
  const d = data.documents[0];
  if (!d) return {};
  return {
    address: d.road_address?.address_name || d.address?.address_name,
    jibunAddress: d.road_address ? d.address?.address_name : undefined,
    building: d.road_address?.building_name || undefined,
  };
}
