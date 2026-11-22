import { NextResponse, type NextRequest } from "next/server";
import { validateCaptionStyle } from "@/lib/caption-editor";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const MAX_PRESETS_PER_USER = 50;

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured on this server." },
      { status: 503 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("caption_presets")
    .select("id, user_id, name, style, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Could not load saved presets." },
      { status: 500 }
    );
  }

  return NextResponse.json({ presets: data ?? [] });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured on this server." },
      { status: 503 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Authentication required." }, { status: 401 });
  }

  let body: { name?: unknown; style?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (name.length < 1 || name.length > 60) {
    return NextResponse.json(
      { error: "Preset name must be between 1 and 60 characters." },
      { status: 400 }
    );
  }

  const styleCheck = validateCaptionStyle(body.style);
  if (!styleCheck.ok) {
    return NextResponse.json({ error: styleCheck.error }, { status: 400 });
  }

  const { count } = await supabase
    .from("caption_presets")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  if ((count ?? 0) >= MAX_PRESETS_PER_USER) {
    return NextResponse.json(
      { error: `Maximum of ${MAX_PRESETS_PER_USER} saved presets reached.` },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("caption_presets")
    .insert({
      user_id: user.id,
      name,
      style: styleCheck.normalizedStyle,
    })
    .select("id, user_id, name, style, created_at, updated_at")
    .single();

  if (error || !data) {
    return NextResponse.json(
      { error: "Failed to save personal preset." },
      { status: 500 }
    );
  }

  return NextResponse.json({ preset: data }, { status: 201 });
}
