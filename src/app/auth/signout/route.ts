import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { noStoreJson, validateSameOrigin } from "@/lib/security/http";

export async function POST(request: Request) {
  const originCheck = validateSameOrigin(request);
  if (!originCheck.ok) {
    return noStoreJson({ error: "Cross-origin sign-out blocked." }, { status: 403 });
  }

  const { searchParams, origin } = new URL(request.url);
  const scope = searchParams.get("scope") === "global" ? "global" : "local";

  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut({ scope });

  const response = NextResponse.redirect(new URL("/", origin), { status: 303 });
  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, private"
  );
  return response;
}
