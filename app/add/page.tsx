import { requireUser } from "@/lib/auth";
import { isISODate, todayISO } from "@/lib/dates";
import { formContext } from "@/lib/formData";
import PlaceForm from "@/components/PlaceForm";

export default async function AddPage({ searchParams }: PageProps<"/add">) {
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const today = todayISO();
  const date = isISODate(str("date")) ? str("date") : today;
  // Android "Share → WhereHaveIBeen" sends title / text / url
  const shared = [str("title"), str("text"), str("url")]
    .filter(Boolean)
    .filter((v, i, a) => !a.slice(0, i).some((prev) => prev.includes(v)))
    .join("\n");

  const { supabase } = await requireUser();
  const ctx = await formContext(supabase);
  return <PlaceForm date={date} today={today} sharedText={shared || undefined} {...ctx} />;
}
