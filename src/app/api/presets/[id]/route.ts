import { NextResponse, type NextRequest } from "next/server";
import { validateCaptionStyle } from "@/lib/caption-editor";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured on this server." },
      { status: 503 }
    );
  }

  const { id } = await context.params;
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

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 1 || name.length > 60) {
      return NextResponse.json(
        { error: "Preset name must be between 1 and 60 characters." },
        { status: 400 }
      );
    }
    patch.name = name;
  }

  if (body.style !== undefined) {
    const styleCheck = validateCaptionStyle(body.style);
    if (!styleCheck.ok) {
      return NextResponse.json({ error: styleCheck.error }, { status: 400 });
    }
    patch.style = styleCheck.normalizedStyle;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      { error: "Provide a name or style to update." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("caption_presets")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, user_id, name, style, created_at, updated_at")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Preset not found." }, { status: 404 });
  }

  return NextResponse.json({ preset: data });
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Supabase is not configured on this server." },
      { status: 503 }
    );
  }

  const { id } = await context.params;
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
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "Preset not found." }, { status: 404 });
  }

  return NextResponse.json({ deleted: true, id: data.id });
}
