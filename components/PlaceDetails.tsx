"use client";

import { useTranslations } from "next-intl";
import { categoryStyle, type Place } from "@/lib/types";

/** Compact read-only summary used in the map popup. */
export default function PlaceDetails({ place, index }: { place: Place; index: number }) {
  const t = useTranslations();
  const { icon } = categoryStyle(place.category);
  const time = [place.start_time, place.end_time].filter(Boolean).join("–");
  return (
    <div className="space-y-1 text-sm text-slate-700">
      <div className="flex items-start gap-1.5 pr-4">
        <span className="font-bold text-slate-400">{index}</span>
        <div className="min-w-0">
          <div className="font-semibold text-slate-900">
            {icon} {place.nickname || place.name}
          </div>
          {place.nickname && <div className="text-xs text-slate-500">{place.name}</div>}
        </div>
      </div>
      <div className="flex flex-wrap gap-x-2 text-xs text-slate-500">
        <span>{place.status === "visited" ? t("form.went") : t("form.willGo")}</span>
        {time && <span>🕒 {time}</span>}
        {place.rating && <span>{"★".repeat(place.rating)}</span>}
        {place.cost != null && <span>₩{Number(place.cost).toLocaleString()}</span>}
      </div>
      {place.people.length > 0 && <div className="text-xs">👥 {place.people.join(", ")}</div>}
      {place.memo && <p className="whitespace-pre-wrap text-xs">{place.memo}</p>}
      {place.address && <div className="text-xs text-slate-400">{place.address}</div>}
    </div>
  );
}
