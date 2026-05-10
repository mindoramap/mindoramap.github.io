import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { LandingPage } from "@/components/landing/LandingPage";
import { useAuth } from "@/store/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "MindoraMap - Transforme pensamentos em conexoes inteligentes" },
      {
        name: "description",
        content:
          "MindoraMap e a plataforma moderna de mapas mentais inteligentes para organizar ideias, acelerar brainstorming e conectar conhecimento com clareza visual.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { user, initialized, init } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (!initialized || !user) return;
    navigate({ to: user.role === "superadmin" || user.accessGranted ? "/dashboard" : "/activate" });
  }, [initialized, user, navigate]);

  return <LandingPage />;
}
