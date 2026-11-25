"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { CATEGORIES } from "@/lib/types";
import type { SupabaseClient } from "@supabase/supabase-js";

const time = z
  .string()
  .regex(/^\d{2}:\d{2}$/)
  .nullable()
  .optional()
  .or(z.literal("").transform(() => null));

const PlaceInput = z.object({
  id: z.string().uuid().optional(),
  visit_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["visited", "planned"]),
  nickname: z.string().trim().max(100).nullable().optional(),
  name: z.string().trim().min(1).max(200),
  address: z.string().trim().max(300).nullable().optional(),
  jibun_address: z.string().trim().max(300).nullable().optional(),
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  start_time: time,
  end_time: time,
  category: z.enum(CATEGORIES).nullable().optional(),
  memo: z.string().max(5000).nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  cost: z.number().min(0).max(1e12).nullable().optional(),
  source_url: z.string().url().max(2000).nullable().optional(),
  kakao_place_id: z.string().max(50).nullable().optional(),
  people: z.array(z.string().trim().min(1).max(50)).max(30).default([]),
});
export type PlaceInput = z.input<typeof PlaceInput>;

type Result = { ok: true; id: string; date: string } | { ok: false; error: string };

const empty = (v: string | null | undefined) => (v && v.length ? v : null);

async function renumberDay(supabase: SupabaseClient, date: string) {
  const { data } = await supabase
    .from("places")
    .select("id, visit_order")
    .eq("visit_date", date)
    .order("visit_order")
    .order("created_at");
  await Promise.all(
    (data ?? []).map((row, i) =>
      row.visit_order === i + 1 ? null : supabase.from("places").update({ visit_order: i + 1 }).eq("id", row.id)
    )
  );
}

async function setPeople(supabase: SupabaseClient, userId: string, placeId: string, names: string[]) {
  const unique = [...new Set(names.map((n) => n.trim()).filter(Boolean))];
  await supabase.from("place_people").delete().eq("place_id", placeId);
  if (!unique.length) return;
  const { data: people, error } = await supabase
    .from("people")
    .upsert(
      unique.map((name) => ({ user_id: userId, name })),
      { onConflict: "user_id,name" }
    )
    .select("id");
  if (error) throw error;
  await supabase.from("place_people").insert((people ?? []).map((p) => ({ place_id: placeId, person_id: p.id })));
}

export async function savePlace(input: PlaceInput): Promise<Result> {
  const parsed = PlaceInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues.map((i) => i.path.join(".")).join(", ") };
  const { supabase, user } = await requireUser();
  const { id, people, ...p } = parsed.data;

  const row = {
    ...p,
    nickname: empty(p.nickname),
    address: empty(p.address),
    jibun_address: empty(p.jibun_address),
    memo: empty(p.memo),
    start_time: p.start_time ?? null,
    end_time: p.end_time ?? null,
    category: p.category ?? null,
    rating: p.rating ?? null,
    cost: p.cost ?? null,
    source_url: p.source_url ?? null,
    kakao_place_id: p.kakao_place_id ?? null,
  };

  const nextOrder = async (date: string) => {
    const { data } = await supabase
      .from("places")
      .select("visit_order")
      .eq("visit_date", date)
      .order("visit_order", { ascending: false })
      .limit(1);
    return (data?.[0]?.visit_order ?? 0) + 1;
  };

  let placeId: string;
  try {
    if (id) {
      const { data: old, error: e1 } = await supabase.from("places").select("visit_date").eq("id", id).single();
      if (e1 || !old) return { ok: false, error: "not found" };
      const moved = old.visit_date !== row.visit_date;
      const update = moved ? { ...row, visit_order: await nextOrder(row.visit_date) } : row;
      const { error } = await supabase.from("places").update(update).eq("id", id);
      if (error) throw error;
      if (moved) await renumberDay(supabase, old.visit_date);
      placeId = id;
    } else {
      const { data, error } = await supabase
        .from("places")
        .insert({ ...row, user_id: user.id, visit_order: await nextOrder(row.visit_date) })
        .select("id")
        .single();
      if (error) throw error;
      placeId = data.id;
    }
    await setPeople(supabase, user.id, placeId, people);
  } catch (e) {
    console.error("[savePlace]", e);
    return { ok: false, error: (e as { message?: string }).message ?? "save failed" };
  }
  revalidatePath("/", "layout");
  return { ok: true, id: placeId, date: row.visit_date };
}

export async function deletePlace(id: string): Promise<Result> {
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "bad id" };
  const { supabase } = await requireUser();
  const { data, error } = await supabase.from("places").delete().eq("id", id).select("visit_date").single();
  if (error || !data) return { ok: false, error: error?.message ?? "not found" };
  await renumberDay(supabase, data.visit_date);
  revalidatePath("/", "layout");
  return { ok: true, id, date: data.visit_date };
}

export async function reorderPlaces(date: string, ids: string[]): Promise<{ ok: boolean }> {
  const ok = z
    .object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), ids: z.array(z.string().uuid()).max(200) })
    .safeParse({ date, ids }).success;
  if (!ok) return { ok: false };
  const { supabase } = await requireUser();
  const results = await Promise.all(
    ids.map((id, i) => supabase.from("places").update({ visit_order: i + 1 }).eq("id", id).eq("visit_date", date))
  );
  revalidatePath("/", "layout");
  return { ok: results.every((r) => !r.error) };
}
