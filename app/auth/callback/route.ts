import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Magic-link landing: exchanges ?code= (PKCE) or ?token_hash= for a session.
export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const nextParam = url.searchParams.get("next") ?? "/";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/";
  const supabase = await createClient();

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "email" })
      : { error: new Error("missing code") };

  const dest = url.clone();
  dest.search = "";
  if (error) {
    dest.pathname = "/login";
    dest.searchParams.set("error", "link");
  } else {
    const n = new URL(next, url.origin);
    dest.pathname = n.pathname;
    dest.search = n.search;
  }
  return NextResponse.redirect(dest);
}
