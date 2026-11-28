import type { NextRequest } from "next/server";
import {
  GeminiServiceError,
  isGeminiConfigured,
  runGeminiPolishCaptions,
  runGeminiSocialKit,
  runGeminiTranslateCaptions,
  type GeminiAssistAction,
  type GeminiCueInput,
} from "@/lib/gemini";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  noStoreJson,
  readBoundedJson,
  validateSameOrigin,
} from "@/lib/security/http";
import {
  checkRateLimit,
  RATE_LIMIT_POLICIES,
} from "@/lib/security/rate-limit";

const MAX_CUES = 250;
const MAX_CUE_TEXT_CHARS = 500;
const MAX_TOTAL_CHARS = 24_000;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface AiCaptionsRequestBody {
  action?: unknown;
  projectId?: unknown;
  projectTitle?: unknown;
  targetLanguage?: unknown;
  removeFillers?: unknown;
  cues?: unknown;
}

function validateCues(
  raw: unknown
): { ok: true; cues: GeminiCueInput[] } | { ok: false; error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { ok: false, error: "At least one caption cue is required." };
  }
  if (raw.length > MAX_CUES) {
    return {
      ok: false,
      error: `AI Assist supports up to ${MAX_CUES} cues per request.`,
    };
  }

  let totalChars = 0;
  const cues: GeminiCueInput[] = [];

  for (let i = 0; i < raw.length; i++) {
    const item = raw[i];
    if (!item || typeof item !== "object") {
      return { ok: false, error: `Invalid cue at index ${i}.` };
    }
    const candidate = item as Record<string, unknown>;
    const id =
      typeof candidate.id === "string" ? candidate.id.trim() : "";
    const text =
      typeof candidate.text === "string" ? candidate.text.trim() : "";
    const startMs =
      typeof candidate.start_ms === "number" &&
      Number.isFinite(candidate.start_ms)
        ? Math.max(0, Math.round(candidate.start_ms))
        : 0;
    const endMs =
      typeof candidate.end_ms === "number" &&
      Number.isFinite(candidate.end_ms)
        ? Math.max(startMs, Math.round(candidate.end_ms))
        : startMs;

    if (!id || id.length > 120) {
      return { ok: false, error: `Invalid cue id at index ${i}.` };
    }
    if (!text) {
      return { ok: false, error: `Cue ${i + 1} has empty text.` };
    }
    if (text.length > MAX_CUE_TEXT_CHARS) {
      return {
        ok: false,
        error: `Cue ${i + 1} exceeds the ${MAX_CUE_TEXT_CHARS}-character limit.`,
      };
    }

    totalChars += text.length;
    if (totalChars > MAX_TOTAL_CHARS) {
      return {
        ok: false,
        error: "Transcript exceeds the maximum length for a single AI request.",
      };
    }

    cues.push({ id, start_ms: startMs, end_ms: endMs, text });
  }

  return { ok: true, cues };
}

export async function POST(request: NextRequest) {
  const originCheck = validateSameOrigin(request);
  if (!originCheck.ok) {
    return noStoreJson(
      { error: "Cross-origin request rejected." },
      { status: 403 }
    );
  }

  if (!isSupabaseConfigured()) {
    return noStoreJson(
      { error: "Authentication service is not configured on this server." },
      { status: 503 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return noStoreJson(
      {
        error: "Sign in to use Gemini AI Assist on your projects.",
        code: "auth_required",
      },
      { status: 401 }
    );
  }

  const parsed = await readBoundedJson<AiCaptionsRequestBody>(
    request,
    256 * 1024
  );
  if (!parsed.ok) {
    return noStoreJson({ error: parsed.error }, { status: parsed.status });
  }

  const body = parsed.data;
  const projectId =
    typeof body.projectId === "string" ? body.projectId.trim() : "";
  if (!UUID_RE.test(projectId)) {
    return noStoreJson(
      { error: "A valid project ID is required for AI Assist." },
      { status: 400 }
    );
  }

  // Verify project ownership before spending any Gemini API quota
  const { data: ownedProject, error: projectErr } = await supabase
    .from("projects")
    .select("id, title, duration_ms")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (projectErr || !ownedProject) {
    return noStoreJson(
      { error: "Project not found." },
      { status: 404 }
    );
  }

  if (!isGeminiConfigured()) {
    return noStoreJson(
      {
        error:
          "Gemini API is not configured on this server. Add GEMINI_API_KEY and restart.",
        code: "gemini_not_configured",
      },
      { status: 503 }
    );
  }

  const rateLimit = await checkRateLimit({
    policy: RATE_LIMIT_POLICIES.aiAssist,
    subjectKey: `user:${user.id}`,
    request,
    actorUserId: user.id,
  });
  if (!rateLimit.ok) {
    return rateLimit.response;
  }

  const action = body.action as GeminiAssistAction;
  if (action !== "polish" && action !== "translate" && action !== "social") {
    return noStoreJson(
      { error: "Invalid AI action. Expected polish, translate, or social." },
      { status: 400 }
    );
  }

  const cueCheck = validateCues(body.cues);
  if (!cueCheck.ok) {
    return noStoreJson({ error: cueCheck.error }, { status: 400 });
  }

  const projectTitle =
    typeof ownedProject.title === "string" && ownedProject.title.trim()
      ? ownedProject.title.trim().slice(0, 140)
      : typeof body.projectTitle === "string"
        ? body.projectTitle.trim().slice(0, 140)
        : undefined;

  try {
    if (action === "polish") {
      const result = await runGeminiPolishCaptions({
        cues: cueCheck.cues,
        projectTitle,
        removeFillers:
          typeof body.removeFillers === "boolean" ? body.removeFillers : true,
      });
      return noStoreJson(result, { status: 200 });
    }

    if (action === "translate") {
      const targetLanguage =
        typeof body.targetLanguage === "string"
          ? body.targetLanguage.trim().slice(0, 64)
          : "";
      if (!targetLanguage) {
        return noStoreJson(
          { error: "Please select or enter a target language." },
          { status: 400 }
        );
      }
      const result = await runGeminiTranslateCaptions({
        cues: cueCheck.cues,
        targetLanguage,
        projectTitle,
      });
      return noStoreJson(result, { status: 200 });
    }

    const result = await runGeminiSocialKit({
      cues: cueCheck.cues,
      projectTitle,
      clipDurationMs:
        typeof ownedProject.duration_ms === "number"
          ? ownedProject.duration_ms
          : undefined,
    });
    return noStoreJson(result, { status: 200 });
  } catch (err) {
    if (err instanceof GeminiServiceError) {
      return noStoreJson(
        { error: err.message, code: err.code },
        { status: err.httpStatus }
      );
    }
    return noStoreJson(
      {
        error: "Gemini could not complete that request right now. Please try again.",
        code: "provider_error",
      },
      { status: 502 }
    );
  }
}
