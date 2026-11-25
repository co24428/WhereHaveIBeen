import { getLocale } from "next-intl/server";
import { requireUser } from "@/lib/auth";
import { isISODate, todayISO } from "@/lib/dates";
import { PLACE_COLUMNS, rowToPlace } from "@/lib/types";
import DateBar from "@/components/DateBar";
import DayView from "@/components/DayView";

const SEOUL = { lat: 37.5665, lng: 126.978 };

export default async function MapPage({ searchParams }: PageProps<"/map">) {
  const sp = await searchParams;
  const today = todayISO();
  const date = typeof sp.date === "string" && isISODate(sp.date) ? sp.date : today;

  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("places").select(PLACE_COLUMNS).eq("visit_date", date).order("visit_order");
  if (error) console.error("[map]", error);
  const places = (data ?? []).map(rowToPlace);

  // centre an empty day on the most recently saved place
  let fallback = SEOUL;
  if (!places.length) {
    const { data: last } = await supabase.from("places").select("lat, lng").order("updated_at", { ascending: false }).limit(1);
    if (last?.[0]) fallback = { lat: last[0].lat, lng: last[0].lng };
  }

  const locale = await getLocale();
  return (
    <div className="flex h-[calc(100dvh-var(--nav-h)-env(safe-area-inset-top))] flex-col">
      <DateBar date={date} today={today} locale={locale} />
      <DayView key={date} date={date} initialPlaces={places} fallbackCenter={fallback} />
    </div>
  );
}
