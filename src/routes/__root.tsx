import { Outlet, Link, createRootRoute } from "@tanstack/react-router";
import type { EmailOtpType } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { supabase } from "@/lib/supabase";

const AUTH_FEEDBACK_KEY = "mindora-auth-feedback";

const setAuthFeedback = (message: string) => {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(AUTH_FEEDBACK_KEY, message);
};

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Pagina nao encontrada</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          A pagina que voce tentou abrir nao existe ou foi movida.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Voltar ao inicio
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootComponent() {
  const [processingAuth, setProcessingAuth] = useState(true);
  const [authMessage, setAuthMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleAuthCallback = async () => {
      const url = new URL(window.location.href);
      const hashValue = window.location.hash || "";
      const hashPayload = hashValue.startsWith("#/") ? hashValue.slice(2) : hashValue.replace(/^#/, "");
      const hashParams = new URLSearchParams(hashPayload);
      const tokenHash = url.searchParams.get("token_hash");
      const type = url.searchParams.get("type");
      const errorCode = url.searchParams.get("error_code");
      const errorDescription = url.searchParams.get("error_description");
      const hashErrorCode = hashParams.get("error_code");
      const hashErrorDescription = hashParams.get("error_description");
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");
      const hashType = hashParams.get("type");
      const callbackType = type || hashType;
      const loginHref = `${window.location.pathname}#/login`;

      if (errorCode || errorDescription || hashErrorCode || hashErrorDescription) {
        const decodedError = decodeURIComponent(errorDescription || hashErrorDescription || "").trim();
        const message = decodedError
          ? decodedError
          : (errorCode || hashErrorCode) === "otp_expired"
            ? "Seu link de confirmacao expirou. Solicite um novo email para continuar."
            : "Nao foi possivel confirmar seu email. Tente novamente.";

        setAuthFeedback(message);
        setAuthMessage(message);
        window.history.replaceState({}, document.title, loginHref);
        setProcessingAuth(false);
        return;
      }

      if (!supabase) {
        setProcessingAuth(false);
        return;
      }

      if (accessToken && refreshToken) {
        const result = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (result.error) {
          const message = result.error.message.toLowerCase().includes("expired")
            ? "Seu link de confirmacao expirou. Solicite um novo email para continuar."
            : "Nao foi possivel confirmar seu email. Solicite um novo link e tente novamente.";
          setAuthFeedback(message);
          setAuthMessage(message);
          window.history.replaceState({}, document.title, loginHref);
          setProcessingAuth(false);
          return;
        }

        const message =
          callbackType === "signup"
            ? "Email confirmado com sucesso. Agora voce pode entrar."
            : "Acesso validado com sucesso.";
        setAuthFeedback(message);
        setAuthMessage(message);
        window.history.replaceState({}, document.title, loginHref);
        setProcessingAuth(false);
        return;
      }

      if (!tokenHash || !callbackType) {
        setProcessingAuth(false);
        return;
      }

      const result = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: callbackType as EmailOtpType,
      });

      if (result.error) {
        const message = result.error.message.toLowerCase().includes("expired")
          ? "Seu link de confirmacao expirou. Solicite um novo email para continuar."
          : "Nao foi possivel confirmar seu email. Solicite um novo link e tente novamente.";
        setAuthFeedback(message);
        setAuthMessage(message);
        window.history.replaceState({}, document.title, loginHref);
        setProcessingAuth(false);
        return;
      }

      setAuthFeedback("Email confirmado com sucesso. Agora voce pode entrar.");
      setAuthMessage("Conta criada com sucesso. Agora voce pode fazer login.");
      window.history.replaceState({}, document.title, loginHref);
      setProcessingAuth(false);
    };

    void handleAuthCallback();
  }, []);

  if (processingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-semibold text-foreground">Confirmando acesso</h1>
          <p className="mt-2 text-sm text-muted-foreground">Estamos validando seu link de email.</p>
        </div>
      </div>
    );
  }

  if (authMessage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-md rounded-2xl border border-border bg-card p-8 text-center shadow-[var(--shadow-soft)]">
          <h1 className="text-2xl font-semibold text-foreground">Conta confirmada</h1>
          <p className="mt-3 text-sm text-muted-foreground">{authMessage}</p>
          <a
            href={`${window.location.pathname}#/login`}
            className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Ir para o login
          </a>
        </div>
      </div>
    );
  }

  return (
    <>
      <Outlet />
      <Toaster richColors position="top-right" />
    </>
  );
}
