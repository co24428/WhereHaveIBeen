import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { kakaoConfigured } from "@/lib/kakao";
import { searchPlaces } from "@/lib/resolve";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!kakaoConfigured()) return NextResponse.json({ error: "kakaoMissing", candidates: [] }, { status: 503 });

  const q = req.nextUrl.searchParams.get("q")?.trim().slice(0, 100);
  if (!q) return NextResponse.json({ candidates: [] });
  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lng = Number(req.nextUrl.searchParams.get("lng"));
  const near = Number.isFinite(lat) && Number.isFinite(lng) && lat && lng ? { lat, lng } : undefined;
  return NextResponse.json({ candidates: await searchPlaces(q, near) });
}
