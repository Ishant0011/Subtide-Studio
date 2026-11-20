import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

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
    .from("projects")
    .select(
      "id, user_id, title, status, created_at, updated_at, media_assets(id, project_id, user_id, bucket_id, object_key, original_filename, mime_type, expected_size_bytes, verified_size_bytes, status, completed_at, created_at, updated_at)"
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json(
      { error: "Failed to load projects.", detail: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ projects: data ?? [] });
}
