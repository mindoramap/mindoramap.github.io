import { createFileRoute, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/store/auth";
import { Header } from "@/components/Header";
import { MindMapEditor } from "@/components/MindMapEditor";
import { getMap, type MindMap } from "@/store/maps";
import { ArrowLeft, Brain, GitBranch, Network, Crosshair, Link2, Wand2, Undo2 } from "lucide-react";
import { OnboardingTour, isOnboardingDone, resetOnboarding } from "@/components/OnboardingTour";

export const Route = createFileRoute("/editor/$id")({
  head: () => ({ meta: [{ title: "Editor - Mindora" }] }),
  component: EditorPage,
});

const MODE_LABEL: Record<string, string> = {
  study: "Estudo",
  brainstorm: "Brainstorm",
  project: "Projeto",
};

function EditorPage() {
  const { id } = useParams({ from: "/editor/$id" });
  const { user, initialized, init } = useAuth();
  const navigate = useNavigate();
  const [map, setMap] = useState<MindMap | null>(null);
  const [loadingMap, setLoadingMap] = useState(true);
  const [view, setView] = useState<"tree" | "graph">("graph");
  const orientation = "horizontal" as const;
  const [connectMode, setConnectMode] = useState(false);
  const [organizeSignal, setOrganizeSignal] = useState(0);
  const [undoSignal, setUndoSignal] = useState(0);
  const [showTour, setShowTour] = useState(false);
  const tourScheduledRef = useRef(false);

  useEffect(() => {
    init();
  }, [init]);

  const userId = user?.id;
  const userEmail = user?.email;
  const userRole = user?.role;
  const userAccessGranted = user?.accessGranted;

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!initialized) return;
      if (!userId || !userEmail) {
        navigate({ to: "/login" });
        return;
      }

      if (userRole !== "superadmin" && !userAccessGranted) {
        navigate({ to: "/activate" });
        return;
      }

      setLoadingMap(true);

      try {
        const loadedMap = await getMap(id, { id: userId, email: userEmail });
        if (!loadedMap) {
          navigate({ to: "/dashboard" });
          return;
        }

        if (!cancelled) {
          setMap(loadedMap);
          setView(loadedMap.mode === "study" ? "tree" : "graph");
        }
      } catch (error) {
        console.error("Falha ao carregar mapa", error);
        navigate({ to: "/dashboard" });
      } finally {
        if (!cancelled) setLoadingMap(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [id, initialized, userId, userEmail, userRole, userAccessGranted, navigate]);

  // Show tour on first visit — delayed so the editor is fully rendered
  useEffect(() => {
    if (!map || !userId || tourScheduledRef.current) return;
    tourScheduledRef.current = true;
    if (!isOnboardingDone(userId)) {
      const t = window.setTimeout(() => setShowTour(true), 1200);
      return () => window.clearTimeout(t);
    }
  }, [map, userId]);

  const handleShowTour = () => {
    if (userId) resetOnboarding(userId);
    setShowTour(true);
  };

  if (!initialized) return null;
  if (!user) return null;
  if (user.role !== "superadmin" && !user.accessGranted) return null;

  if (loadingMap || !map) {
    return (
      <div className="h-screen flex flex-col">
        <Header>
          <div className="h-4 w-44 animate-pulse rounded-full bg-muted" />
        </Header>
        <div className="relative flex-1 overflow-hidden bg-background">
          {/* Dot-grid background matching ReactFlow */}
          <svg className="absolute inset-0 h-full w-full opacity-[0.18]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="dots" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" fill="currentColor" className="text-foreground" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots)" />
          </svg>
          {/* Centered loading indicator */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-5">
            <div className="relative">
              <div className="absolute inset-0 animate-ping rounded-2xl bg-primary/20" />
              <div className="relative grid h-16 w-16 place-items-center rounded-2xl bg-[image:var(--gradient-hero)] text-primary-foreground shadow-xl">
                <Brain size={28} />
              </div>
            </div>
            <div className="flex flex-col items-center gap-1.5">
              <p className="text-sm font-medium text-foreground">Preparando seu mapa...</p>
              <p className="text-xs text-muted-foreground">Aguarde um instante</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col">
      <Header>
        <h1 className="font-semibold truncate">{map.title}</h1>
        {map.parentMapId && (
          <button
            onClick={() => navigate({ to: "/editor/$id", params: { id: map.parentMapId! } })}
            className="px-3 py-1.5 rounded-lg hover:bg-muted text-sm flex items-center gap-1.5"
            title="Voltar ao mapa anterior"
          >
            <ArrowLeft size={14} /> Voltar
          </button>
        )}
        <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-accent text-accent-foreground">
          {MODE_LABEL[map.mode] || "Brainstorm"}
        </span>

        <div className="ml-auto flex items-center gap-1 bg-muted rounded-lg p-1">
          <button
            onClick={() => setView("tree")}
            className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 transition-all ${view === "tree" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
          >
            <GitBranch size={14} /> Árvore
          </button>
          <button
            onClick={() => setView("graph")}
            className={`px-3 py-1.5 rounded-md text-sm flex items-center gap-1.5 transition-all ${view === "graph" ? "bg-card shadow-sm" : "text-muted-foreground"}`}
          >
            <Network size={14} /> Grafo
          </button>
        </div>

        <button
          onClick={() => setConnectMode(!connectMode)}
          className={`px-3 py-1.5 rounded-lg text-sm flex items-center gap-1.5 transition-colors ${
            connectMode ? "bg-primary text-primary-foreground" : "hover:bg-muted"
          }`}
          title="Modo conexão (Esc para sair)"
        >
          <Link2 size={14} /> Conectar
        </button>

        <button
          onClick={() => setOrganizeSignal((signal) => signal + 1)}
          className="px-3 py-1.5 rounded-lg hover:bg-muted text-sm flex items-center gap-1.5"
          title="Organizar automaticamente"
        >
          <Wand2 size={14} /> Organizar
        </button>

        <button
          onClick={() => setUndoSignal((signal) => signal + 1)}
          className="px-3 py-1.5 rounded-lg hover:bg-muted text-sm flex items-center gap-1.5"
          title="Desfazer (Ctrl+Z)"
        >
          <Undo2 size={14} />
        </button>

        <button
          onClick={() => window.dispatchEvent(new Event("mm-center"))}
          className="px-3 py-1.5 rounded-lg hover:bg-muted text-sm flex items-center gap-1.5"
          title="Centralizar mapa"
        >
          <Crosshair size={14} />
        </button>
      </Header>
      <div className="flex-1 relative">
        <MindMapEditor
          map={map}
          mode={view}
          orientation={orientation}
          connectMode={connectMode}
          setConnectMode={setConnectMode}
          organizeSignal={organizeSignal}
          undoSignal={undoSignal}
          userId={user.id}
          onShowTour={handleShowTour}
        />
      </div>

      {showTour && userId && (
        <OnboardingTour userId={userId} onDone={() => setShowTour(false)} />
      )}
    </div>
  );
}
