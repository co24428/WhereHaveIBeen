import Link from "next/link";
import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { supabaseConfigured } from "@/lib/env";
import { setLocale, signOut } from "@/app/actions/auth";
import NavLinks from "./NavLinks";

export default async function NavBar() {
  const t = await getTranslations("nav");
  const locale = await getLocale();
  let loggedIn = false;
  if (supabaseConfigured) {
    const supabase = await createClient();
    loggedIn = !!(await supabase.auth.getUser()).data.user;
  }
  const other = locale === "ko" ? "en" : "ko";

  return (
    <header className="sticky top-0 z-40 h-[var(--nav-h)] border-b border-slate-200 bg-white/95 backdrop-blur pt-[env(safe-area-inset-top)] box-content">
      <nav className="mx-auto flex h-full max-w-5xl items-center gap-1 px-3">
        <Link href="/" className="mr-auto flex items-center gap-1.5 font-bold text-slate-900">
          <span aria-hidden>📍</span>
          <span className="hidden sm:inline">WhereHaveIBeen</span>
          <span className="sm:hidden">WHIB</span>
        </Link>
        {loggedIn && (
          <Suspense>
            <NavLinks labels={{ calendar: t("calendar"), map: t("map"), add: t("add") }} />
          </Suspense>
        )}
        <form action={setLocale.bind(null, other)}>
          <button className="rounded-lg px-2 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100" title={t("language")}>
            {other === "ko" ? "한" : "EN"}
          </button>
        </form>
        {loggedIn && (
          <form action={signOut}>
            <button className="rounded-lg px-2 py-2 text-slate-500 hover:bg-slate-100" title={t("logout")} aria-label={t("logout")}>
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
            </button>
          </form>
        )}
      </nav>
    </header>
  );
}
