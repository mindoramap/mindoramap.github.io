import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/store/auth";
import { Header } from "@/components/Header";
import { createBlankMap, deleteMap, loadMaps, upsertMap, type MapMode, type MindMap } from "@/store/maps";
import { Plus, Trash2, FileText, BookOpen, Rocket, ListChecks } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard - Mindora" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user, initialized, init } = useAuth();
  const navigate = useNavigate();
  const [maps, setMaps] = useState<MindMap[]>([]);
  const [loadingMaps, setLoadingMaps] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [title, setTitle] = useState("");
  const [mode, setMode] = useState<MapMode>("brainstorm");

  useEffect(() => {
    init();
  }, [init]);

  useEffect(() => {
    if (!initialized) return;
    if (!user) {
      navigate({ to: "/login" });
      return;
    }

    if (user.role !== "superadmin" && !user.accessGranted) {
      navigate({ to: "/activate" });
    }
  }, [initialized, user, navigate]);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!user || (user.role !== "superadmin" && !user.accessGranted)) {
        setLoadingMaps(false);
        return;
      }

      setLoadingMaps(true);

      try {
        const loadedMaps = await loadMaps({ id: user.id, email: user.email });
        if (!cancelled) setMaps(loadedMaps.sort((a, b) => b.updatedAt - a.updatedAt));
      } catch (error) {
        console.error("Falha ao carregar mapas", error);
        if (!cancelled) setMaps([]);
      } finally {
        if (!cancelled) setLoadingMaps(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const map = createBlankMap({ id: user.id, email: user.email }, title || "Sem titulo", mode);
    await upsertMap(map);
    navigate({ to: "/editor/$id", params: { id: map.id } });
  };

  const remove = async (id: string) => {
    if (!user) return;
    if (!confirm("Excluir este mapa?")) return;

    await deleteMap(id, { id: user.id, email: user.email });
    const updatedMaps = await loadMaps({ id: user.id, email: user.email });
    setMaps(updatedMaps.sort((a, b) => b.updatedAt - a.updatedAt));
  };

  if (!initialized) return null;
  if (!user) return null;
  if (user.role !== "superadmin" && !user.accessGranted) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 py-10">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Seus mapas</h1>
            <p className="text-muted-foreground mt-1">
              {maps.length === 0 ? "Comece criando seu primeiro mapa mental." : `${maps.length} mapa(s)`}
            </p>
          </div>
          <button
            onClick={() => {
              setTitle("");
              setShowModal(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[image:var(--gradient-hero)] text-primary-foreground font-medium hover:opacity-90 transition-opacity"
          >
            <Plus size={18} /> Novo mapa
          </button>
        </div>

        {loadingMaps ? (
          <div className="border border-border rounded-2xl py-20 text-center text-muted-foreground">
            Carregando mapas...
          </div>
        ) : maps.length === 0 ? (
          <div className="border-2 border-dashed border-border rounded-2xl py-20 text-center text-muted-foreground">
            <FileText className="mx-auto mb-3" />
            Nenhum mapa criado ainda.
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {maps.map((map) => (
              <div
                key={map.id}
                className="group bg-card border border-border rounded-xl p-5 hover:border-primary/60 hover:shadow-[var(--shadow-soft)] transition-all cursor-pointer"
                onClick={() => navigate({ to: "/editor/$id", params: { id: map.id } })}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold truncate">{map.title}</h3>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(map.id);
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    aria-label="Excluir"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {map.nodes.length} nos - {new Date(map.updatedAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm grid place-items-center px-4 z-50 animate-in fade-in">
          <form
            onSubmit={create}
            className="bg-card border border-border rounded-2xl p-6 w-full max-w-md shadow-[var(--shadow-soft)]"
          >
            <h2 className="text-lg font-semibold mb-4">Novo mapa mental</h2>
            <input
              autoFocus
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Titulo do mapa"
              className="w-full px-3 py-2.5 rounded-lg bg-input border border-border outline-none focus:ring-2 focus:ring-ring mb-4"
            />
            <p className="text-xs text-muted-foreground mb-2">Modo de uso</p>
            <div className="grid grid-cols-3 gap-2 mb-5">
              {([
                { id: "study", label: "Estudo", icon: <BookOpen size={16} />, desc: "Estrutura clara" },
                { id: "brainstorm", label: "Brainstorm", icon: <Rocket size={16} />, desc: "Liberdade total" },
                { id: "project", label: "Projeto", icon: <ListChecks size={16} />, desc: "Tarefas" },
              ] as const).map((mapMode) => (
                <button
                  type="button"
                  key={mapMode.id}
                  onClick={() => setMode(mapMode.id)}
                  className={`flex flex-col items-center gap-1 p-3 rounded-lg border text-xs transition-colors ${
                    mode === mapMode.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
                  }`}
                >
                  {mapMode.icon}
                  <span className="font-medium">{mapMode.label}</span>
                  <span className="text-[10px] text-muted-foreground">{mapMode.desc}</span>
                </button>
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg hover:bg-muted"
              >
                Cancelar
              </button>
              <button className="px-4 py-2 rounded-lg bg-[image:var(--gradient-hero)] text-primary-foreground font-medium">
                Criar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
