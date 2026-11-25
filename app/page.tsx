import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { categoryStyle } from "@/lib/types";

type Row = { id: string; visit_date: string; visit_order: number; status: string; nickname: string | null; name: string; category: string | null };

export default async function CalendarPage({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const today = todayISO();
  const monthParam = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : today.slice(0, 7);
  const month = parseISO(`${monthParam}-01`);
  const gridStart = startOfWeek(startOfMonth(month));
  const gridEnd = endOfWeek(endOfMonth(month));
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const { supabase } = await requireUser();
  const { data } = await supabase
    .from("places")
    .select("id, visit_date, visit_order, status, nickname, name, category")
    .gte("visit_date", format(gridStart, "yyyy-MM-dd"))
    .lte("visit_date", format(gridEnd, "yyyy-MM-dd"))
    .order("visit_date")
    .order("visit_order");
  const byDay = new Map<string, Row[]>();
  for (const r of (data ?? []) as Row[]) {
    const list = byDay.get(r.visit_date) ?? [];
    list.push(r);
    byDay.set(r.visit_date, list);
  }

  const t = await getTranslations("calendar");
  const locale = await getLocale();
  const monthTitle = new Intl.DateTimeFormat(locale, { year: "numeric", month: "long" }).format(month);
  const weekdays = days.slice(0, 7).map((d) => new Intl.DateTimeFormat(locale, { weekday: "short" }).format(d));
  const dayLabel = (iso: string) =>
    new Intl.DateTimeFormat(locale, { month: "short", day: "numeric", weekday: "short" }).format(parseISO(iso));
  const prev = format(addMonths(month, -1), "yyyy-MM");
  const next = format(addMonths(month, 1), "yyyy-MM");
  const monthDays = [...byDay.entries()].filter(([d]) => d.startsWith(monthParam));

  return (
    <div className="mx-auto w-full max-w-3xl px-2 pb-10 sm:px-4">
      <div className="flex items-center gap-1 py-3">
        <Link href={`/?month=${prev}`} className="rounded-lg p-2 text-xl hover:bg-slate-200" aria-label={t("prev")}>
          ‹
        </Link>
        <h1 className="min-w-36 text-center text-lg font-bold">{monthTitle}</h1>
        <Link href={`/?month=${next}`} className="rounded-lg p-2 text-xl hover:bg-slate-200" aria-label={t("next")}>
          ›
        </Link>
        <Link
          href="/"
          className="ml-auto rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium hover:bg-slate-100"
        >
          {t("today")}
        </Link>
      </div>

      <div className="grid grid-cols-7 text-center text-xs font-medium text-slate-500">
        {weekdays.map((w, i) => (
          <div key={w} className={`py-1 ${i === 0 ? "text-rose-500" : i === 6 ? "text-sky-600" : ""}`}>
            {w}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 overflow-hidden rounded-xl border border-slate-200 bg-slate-200 gap-px">
        {days.map((d) => {
          const iso = format(d, "yyyy-MM-dd");
          const list = byDay.get(iso) ?? [];
          const inMonth = isSameMonth(d, month);
          const isToday = iso === today;
          return (
            <Link
              key={iso}
              href={`/map?date=${iso}`}
              className={`flex min-h-16 flex-col items-center gap-1 bg-white p-1 sm:min-h-24 sm:items-start sm:p-1.5 ${
                inMonth ? "" : "bg-slate-50 text-slate-400"
              } hover:bg-sky-50 active:bg-sky-100`}
            >
              <span
                className={`grid h-6 w-6 place-items-center rounded-full text-sm ${
                  isToday ? "bg-slate-900 font-bold text-white" : ""
                }`}
              >
                {d.getDate()}
              </span>
              {/* phone: dots */}
              <span className="flex flex-wrap justify-center gap-0.5 sm:hidden">
                {list.slice(0, 4).map((p) => (
                  <Dot key={p.id} status={p.status} color={categoryStyle(p.category).color} />
                ))}
                {list.length > 4 && <span className="text-[10px] leading-none text-slate-500">{t("more", { count: list.length - 4 })}</span>}
              </span>
              {/* desktop: names */}
              <span className="hidden w-full flex-col gap-0.5 sm:flex">
                {list.slice(0, 3).map((p) => (
                  <span key={p.id} className="flex items-center gap-1 truncate text-xs">
                    <Dot status={p.status} color={categoryStyle(p.category).color} />
                    <span className="truncate">{p.nickname || p.name}</span>
                  </span>
                ))}
                {list.length > 3 && <span className="text-xs text-slate-500">{t("more", { count: list.length - 3 })}</span>}
              </span>
            </Link>
          );
        })}
      </div>

      <div className="mt-2 flex gap-4 px-1 text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <Dot status="visited" color="#475569" /> {t("went")}
        </span>
        <span className="flex items-center gap-1">
          <Dot status="planned" color="#475569" /> {t("willGo")}
        </span>
      </div>

      <section className="mt-6">
        <h2 className="mb-2 px-1 text-sm font-semibold text-slate-500">{t("thisMonth")}</h2>
        {monthDays.length === 0 ? (
          <p className="rounded-xl bg-white p-4 text-sm text-slate-500">{t("empty")}</p>
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl bg-white">
            {monthDays.map(([iso, list]) => (
              <li key={iso}>
                <Link href={`/map?date=${iso}`} className="flex gap-3 p-3 hover:bg-slate-50">
                  <span className={`w-24 shrink-0 text-sm font-medium ${iso === today ? "text-sky-700" : ""}`}>{dayLabel(iso)}</span>
                  <span className="flex min-w-0 flex-wrap gap-x-3 gap-y-1 text-sm">
                    {list.map((p) => (
                      <span key={p.id} className="flex items-center gap-1">
                        <span className="text-xs text-slate-400">{p.visit_order}</span>
                        <span className="truncate">{categoryStyle(p.category).icon} {p.nickname || p.name}</span>
                      </span>
                    ))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Dot({ status, color }: { status: string; color: string }) {
  return (
    <span
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={status === "visited" ? { background: color } : { border: `1.5px solid ${color}` }}
    />
  );
}
