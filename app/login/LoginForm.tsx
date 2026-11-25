"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { sendLoginEmail, verifyLoginCode, type LoginState } from "@/app/actions/auth";

const input = "w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-base outline-none focus:ring-2 focus:ring-sky-300";
const button = "w-full rounded-xl bg-slate-900 py-3 font-semibold text-white disabled:opacity-60";

export default function LoginForm({ next, linkError }: { next: string; linkError: boolean }) {
  const t = useTranslations("login");
  const [sent, send, sending] = useActionState<LoginState, FormData>(sendLoginEmail, { step: "email", next });
  const [verified, verify, verifying] = useActionState<LoginState, FormData>(verifyLoginCode, { step: "code" });
  const [restart, setRestart] = useState(0);

  const errorText = (e?: string) => (e ? (t.has(`errors.${e}`) ? t(`errors.${e}` as "errors.link") : e) : null);

  if (sent.step === "code" && restart === 0) {
    return (
      <form action={verify} className="space-y-3">
        <p className="rounded-lg bg-sky-50 p-3 text-sm text-sky-900">{t("codeSent", { email: sent.email ?? "" })}</p>
        <input type="hidden" name="email" value={sent.email} />
        <input type="hidden" name="next" value={sent.next} />
        <label className="block text-sm font-medium text-slate-600" htmlFor="code">
          {t("code")}
        </label>
        <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" className={`${input} tracking-[0.3em]`} required />
        {verified.error && <p className="text-sm text-rose-600">{errorText(verified.error)}</p>}
        <button className={button} disabled={verifying}>
          {verifying ? t("verifying") : t("verify")}
        </button>
        <button type="button" onClick={() => setRestart(1)} className="w-full py-2 text-sm text-slate-500">
          {t("back")}
        </button>
      </form>
    );
  }

  return (
    <form action={(fd) => { setRestart(0); return send(fd); }} className="space-y-3">
      {linkError && <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">{t("errors.link")}</p>}
      <input type="hidden" name="next" value={next} />
      <label className="block text-sm font-medium text-slate-600" htmlFor="email">
        {t("email")}
      </label>
      <input id="email" name="email" type="email" autoComplete="email" defaultValue={sent.email} className={input} required />
      {sent.error && <p className="text-sm text-rose-600">{errorText(sent.error)}</p>}
      <button className={button} disabled={sending}>
        {sending ? t("sending") : t("send")}
      </button>
    </form>
  );
}
