import type { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
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
    return noStoreJson({ error: "Project not found." }, { status: 404 });
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return noStoreJson({ error: "Authentication required." }, { status: 401 });
  }

  const parsed = await readBoundedJson<{ title?: string }>(request, 4096);
  if (!parsed.ok) {
    return noStoreJson({ error: parsed.error }, { status: parsed.status });
  }

  const title = typeof parsed.data.title === "string" ? parsed.data.title.trim() : "";
  if (!title || title.length > 120) {
    return noStoreJson(
      { error: "Project title must be between 1 and 120 characters." },
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("projects")
    .update({ title })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id, title, status, updated_at")
    .maybeSingle();

  if (error) {
    return noStoreJson({ error: "Failed to update project." }, { status: 500 });
  }

  if (!data) {
    return noStoreJson({ error: "Project not found." }, { status: 404 });
  }

  return noStoreJson({ project: data });
}
