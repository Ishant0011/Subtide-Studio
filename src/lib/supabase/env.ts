export interface EnabledOAuthProviders {
  google: boolean;
  discord: boolean;
}

export function getEnabledOAuthProviders(): EnabledOAuthProviders {
  return {
    google: process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === "true",
    discord: process.env.NEXT_PUBLIC_AUTH_DISCORD_ENABLED === "true",
  };
}

export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export function getSupabasePublicEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Copy .env.example to .env.local and set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY."
    );
  }

  return { url: url.replace(/\/+$/, ""), anonKey };
}

export function getSupabaseServiceRoleKey(): string {
  if (typeof window !== "undefined") {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY must never be accessed in the browser.");
  }

  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY in server environment. Set it in .env.local."
    );
  }

  return key;
}
