import type { NextRequest } from "next/server";
import { validateCaptionStyle } from "@/lib/caption-editor";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isUuid,
  noStoreJson,
  readBoundedJson,
  validateSameOrigin,
} from "@/lib/security/http";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return noStoreJson(
      { error: "Supabase is not configured on this server." },
      { status: 503 }
    );
  }

  const originCheck = validateSameOrigin(request);
  if (!originCheck.ok) {
    return noStoreJson({ error: "Cross-origin request rejected." }, { status: 403 });
  }

  const { id } = await context.params;
  if (!isUuid(id)) {
    return noStoreJson({ error: "Preset not found." }, { status: 404 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return noStoreJson({ error: "Authentication required." }, { status: 401 });
  }

  const parsed = await readBoundedJson<{ name?: unknown; style?: unknown }>(
    request,
    16 * 1024
  );
  if (!parsed.ok) {
    return noStoreJson({ error: parsed.error }, { status: parsed.status });
  }
  const body = parsed.data;

  const patch: Record<string, unknown> = {};
  if (body.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (name.length < 1 || name.length > 60) {
      return noStoreJson(
        { error: "Preset name must be between 1 and 60 characters." },
        { status: 400 }
      );
    }
    patch.name = name;
  }

  if (body.style !== undefined) {
    const styleCheck = validateCaptionStyle(body.style);
    if (!styleCheck.ok) {
      return noStoreJson({ error: styleCheck.error }, { status: 400 });
    }
    patch.style = styleCheck.normalizedStyle;
  }

  if (Object.keys(patch).length === 0) {
    return noStoreJson(
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
    return noStoreJson({ error: "Preset not found." }, { status: 404 });
  }

  return noStoreJson({ preset: data });
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return noStoreJson(
      { error: "Supabase is not configured on this server." },
      { status: 503 }
    );
  }

  const originCheck = validateSameOrigin(request);
  if (!originCheck.ok) {
    return noStoreJson({ error: "Cross-origin request rejected." }, { status: 403 });
  }

  const { id } = await context.params;
  if (!isUuid(id)) {
    return noStoreJson({ error: "Preset not found." }, { status: 404 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return noStoreJson({ error: "Authentication required." }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("caption_presets")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    return noStoreJson({ error: "Preset not found." }, { status: 404 });
  }

  return noStoreJson({ deleted: true, id: data.id });
}
