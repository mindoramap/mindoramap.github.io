import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
const authRedirectUrl = import.meta.env.VITE_AUTH_REDIRECT_URL?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const getAuthRedirectUrl = () => {
  if (authRedirectUrl) return authRedirectUrl;
  if (typeof window === "undefined") return undefined;

  return `${window.location.origin}${window.location.pathname}`;
};

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;
