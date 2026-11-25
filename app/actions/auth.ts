"use server";

import { headers, cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

function allowed(email: string) {
  const list = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.length === 0 || list.includes(email.toLowerCase());
}

function safeNext(next: string | null | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}

export type LoginState = { step: "email" | "code"; email?: string; error?: string; next?: string };

export async function sendLoginEmail(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim();
  const next = safeNext(String(form.get("next") ?? ""));
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { step: "email", error: "invalidEmail", next };
  if (!allowed(email)) return { step: "email", error: "notAllowed", next };

  const h = await headers();
  const origin = h.get("origin") ?? `https://${h.get("host")}`;
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error) return { step: "email", error: error.message, next };
  return { step: "code", email, next };
}

export async function verifyLoginCode(prev: LoginState, form: FormData): Promise<LoginState> {
  const email = prev.email ?? String(form.get("email") ?? "");
  const token = String(form.get("code") ?? "").replace(/\s/g, "");
  const next = prev.next ?? String(form.get("next") ?? "");
  if (!/^\d{6,10}$/.test(token)) return { ...prev, step: "code", error: "invalidCode" };
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { ...prev, step: "code", error: error.message };
  redirect(safeNext(next));
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function setLocale(locale: "en" | "ko") {
  (await cookies()).set("locale", locale === "ko" ? "ko" : "en", { path: "/", maxAge: 60 * 60 * 24 * 365 });
  revalidatePath("/", "layout");
}
