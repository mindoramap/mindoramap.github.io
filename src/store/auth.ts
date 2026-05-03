// Managed auth store backed by Supabase Auth with role and access-code activation
import type { Session, Subscription, User as SupabaseUser } from "@supabase/supabase-js";
import { create } from "zustand";
import { validatePasswordPolicy } from "@/lib/security";
import { supabase } from "@/lib/supabase";

const SUPERADMIN_EMAIL = "gabrielnbn@hotmail.com";
const SUPERADMIN_PASSWORD = "Mindora123*";

export type UserRole = "member" | "superadmin";

export interface UserProfile {
  user_id: string;
  email: string;
  display_name: string;
  role: UserRole;
  access_granted_at: string | null;
  access_code_id: string | null;
  total_usage_seconds: number;
  last_seen_at: string | null;
  created_at: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  accessGranted: boolean;
  totalUsageSeconds: number;
  lastSeenAt: string | null;
}

interface AuthResult {
  ok: boolean;
  error?: string;
  message?: string;
  debug?: string;
}

interface AuthState {
  initialized: boolean;
  configured: boolean;
  configError: string | null;
  debugMessage: string | null;
  user: User | null;
  profile: UserProfile | null;
  login: (email: string, password: string) => Promise<AuthResult>;
  register: (name: string, email: string, password: string) => Promise<AuthResult>;
  activateWithCode: (code: string) => Promise<AuthResult>;
  refreshProfile: () => Promise<void>;
  recordUsage: (seconds: number) => Promise<void>;
  logout: () => Promise<void>;
  init: () => Promise<void>;
}

interface ActivateCodeResponse {
  ok: boolean;
  message: string;
}

let authSubscription: Subscription | null = null;

const normalizeEmail = (email: string) => email.trim().toLowerCase();

const isReservedSuperadminCredentials = (email: string, password: string) =>
  normalizeEmail(email) === SUPERADMIN_EMAIL && password === SUPERADMIN_PASSWORD;

const getDisplayName = (user: SupabaseUser) => {
  const metadataName = typeof user.user_metadata?.name === "string" ? user.user_metadata.name.trim() : "";
  if (metadataName) return metadataName;

  const email = user.email?.trim();
  if (!email) return "Usuario";

  return email.split("@")[0] || "Usuario";
};

const mapUser = (session: Session | null, profile: UserProfile | null): User | null => {
  const authUser = session?.user;
  if (!authUser?.email || !profile) return null;

  return {
    id: authUser.id,
    name: profile.display_name || getDisplayName(authUser),
    email: normalizeEmail(authUser.email),
    role: profile.role,
    accessGranted: profile.role === "superadmin" || Boolean(profile.access_granted_at),
    totalUsageSeconds: profile.total_usage_seconds || 0,
    lastSeenAt: profile.last_seen_at,
  };
};

const getConfigError = () => "Autenticacao ainda nao configurada para este ambiente.";

const normalizeAuthError = (message?: string) => {
  const normalizedMessage = message?.trim().toLowerCase() || "";

  if (!normalizedMessage) {
    return "Nao foi possivel autenticar agora. Tente novamente.";
  }

  if (normalizedMessage.includes("invalid login credentials")) {
    return "Email ou senha invalidos.";
  }

  if (normalizedMessage.includes("user already registered")) {
    return "Ja existe uma conta com este email.";
  }

  if (normalizedMessage.includes("signup is disabled")) {
    return "Cadastro indisponivel no momento.";
  }

  if (normalizedMessage.includes("network") || normalizedMessage.includes("fetch")) {
    return "Falha de conexao. Tente novamente em instantes.";
  }

  return "Nao foi possivel autenticar agora. Tente novamente.";
};

const fetchProfile = async (userId: string): Promise<UserProfile | null> => {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data;
};

const hydrateFromSession = async (session: Session | null) => {
  if (!session?.user || !supabase) {
    return { profile: null as UserProfile | null, user: null as User | null };
  }

  const profile = await fetchProfile(session.user.id);
  return {
    profile,
    user: mapUser(session, profile),
  };
};

export const useAuth = create<AuthState>((set, get) => ({
  initialized: false,
  configured: Boolean(supabase),
  configError: supabase ? null : getConfigError(),
  debugMessage: null,
  user: null,
  profile: null,
  init: async () => {
    if (get().initialized) return;

    if (!supabase) {
      set({
        initialized: true,
        configured: false,
        configError: getConfigError(),
        debugMessage: "Supabase client ausente no ambiente atual.",
        user: null,
        profile: null,
      });
      return;
    }

    const applySession = async (session: Session | null) => {
      const { profile, user } = await hydrateFromSession(session);
      set({
        initialized: true,
        configured: true,
        configError: null,
        debugMessage: null,
        profile,
        user,
      });
    };

    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      set({
        initialized: true,
        configured: true,
        configError: "Nao foi possivel verificar sua sessao agora.",
        debugMessage: `getSession: ${error.message}`,
        user: null,
        profile: null,
      });
    } else {
      await applySession(session);
    }

    if (!authSubscription) {
      const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
        void applySession(nextSession);
      });
      authSubscription = data.subscription;
    }
  },
  login: async (email, password) => {
    if (!supabase) {
      return { ok: false, error: getConfigError(), debug: "Supabase client ausente." };
    }

    const normalizedEmail = normalizeEmail(email);
    const loginResult = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (loginResult.error) {
      return {
        ok: false,
        error: normalizeAuthError(loginResult.error.message),
        debug: `signInWithPassword: ${loginResult.error.message}`,
      };
    }

    const { profile, user } = await hydrateFromSession(loginResult.data.session);
    set({
      user,
      profile,
      initialized: true,
      configured: true,
      configError: null,
      debugMessage: null,
    });

    return { ok: true };
  },
  register: async (name, email, password) => {
    if (!supabase) {
      return { ok: false, error: getConfigError(), debug: "Supabase client ausente." };
    }

    const trimmedName = name.trim();
    const normalizedEmail = normalizeEmail(email);
    const passwordPolicyError = validatePasswordPolicy(password);

    if (!trimmedName) {
      return { ok: false, error: "Nome obrigatorio." };
    }

    if (passwordPolicyError) {
      return { ok: false, error: passwordPolicyError };
    }

    if (normalizedEmail === SUPERADMIN_EMAIL && password !== SUPERADMIN_PASSWORD) {
      return { ok: false, error: "Esse email esta reservado para o superadmin." };
    }

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          name: trimmedName,
        },
      },
    });

    if (error) {
      return {
        ok: false,
        error: normalizeAuthError(error.message),
        debug: `signUp: ${error.message}`,
      };
    }

    const session = data.session;
    if (session) {
      const hydrated = await hydrateFromSession(session);
      set({
        user: hydrated.user,
        profile: hydrated.profile,
        initialized: true,
        configured: true,
        configError: null,
        debugMessage: null,
      });
    }

    return {
      ok: true,
      message: session ? "Conta criada com sucesso." : "Conta criada. Confirme seu email para continuar.",
    };
  },
  activateWithCode: async (code) => {
    if (!supabase) {
      return { ok: false, error: getConfigError(), debug: "Supabase client ausente." };
    }

    const { data, error } = await supabase.rpc("activate_access_code", {
      p_code: code,
    });

    if (error) {
      return {
        ok: false,
        error: "Nao foi possivel validar o codigo agora.",
        debug: `activate_access_code: ${error.message}`,
      };
    }

    const result = Array.isArray(data) ? (data[0] as ActivateCodeResponse | undefined) : undefined;
    if (!result?.ok) {
      return { ok: false, error: result?.message || "Codigo invalido ou expirado." };
    }

    await get().refreshProfile();

    return { ok: true, message: result.message };
  },
  refreshProfile: async () => {
    if (!supabase) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const { profile, user } = await hydrateFromSession(session);
    set({ profile, user, initialized: true, configured: true, configError: null, debugMessage: null });
  },
  recordUsage: async (seconds) => {
    if (!supabase || seconds < 1) return;
    await supabase.rpc("record_usage_seconds", { p_seconds: Math.min(seconds, 900) });
    await get().refreshProfile();
  },
  logout: async () => {
    if (!supabase) {
      set({ user: null, profile: null, initialized: true });
      return;
    }

    await supabase.auth.signOut();
    set({ user: null, profile: null, initialized: true, configured: true, configError: null, debugMessage: null });
  },
}));
