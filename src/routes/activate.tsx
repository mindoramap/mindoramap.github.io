import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { Header } from "@/components/Header";
import { useAuth } from "@/store/auth";

export const Route = createFileRoute("/activate")({
  head: () => ({ meta: [{ title: "Liberar Acesso - Mindora" }] }),
  component: ActivatePage,
});

function ActivatePage() {
  const { user, initialized, init, activateWithCode } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void init();
  }, [init]);

  useEffect(() => {
    if (!initialized) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }

    if (user.role === "superadmin" || user.accessGranted) {
      navigate({ to: "/dashboard" });
    }
  }, [initialized, navigate, user]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSubmitting(true);
    const result = await activateWithCode(code);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error || "Codigo invalido.");
      return;
    }

    setSuccess(result.message || "Acesso liberado.");
    navigate({ to: "/dashboard" });
  };

  if (!initialized) return null;
  if (!user || user.role === "superadmin" || user.accessGranted) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 grid place-items-center px-4">
        <form
          onSubmit={submit}
          className="w-full max-w-md bg-card border border-border rounded-2xl p-8 shadow-[var(--shadow-soft)]"
        >
          <div className="flex flex-col items-center gap-3 mb-6 text-center">
            <span className="w-14 h-14 rounded-2xl bg-primary/10 text-primary grid place-items-center">
              <ShieldCheck size={24} />
            </span>
            <h1 className="text-2xl font-bold">Liberar acesso</h1>
            <p className="text-sm text-muted-foreground">
              O email <strong>{user.email}</strong> precisa de um codigo de acesso no primeiro uso.
            </p>
          </div>

          <label className="text-xs text-muted-foreground">Codigo hexadecimal</label>
          <input
            autoFocus
            required
            value={code}
            onChange={(e) => setCode(e.target.value.toLowerCase().trim())}
            placeholder="Ex.: a1b2c3d4e5f6a7b8"
            className="w-full mt-1 px-3 py-2.5 rounded-lg bg-input border border-border outline-none focus:ring-2 focus:ring-ring tracking-[0.18em] uppercase"
          />

          {success && <p className="mt-3 text-sm text-emerald-600">{success}</p>}
          {error && <p className="mt-3 text-sm text-destructive">{error}</p>}

          <button
            disabled={submitting}
            className="w-full mt-5 py-2.5 rounded-lg bg-[image:var(--gradient-hero)] text-primary-foreground font-medium hover:opacity-90 transition-opacity disabled:cursor-not-allowed disabled:opacity-70"
          >
            {submitting ? "Validando..." : "Liberar meu acesso"}
          </button>
        </form>
      </main>
    </div>
  );
}
