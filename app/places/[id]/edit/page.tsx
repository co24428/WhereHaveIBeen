import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { todayISO } from "@/lib/dates";
import { formContext } from "@/lib/formData";
import { PLACE_COLUMNS, rowToPlace } from "@/lib/types";
import PlaceForm from "@/components/PlaceForm";

export default async function EditPage({ params }: PageProps<"/places/[id]/edit">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { supabase } = await requireUser();
  const { data } = await supabase.from("places").select(PLACE_COLUMNS).eq("id", id).maybeSingle();
  if (!data) notFound();
  const place = rowToPlace(data);
  const ctx = await formContext(supabase);
  return <PlaceForm initial={place} date={place.visit_date} today={todayISO()} {...ctx} />;
}
