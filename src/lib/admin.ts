import { supabase } from "@/lib/supabase";
import type { UserProfile } from "@/store/auth";

export interface AccessCodeAuditRow {
  id: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
  used_by: string | null;
}

export const loadAdminUsers = async (): Promise<UserProfile[]> => {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("user_profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
};

export const loadAccessCodeAudit = async (): Promise<AccessCodeAuditRow[]> => {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("access_codes")
    .select("id, expires_at, used_at, created_at, used_by")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw error;
  return data || [];
};

export const createAccessCode = async (expiresInHours: number) => {
  if (!supabase) {
    throw new Error("Supabase indisponivel.");
  }

  const { data, error } = await supabase.rpc("create_access_code", {
    p_expires_in_hours: expiresInHours,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : null;
  if (!row?.access_code) {
    throw new Error("Nao foi possivel gerar o codigo.");
  }

  return {
    accessCode: row.access_code as string,
    expiresAt: row.expires_at as string,
  };
};
