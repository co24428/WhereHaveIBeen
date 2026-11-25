import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";

export const LOCALES = ["en", "ko"] as const;
export type Locale = (typeof LOCALES)[number];

export default getRequestConfig(async () => {
  const cookie = (await cookies()).get("locale")?.value;
  let locale: Locale = "en";
  if (cookie === "ko" || cookie === "en") locale = cookie;
  else if (/^ko\b/i.test((await headers()).get("accept-language") ?? "")) locale = "ko";
  return {
    locale,
    timeZone: process.env.APP_TIME_ZONE || "Asia/Seoul",
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
