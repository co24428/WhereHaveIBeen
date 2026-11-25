import { getTranslations } from "next-intl/server";
import { supabaseConfigured } from "@/lib/env";
import LoginForm from "./LoginForm";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const t = await getTranslations("login");
  const next = typeof sp.next === "string" ? sp.next : "/";
  const linkError = sp.error === "link";
  return (
    <div className="mx-auto w-full max-w-sm px-4 py-12">
      <div className="mb-6 text-center">
        <div className="text-5xl">📍</div>
        <h1 className="mt-2 text-2xl font-bold">{t("title")}</h1>
        <p className="mt-1 text-sm text-slate-500">{t("subtitle")}</p>
      </div>
      {!supabaseConfigured ? (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{t("notConfigured")}</p>
      ) : (
        <LoginForm next={next} linkError={linkError} />
      )}
    </div>
  );
}
