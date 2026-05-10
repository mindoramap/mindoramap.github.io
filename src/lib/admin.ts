import { supabase } from "@/lib/supabase";
import type { UserProfile } from "@/store/auth";

export interface AccessCodeAuditRow {
  id: string;
  target_user_id: string | null;
  target_email: string;
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
    .select("id, target_user_id, target_email, expires_at, used_at, created_at, used_by")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) throw error;
  return data || [];
};

export const createAccessCode = async (targetUserId: string, expiresInHours: number) => {
  if (!supabase) {
    throw new Error("Supabase indisponivel.");
  }

  const { data, error } = await supabase.rpc("create_access_code", {
    p_target_user_id: targetUserId,
    p_expires_in_hours: expiresInHours,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row?.access_code) {
    throw new Error(`Resposta inesperada ao gerar codigo: ${JSON.stringify(data)}`);
  }

  return {
    accessCode: row.access_code as string,
    expiresAt: row.expires_at as string,
    targetEmail: row.target_email as string,
  };
};

export const buildAccessCodeEmail = (targetEmail: string, accessCode: string, expiresAt: string) => {
  const subject = "Seu codigo de acesso ao Mindora";
  const body = [
    "Ola,",
    "",
    "Seu cadastro no Mindora foi aprovado.",
    `Codigo de acesso: ${accessCode}`,
    `Validade: ${new Date(expiresAt).toLocaleString()}`,
    "",
    "Entre na plataforma com seu email e senha e use esse codigo na tela de liberacao.",
  ].join("\n");

  const params = new URLSearchParams({
    subject,
    body,
  });

  return `mailto:${encodeURIComponent(targetEmail)}?${params.toString()}`;
};
