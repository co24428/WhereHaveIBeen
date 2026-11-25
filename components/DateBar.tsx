"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { useTranslations } from "next-intl";
import { parseISO } from "date-fns";
import { shiftDay } from "@/lib/dates";

export default function DateBar({ date, today, locale }: { date: string; today: string; locale: string }) {
  const t = useTranslations("map");
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const label = new Intl.DateTimeFormat(locale, { year: "numeric", month: "short", day: "numeric", weekday: "short" }).format(
    parseISO(date)
  );

  return (
    <div className="sticky top-[var(--nav-h)] z-30 flex h-[var(--datebar-h)] shrink-0 items-center justify-center gap-1 border-b border-slate-200 bg-white px-2">
      <Link href={`/map?date=${shiftDay(date, -1)}`} className="rounded-lg px-3 py-1.5 text-xl hover:bg-slate-100" aria-label={t("prevDay")}>
        ‹
      </Link>
      <button
        type="button"
        onClick={() => {
          const el = input.current;
          if (!el) return;
          try {
            el.showPicker();
          } catch {
            el.focus();
            el.click();
          }
        }}
        className={`relative min-w-44 rounded-lg px-3 py-1.5 text-sm font-semibold hover:bg-slate-100 ${date === today ? "text-sky-700" : ""}`}
        aria-label={t("pickDate")}
      >
        {label}
        <input
          ref={input}
          type="date"
          value={date}
          onChange={(e) => e.target.value && router.push(`/map?date=${e.target.value}`)}
          className="pointer-events-none absolute inset-0 opacity-0"
          tabIndex={-1}
          aria-hidden
        />
      </button>
      <Link href={`/map?date=${shiftDay(date, 1)}`} className="rounded-lg px-3 py-1.5 text-xl hover:bg-slate-100" aria-label={t("nextDay")}>
        ›
      </Link>
    </div>
  );
}
