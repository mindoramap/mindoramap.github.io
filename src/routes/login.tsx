import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/store/auth";
import { Brain, LockKeyhole, Mail } from "lucide-react";

const AUTH_FEEDBACK_KEY = "mindora-auth-feedback";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Entrar - Mindora" }] }),
  component: LoginPage,
});

function LoginPage() {
  const { user, initialized, configured, configError, debugMessage, login, init } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [debug, setDebug] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const feedback = window.sessionStorage.getItem(AUTH_FEEDBACK_KEY);
    if (!feedback) return;

    setSuccess(feedback);
    window.sessionStorage.removeItem(AUTH_FEEDBACK_KEY);
  }, []);

  useEffect(() => {
    if (!initialized) return;
    if (!user) return;
    navigate({ to: user.role === "superadmin" || user.accessGranted ? "/dashboard" : "/activate" });
  }, [initialized, navigate, user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setDebug("");
    setSubmitting(true);
    const result = await login(email, password);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error || "Erro");
      setDebug(result.debug || debugMessage || "");
      return;
    }

    const nextUser = useAuth.getState().user;
    navigate({ to: nextUser?.role === "superadmin" || nextUser?.accessGranted ? "/dashboard" : "/activate" });
  };

  if (!initialized) return null;

  return (
    <div className="min-h-screen grid place-items-center px-4 bg-[radial-gradient(ellipse_at_top,oklch(0.55_0.22_280/0.15),transparent_60%)]">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-8 shadow-[var(--shadow-soft)]">
        <div className="flex flex-col items-center gap-2 mb-6">
          <span className="w-12 h-12 rounded-xl bg-[image:var(--gradient-hero)] grid place-items-center text-primary-foreground">
            <Brain />
          </span>
          <h1 className="text-2xl font-bold">Entrar</h1>
          <p className="text-sm text-muted-foreground text-center">
            Acesse sua conta com email, senha e liberacao por codigo.
          </p>
        </div>
        {!configured && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {configError || "Auth nao configurado."}
          </div>
        )}
        <form onSubmit={submit} className="space-y-3">
          <label className="text-xs text-muted-foreground flex items-center gap-2">
            <Mail size={12} /> Email
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@empresa.com"
            className="w-full px-3 py-2.5 rounded-lg bg-input border border-border outline-none focus:ring-2 focus:ring-ring"
          />
          <label className="text-xs text-muted-foreground flex items-center gap-2">
            <LockKeyhole size={12} /> Senha
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Sua senha"
            className="w-full px-3 py-2.5 rounded-lg bg-input border border-border outline-none focus:ring-2 focus:ring-ring"
          />
          {success && <p className="text-sm text-emerald-600">{success}</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {debug && (
            <p className="text-xs text-amber-600 break-words rounded-md bg-amber-500/10 px-2 py-1">
              Debug: {debug}
            </p>
          )}
          <button
            disabled={submitting || !configured}
            className="w-full py-2.5 rounded-lg bg-[image:var(--gradient-hero)] text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? "Entrando..." : "Entrar"}
          </button>
        </form>
        <p className="text-sm text-muted-foreground text-center mt-4">
          Primeiro acesso? <Link to="/register" className="text-primary hover:underline">Criar conta</Link>
        </p>
      </div>
    </div>
  );
}
