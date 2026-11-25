import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { coordToAddress, kakaoConfigured } from "@/lib/kakao";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!kakaoConfigured()) return NextResponse.json({});

  const lat = Number(req.nextUrl.searchParams.get("lat"));
  const lng = Number(req.nextUrl.searchParams.get("lng"));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return NextResponse.json({ error: "bad request" }, { status: 400 });
  try {
    return NextResponse.json(await coordToAddress(lat, lng));
  } catch {
    return NextResponse.json({});
  }
}
