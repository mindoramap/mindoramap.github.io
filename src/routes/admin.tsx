import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Shield, Users, Clock3, Ticket } from "lucide-react";
import { Header } from "@/components/Header";
import { createAccessCode, loadAccessCodeAudit, loadAdminUsers, type AccessCodeAuditRow } from "@/lib/admin";
import { useAuth, type UserProfile } from "@/store/auth";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Superadmin - Mindora" }] }),
  component: AdminPage,
});

const formatSeconds = (seconds: number) => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${minutes}m`;
};

function AdminPage() {
  const { user, initialized, init } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [audit, setAudit] = useState<AccessCodeAuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expiresInHours, setExpiresInHours] = useState(24);
  const [generatedCode, setGeneratedCode] = useState("");
  const [generatedCodeExpiresAt, setGeneratedCodeExpiresAt] = useState("");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    if (!initialized) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    if (user.role !== "superadmin") {
      navigate({ to: user.accessGranted ? "/dashboard" : "/activate" });
    }
  }, [initialized, navigate, user]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!user || user.role !== "superadmin") {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const [usersResponse, auditResponse] = await Promise.all([loadAdminUsers(), loadAccessCodeAudit()]);
        if (!cancelled) {
          setProfiles(usersResponse);
          setAudit(auditResponse);
        }
      } catch (loadError) {
        console.error("Falha ao carregar painel de superadmin", loadError);
        if (!cancelled) setError("Nao foi possivel carregar o painel administrativo.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const stats = useMemo(() => {
    const activatedUsers = profiles.filter(
      (profile) => profile.role === "superadmin" || Boolean(profile.access_granted_at)
    ).length;
    const totalUsageSeconds = profiles.reduce((sum, profile) => sum + (profile.total_usage_seconds || 0), 0);

    return {
      totalUsers: profiles.length,
      activatedUsers,
      totalUsageSeconds,
    };
  }, [profiles]);

  const generateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setCreating(true);

    try {
      const result = await createAccessCode(expiresInHours);
      setGeneratedCode(result.accessCode);
      setGeneratedCodeExpiresAt(result.expiresAt);
      setAudit(await loadAccessCodeAudit());
    } catch (generateError) {
      console.error("Falha ao gerar codigo de acesso", generateError);
      setError("Nao foi possivel gerar o codigo agora.");
    } finally {
      setCreating(false);
    }
  };

  if (!initialized) return null;
  if (!user || user.role !== "superadmin") return null;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <span className="w-12 h-12 rounded-2xl bg-primary/10 text-primary grid place-items-center">
            <Shield size={22} />
          </span>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Superadmin</h1>
            <p className="text-muted-foreground">Controle de acessos, usuarios e codigos da plataforma.</p>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <section className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <Users size={13} /> Usuarios cadastrados
            </p>
            <p className="text-3xl font-bold mt-2">{stats.totalUsers}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <Ticket size={13} /> Acessos liberados
            </p>
            <p className="text-3xl font-bold mt-2">{stats.activatedUsers}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-5">
            <p className="text-xs text-muted-foreground flex items-center gap-2">
              <Clock3 size={13} /> Tempo total de uso
            </p>
            <p className="text-3xl font-bold mt-2">{formatSeconds(stats.totalUsageSeconds)}</p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-lg font-semibold mb-4">Usuarios</h2>
            {loading ? (
              <p className="text-sm text-muted-foreground">Carregando usuarios...</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground">
                    <tr className="border-b border-border">
                      <th className="py-2 pr-3 font-medium">Email</th>
                      <th className="py-2 pr-3 font-medium">Perfil</th>
                      <th className="py-2 pr-3 font-medium">Acesso</th>
                      <th className="py-2 pr-3 font-medium">Tempo</th>
                      <th className="py-2 font-medium">Ultima atividade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profiles.map((profile) => (
                      <tr key={profile.user_id} className="border-b border-border/70 align-top">
                        <td className="py-3 pr-3">
                          <p className="font-medium">{profile.email}</p>
                          <p className="text-xs text-muted-foreground">{profile.display_name}</p>
                        </td>
                        <td className="py-3 pr-3">
                          <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs capitalize">
                            {profile.role}
                          </span>
                        </td>
                        <td className="py-3 pr-3">
                          {profile.role === "superadmin"
                            ? "Total"
                            : profile.access_granted_at
                              ? new Date(profile.access_granted_at).toLocaleString()
                              : "Aguardando codigo"}
                        </td>
                        <td className="py-3 pr-3">{formatSeconds(profile.total_usage_seconds || 0)}</td>
                        <td className="py-3">
                          {profile.last_seen_at ? new Date(profile.last_seen_at).toLocaleString() : "Sem registro"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-lg font-semibold mb-4">Gerar codigo hexadecimal</h2>
              <form onSubmit={generateCode} className="space-y-4">
                <div>
                  <label className="text-xs text-muted-foreground">Expiracao em horas</label>
                  <input
                    type="number"
                    min={1}
                    max={720}
                    value={expiresInHours}
                    onChange={(e) => setExpiresInHours(Number(e.target.value) || 24)}
                    className="w-full mt-1 px-3 py-2.5 rounded-lg bg-input border border-border outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
                <button
                  disabled={creating}
                  className="w-full py-2.5 rounded-lg bg-[image:var(--gradient-hero)] text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {creating ? "Gerando..." : "Gerar codigo"}
                </button>
              </form>

              {generatedCode && (
                <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-4">
                  <p className="text-xs text-muted-foreground">Codigo gerado agora</p>
                  <p className="mt-2 font-mono text-lg break-all">{generatedCode}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Expira em {new Date(generatedCodeExpiresAt).toLocaleString()}
                  </p>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-lg font-semibold mb-4">Auditoria de codigos</h2>
              <div className="space-y-3">
                {audit.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum codigo gerado ainda.</p>
                ) : (
                  audit.map((row) => (
                    <div key={row.id} className="rounded-xl border border-border p-3 text-sm">
                      <p className="font-medium">{row.used_at ? "Utilizado" : "Disponivel"}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Expira em {new Date(row.expires_at).toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Criado em {new Date(row.created_at).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </section>
      </main>
    </div>
  );
}
