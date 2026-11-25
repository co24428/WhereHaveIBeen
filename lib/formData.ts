import "server-only";
import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

const SEOUL = { lat: 37.5665, lng: 126.978 };

/** People names for autocomplete and a sensible map centre for the form. */
export async function formContext(supabase: SupabaseClient) {
  const [{ data: people }, { data: last }] = await Promise.all([
    supabase.from("people").select("name").order("name"),
    supabase.from("places").select("lat, lng").order("updated_at", { ascending: false }).limit(1),
  ]);
  return {
    peopleSuggestions: (people ?? []).map((p) => p.name as string),
    center: last?.[0] ? { lat: last[0].lat as number, lng: last[0].lng as number } : SEOUL,
  };
}
