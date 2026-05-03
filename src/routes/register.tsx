import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/store/auth";
import { Brain } from "lucide-react";
import { PASSWORD_MIN_LENGTH, validatePasswordPolicy } from "@/lib/security";

export const Route = createFileRoute("/register")({
  head: () => ({ meta: [{ title: "Cadastro - Mindora" }] }),
  component: RegisterPage,
});

function RegisterPage() {
  const { user, initialized, configured, configError, debugMessage, register, init } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
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
    if (!initialized) return;
    if (!user) return;
    navigate({ to: user.role === "superadmin" || user.accessGranted ? "/dashboard" : "/activate" });
  }, [initialized, navigate, user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setDebug("");
    const normalizedEmail = email.trim().toLowerCase();
    const isReservedSuperadmin =
      normalizedEmail === "gabrielnbn@hotmail.com" && password === "Mindora123*";
    const passwordPolicyError = isReservedSuperadmin ? null : validatePasswordPolicy(password);
    if (passwordPolicyError) {
      setError(passwordPolicyError);
      return;
    }

    setSubmitting(true);
    const result = await register(name, email, password);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error || "Erro");
      setDebug(result.debug || debugMessage || "");
      return;
    }

    setSuccess(
      normalizedEmail === "gabrielnbn@hotmail.com"
        ? "Conta de superadmin criada. Volte para o login e entre com sua senha."
        : result.message || "Conta criada."
    );
    const nextUser = useAuth.getState().user;
    if (nextUser) {
      navigate({ to: nextUser.role === "superadmin" || nextUser.accessGranted ? "/dashboard" : "/activate" });
    }
  };

  if (!initialized) return null;

  return (
    <div className="min-h-screen grid place-items-center px-4 bg-[radial-gradient(ellipse_at_top,oklch(0.55_0.22_280/0.15),transparent_60%)]">
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-8 shadow-[var(--shadow-soft)]">
        <div className="flex flex-col items-center gap-2 mb-6">
          <span className="w-12 h-12 rounded-xl bg-[image:var(--gradient-hero)] grid place-items-center text-primary-foreground">
            <Brain />
          </span>
          <h1 className="text-2xl font-bold">Criar conta</h1>
          <p className="text-sm text-muted-foreground text-center">
            Crie seu acesso. Usuarios comuns vao precisar de um codigo no primeiro login.
          </p>
        </div>
        {!configured && (
          <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {configError || "Auth nao configurado."}
          </div>
        )}
        <form onSubmit={submit} className="space-y-3">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nome"
            className="w-full px-3 py-2.5 rounded-lg bg-input border border-border outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="w-full px-3 py-2.5 rounded-lg bg-input border border-border outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            type="password"
            required
            minLength={PASSWORD_MIN_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha"
            className="w-full px-3 py-2.5 rounded-lg bg-input border border-border outline-none focus:ring-2 focus:ring-ring"
          />
          <p className="text-xs text-muted-foreground">
            Minimo de {PASSWORD_MIN_LENGTH} caracteres com maiuscula, minuscula e numero.
            O superadmin pode usar a senha reservada definida no sistema.
          </p>
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
            {submitting ? "Criando..." : "Criar conta"}
          </button>
        </form>
        <p className="text-sm text-muted-foreground text-center mt-4">
          Ja tem conta? <Link to="/login" className="text-primary hover:underline">Entrar</Link>
        </p>
      </div>
    </div>
  );
}
