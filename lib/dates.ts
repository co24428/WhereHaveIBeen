// Dates are plain "YYYY-MM-DD" strings in the app's time zone.
import { addDays, format, parseISO } from "date-fns";

export const APP_TIME_ZONE = process.env.APP_TIME_ZONE || "Asia/Seoul";

export function todayISO(timeZone = APP_TIME_ZONE): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

export function isISODate(s: string | undefined | null): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(parseISO(s).getTime());
}

export function shiftDay(iso: string, days: number): string {
  return format(addDays(parseISO(iso), days), "yyyy-MM-dd");
}

/** Past or today → visited, future → planned */
export function statusForDate(iso: string, today: string): "visited" | "planned" {
  return iso <= today ? "visited" : "planned";
}
