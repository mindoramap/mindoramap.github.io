// Top header with theme + auth controls
import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/store/auth";
import { useUsageTracker } from "@/hooks/useUsageTracker";
import { LogOut, Brain, Shield } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

export function Header({ children }: { children?: React.ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useUsageTracker(Boolean(user && (user.role === "superadmin" || user.accessGranted)));

  return (
    <header className="h-14 border-b border-border bg-card/80 backdrop-blur flex items-center px-4 gap-3 z-10">
      <Link to="/dashboard" className="flex items-center gap-2 font-semibold">
        <span className="w-8 h-8 rounded-lg bg-[image:var(--gradient-hero)] grid place-items-center text-primary-foreground">
          <Brain size={18} />
        </span>
        <span>Mindora</span>
      </Link>
      <div className="flex-1 flex items-center gap-2 mx-4">{children}</div>
      <ThemeToggle compact className="h-9 w-9 rounded-lg border-0 bg-transparent hover:bg-muted" />
      {user && (
        <div className="flex items-center gap-2">
          {user.role === "superadmin" && (
            <Link
              to="/admin"
              className="w-9 h-9 grid place-items-center rounded-lg hover:bg-muted transition-colors"
              aria-label="Painel de superadmin"
              title="Painel de superadmin"
            >
              <Shield size={18} />
            </Link>
          )}
          <span className="text-sm text-muted-foreground hidden sm:inline">{user.name}</span>
          <button
            onClick={async () => {
              await logout();
              navigate({ to: "/login" });
            }}
            className="w-9 h-9 grid place-items-center rounded-lg hover:bg-muted transition-colors"
            aria-label="Sair"
          >
            <LogOut size={18} />
          </button>
        </div>
      )}
    </header>
  );
}
