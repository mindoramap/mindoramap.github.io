import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/store/auth";
import { Brain, Eye, EyeOff } from "lucide-react";
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
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    const passwordPolicyError = validatePasswordPolicy(password);
    if (passwordPolicyError) {
      setError(passwordPolicyError);
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas nao coincidem.");
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
      result.message || "Conta criada."
    );
    const nextUser = useAuth.getState().user;
    if (nextUser) {
      navigate({ to: nextUser.role === "superadmin" || nextUser.accessGranted ? "/dashboard" : "/activate" });
    }
  };

  if (!initialized) return null;

  return (
    <div className="relative min-h-screen grid place-items-center px-4 bg-[radial-gradient(ellipse_at_top,oklch(0.58_0.17_258/0.15),transparent_60%)]">
      <div className="absolute right-4 top-4">
        <ThemeToggle compact />
      </div>
      <div className="w-full max-w-sm bg-card border border-border rounded-2xl p-8 shadow-[var(--shadow-soft)]">
        <div className="flex flex-col items-center gap-2 mb-6">
          <span className="w-12 h-12 rounded-xl bg-[image:var(--gradient-hero)] grid place-items-center text-primary-foreground">
            <Brain />
          </span>
          <h1 className="text-2xl font-bold">Criar conta</h1>
          <p className="text-sm text-muted-foreground text-center">
            Crie seu acesso. Usuarios comuns vao precisar de um codigo no primeiro login.
          </p>
          <p className="text-xs text-muted-foreground text-center">
            Depois do cadastro, voce podera entrar e solicitar a liberacao do acesso com o codigo enviado pelo admin.
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
            type={showPassword ? "text" : "password"}
            required
            minLength={PASSWORD_MIN_LENGTH}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha"
            className="w-full px-3 py-2.5 rounded-lg bg-input border border-border outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={PASSWORD_MIN_LENGTH}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Confirmar senha"
              className="w-full px-3 py-2.5 pr-11 rounded-lg bg-input border border-border outline-none focus:ring-2 focus:ring-ring"
            />
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
              aria-pressed={showPassword}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Minimo de {PASSWORD_MIN_LENGTH} caracteres com maiuscula, minuscula e numero.
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
