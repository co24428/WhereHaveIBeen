export type Status = "visited" | "planned";

export const CATEGORIES = ["food", "cafe", "sightseeing", "shopping", "work", "home", "other"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_STYLE: Record<Category, { icon: string; color: string }> = {
  food: { icon: "🍜", color: "#ef4444" },
  cafe: { icon: "☕", color: "#a16207" },
  sightseeing: { icon: "🏞️", color: "#16a34a" },
  shopping: { icon: "🛍️", color: "#db2777" },
  work: { icon: "💼", color: "#2563eb" },
  home: { icon: "🏠", color: "#7c3aed" },
  other: { icon: "📍", color: "#475569" },
};

export function categoryStyle(c: string | null | undefined) {
  return CATEGORY_STYLE[(c as Category) ?? "other"] ?? CATEGORY_STYLE.other;
}

export type Place = {
  id: string;
  visit_date: string;
  visit_order: number;
  status: Status;
  nickname: string | null;
  name: string;
  address: string | null;
  jibun_address: string | null;
  lat: number;
  lng: number;
  start_time: string | null;
  end_time: string | null;
  category: string | null;
  memo: string | null;
  rating: number | null;
  cost: number | null;
  source_url: string | null;
  kakao_place_id: string | null;
  people: string[];
};

/** A location found by search / link parsing, used to pre-fill the form. */
export type Candidate = {
  name: string;
  lat: number;
  lng: number;
  address?: string;
  jibunAddress?: string;
  category?: Category;
  kakaoPlaceId?: string;
  phone?: string;
  sourceUrl?: string;
  /** how the coordinates were found, shown to the user */
  via: "link" | "address" | "keyword" | "pin";
};

export const PLACE_COLUMNS =
  "id, visit_date, visit_order, status, nickname, name, address, jibun_address, lat, lng, start_time, end_time, category, memo, rating, cost, source_url, kakao_place_id, place_people(people(name))";

type PersonRef = { name: string } | { name: string }[] | null;
type Row = Omit<Place, "people"> & { place_people?: { people: PersonRef }[] | null };

export function rowToPlace(r: Row): Place {
  const { place_people, ...rest } = r;
  return {
    ...rest,
    start_time: rest.start_time?.slice(0, 5) ?? null,
    end_time: rest.end_time?.slice(0, 5) ?? null,
    // many-to-one embed is an object at runtime; untyped clients infer an array
    people: (place_people ?? [])
      .flatMap((pp) => (Array.isArray(pp.people) ? pp.people : [pp.people]))
      .map((p) => p?.name)
      .filter((n): n is string => !!n),
  };
}
