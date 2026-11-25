"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export default function NavLinks({ labels }: { labels: { calendar: string; map: string; add: string } }) {
  const path = usePathname();
  const date = useSearchParams().get("date");
  const item = (href: string, active: boolean, icon: string, label: string) => (
    <Link
      href={href}
      className={`flex items-center gap-1 rounded-lg px-2.5 py-2 text-sm font-medium ${
        active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      <span aria-hidden>{icon}</span>
      <span>{label}</span>
    </Link>
  );
  const q = date ? `?date=${date}` : "";
  return (
    <>
      {item("/", path === "/", "📅", labels.calendar)}
      {item(`/map${q}`, path === "/map", "🗺️", labels.map)}
      {item(`/add${q}`, path === "/add", "＋", labels.add)}
    </>
  );
}
