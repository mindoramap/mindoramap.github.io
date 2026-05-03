import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/store/auth";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { user, initialized, init } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (!initialized) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }

    navigate({ to: user.role === "superadmin" || user.accessGranted ? "/dashboard" : "/activate" });
  }, [initialized, user, navigate]);

  return null;
}
