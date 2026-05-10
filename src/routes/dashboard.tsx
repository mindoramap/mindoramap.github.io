import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderOpen,
  ListChecks,
  Pencil,
  Plus,
  Rocket,
  Search,
  Star,
  Trash2,
} from "lucide-react";
import { Header } from "@/components/Header";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/store/auth";
import {
  createBlankMap,
  createFolder,
  deleteFolder,
  deleteMap,
  loadFolders,
  loadMaps,
  upsertFolder,
  upsertMap,
  type MapMode,
  type MindFolder,
  type MindMap,
} from "@/store/maps";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard - Mindora" }] }),
  component: DashboardPage,
});

function DashboardPage() {
  const { user, initialized, init } = useAuth();
  const navigate = useNavigate();
  const [maps, setMaps] = useState<MindMap[]>([]);
  const [folders, setFolders] = useState<MindFolder[]>([]);
  const [loadingMaps, setLoadingMaps] = useState(true);
  const [showMapModal, setShowMapModal] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderModalMode, setFolderModalMode] = useState<"create" | "rename">("create");
  const [folderBeingEdited, setFolderBeingEdited] = useState<MindFolder | null>(null);
  const [confirmDeleteFolder, setConfirmDeleteFolder] = useState<MindFolder | null>(null);
  const [confirmDeleteMap, setConfirmDeleteMap] = useState<MindMap | null>(null);
  const [title, setTitle] = useState("");
  const [folderName, setFolderName] = useState("");
  const [mode, setMode] = useState<MapMode>("brainstorm");
  const [search, setSearch] = useState("");
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({});
  const [draggedMapId, setDraggedMapId] = useState<string | null>(null);

  useEffect(() => {
    void init();
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
        const [loadedMaps, loadedFolders] = await Promise.all([
          loadMaps({ id: user.id, email: user.email }),
          loadFolders({ id: user.id, email: user.email }),
        ]);
        if (!cancelled) {
          setMaps(loadedMaps.sort((a, b) => b.updatedAt - a.updatedAt));
          setFolders(loadedFolders);
          setExpandedFolders((current) => ({
            ...Object.fromEntries(loadedFolders.map((folder) => [folder.id, true])),
            ...current,
          }));
        }
      } catch (error) {
        console.error("Falha ao carregar dashboard", error);
        if (!cancelled) {
          setMaps([]);
          setFolders([]);
          toast.error("Não foi possível carregar os mapas.");
        }
      } finally {
        if (!cancelled) setLoadingMaps(false);
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const folderChildren = useMemo(() => {
    const map = new Map<string | null, MindFolder[]>();
    folders.forEach((folder) => {
      const key = folder.parentId || null;
      const current = map.get(key) || [];
      current.push(folder);
      map.set(key, current.sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
    });
    return map;
  }, [folders]);

  const folderMap = useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders]);

  const breadcrumbs = useMemo(() => {
    if (!selectedFolderId) return [];
    const chain: MindFolder[] = [];
    let current = folderMap.get(selectedFolderId) || null;
    while (current) {
      chain.unshift(current);
      current = current.parentId ? folderMap.get(current.parentId) || null : null;
    }
    return chain;
  }, [folderMap, selectedFolderId]);

  const favoriteMaps = useMemo(() => maps.filter((map) => map.isFavorite), [maps]);

  const filteredMaps = useMemo(() => {
    const normalizedSearch = search.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().trim();
    return maps
      .filter((map) => (selectedFolderId ? map.folderId === selectedFolderId : true))
      .filter((map) => {
        if (!normalizedSearch) return true;
        const haystack = [map.title, map.mode]
          .join(" ")
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .toLowerCase();
        return haystack.includes(normalizedSearch);
      });
  }, [maps, search, selectedFolderId]);

  const refreshData = async () => {
    if (!user) return;
    const [loadedMaps, loadedFolders] = await Promise.all([
      loadMaps({ id: user.id, email: user.email }),
      loadFolders({ id: user.id, email: user.email }),
    ]);
    setMaps(loadedMaps.sort((a, b) => b.updatedAt - a.updatedAt));
    setFolders(loadedFolders);
  };

  const createMap = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    const map = createBlankMap({ id: user.id, email: user.email }, title || "Sem título", mode, {
      folderId: selectedFolderId,
    });
    await upsertMap(map);
    setShowMapModal(false);
    toast.success("Mapa criado com sucesso.");
    navigate({ to: "/editor/$id", params: { id: map.id } });
  };

  const submitFolderModal = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!user) return;

    if (folderModalMode === "create") {
      const folder = createFolder({ id: user.id, email: user.email }, folderName || "Nova pasta", selectedFolderId);
      await upsertFolder(folder);
      setFolders((current) => [...current, folder].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
      setExpandedFolders((current) => ({ ...current, [folder.id]: true }));
      toast.success("Pasta criada.");
    } else if (folderBeingEdited) {
      const updatedFolder = { ...folderBeingEdited, name: folderName.trim() || folderBeingEdited.name, updatedAt: Date.now() };
      await upsertFolder(updatedFolder);
      await refreshData();
      toast.success("Pasta renomeada.");
    }

    setFolderName("");
    setFolderBeingEdited(null);
    setShowFolderModal(false);
  };

  const toggleFolder = (folderId: string) => {
    setExpandedFolders((current) => ({ ...current, [folderId]: !current[folderId] }));
  };

  const openCreateFolderModal = () => {
    setFolderModalMode("create");
    setFolderName("");
    setFolderBeingEdited(null);
    setShowFolderModal(true);
  };

  const openRenameFolderModal = (folder: MindFolder) => {
    setFolderModalMode("rename");
    setFolderName(folder.name);
    setFolderBeingEdited(folder);
    setShowFolderModal(true);
  };

  const toggleFavorite = async (map: MindMap) => {
    await upsertMap({ ...map, isFavorite: !map.isFavorite, updatedAt: Date.now() });
    await refreshData();
    toast.success(map.isFavorite ? "Mapa removido dos favoritos." : "Mapa adicionado aos favoritos.");
  };

  const moveMapHandler = async (map: MindMap, folderId: string | null) => {
    await upsertMap({ ...map, folderId, updatedAt: Date.now() });
    await refreshData();
    toast.success(folderId ? "Mapa movido para a pasta selecionada." : "Mapa movido para a raiz.");
  };

  const renderFolderTree = (parentId: string | null = null, depth = 0): React.ReactNode =>
    (folderChildren.get(parentId) || []).map((folder) => {
      const isExpanded = expandedFolders[folder.id] ?? true;
      const isSelected = selectedFolderId === folder.id;
      const children = folderChildren.get(folder.id) || [];
      const isDroppableTarget = draggedMapId !== null;

      return (
        <div key={folder.id}>
          <div
            className={`group flex items-center gap-2 rounded-xl px-2 py-2 text-sm transition-colors ${
              isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted"
            } ${isDroppableTarget ? "data-[drop=true]:ring-2 data-[drop=true]:ring-primary/40" : ""}`}
            style={{ paddingLeft: `${depth * 14 + 8}px` }}
            data-drop={isDroppableTarget || undefined}
            onDragOver={(event) => {
              if (!draggedMapId) return;
              event.preventDefault();
            }}
            onDrop={(event) => {
              event.preventDefault();
              if (!draggedMapId) return;
              const droppedMap = maps.find((entry) => entry.id === draggedMapId);
              setDraggedMapId(null);
              if (!droppedMap) return;
              void moveMapHandler(droppedMap, folder.id);
            }}
          >
            <button type="button" onClick={() => toggleFolder(folder.id)} className="text-muted-foreground">
              {children.length > 0 ? (
                isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />
              ) : (
                <span className="block w-[14px]" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setSelectedFolderId(folder.id)}
              className="flex flex-1 items-center gap-2 text-left"
            >
              {isExpanded ? <FolderOpen size={16} /> : <Folder size={16} />}
              <span className="truncate">{folder.name}</span>
            </button>
            <button
              type="button"
              onClick={() => openRenameFolderModal(folder)}
              className="opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-foreground"
              title="Renomear pasta"
            >
              <Pencil size={14} />
            </button>
            <button
              type="button"
              onClick={() => setConfirmDeleteFolder(folder)}
              className="opacity-0 transition-opacity group-hover:opacity-100 text-muted-foreground hover:text-destructive"
              title="Excluir pasta"
            >
              <Trash2 size={14} />
            </button>
          </div>
          {isExpanded && children.length > 0 ? renderFolderTree(folder.id, depth + 1) : null}
        </div>
      );
    });

  if (!initialized) return null;
  if (!user) return null;
  if (user.role !== "superadmin" && !user.accessGranted) return null;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 overflow-hidden">
        <div className="mx-auto grid h-[calc(100vh-3.5rem)] max-w-7xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="rounded-3xl border border-border bg-card/90 p-4 shadow-[var(--shadow-soft)] backdrop-blur">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">Organização</h2>
                <p className="text-xs text-muted-foreground">Pastas, favoritos e acesso rápido.</p>
              </div>
              <button
                type="button"
                onClick={openCreateFolderModal}
                className="inline-flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:bg-muted"
              >
                <Plus size={12} /> Pasta
              </button>
            </div>

            <button
              type="button"
              onClick={() => setSelectedFolderId(null)}
              className={`mb-2 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors ${
                selectedFolderId === null ? "bg-primary/10 text-primary" : "hover:bg-muted"
              }`}
            >
              <Folder size={16} /> Todos os mapas
            </button>

            <div
              className="mb-3 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
              onDragOver={(event) => {
                if (!draggedMapId) return;
                event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (!draggedMapId) return;
                const droppedMap = maps.find((entry) => entry.id === draggedMapId);
                setDraggedMapId(null);
                if (!droppedMap) return;
                void moveMapHandler(droppedMap, null);
              }}
            >
              Arraste mapas aqui para mover para a raiz
            </div>

            <div className="space-y-1">{renderFolderTree()}</div>

            <div className="mt-6 border-t border-border pt-4">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Favoritos</h3>
              {favoriteMaps.length === 0 ? (
                <p className="text-xs text-muted-foreground">Marque mapas importantes para acessá-los aqui.</p>
              ) : (
                <div className="space-y-1">
                  {favoriteMaps.slice(0, 5).map((map) => (
                    <button
                      key={map.id}
                      type="button"
                      onClick={() => navigate({ to: "/editor/$id", params: { id: map.id } })}
                      className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition-colors hover:bg-muted"
                    >
                      <Star size={14} className="fill-current text-amber-500" />
                      <span className="truncate">{map.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </aside>

          <section className="min-w-0 rounded-3xl border border-border bg-card/90 p-5 shadow-[var(--shadow-soft)] backdrop-blur">
            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <button type="button" onClick={() => setSelectedFolderId(null)} className="hover:text-foreground">
                    Início
                  </button>
                  {breadcrumbs.map((folder) => (
                    <span key={folder.id} className="inline-flex items-center gap-2">
                      <ChevronRight size={12} />
                      <button type="button" onClick={() => setSelectedFolderId(folder.id)} className="hover:text-foreground">
                        {folder.name}
                      </button>
                    </span>
                  ))}
                </div>
                <h1 className="mt-2 text-3xl font-bold tracking-tight">
                  {selectedFolderId ? folderMap.get(selectedFolderId)?.name || "Pasta" : "Seus mapas"}
                </h1>
                <p className="mt-1 text-sm text-muted-foreground">
                  {filteredMaps.length === 0
                    ? "Crie mapas, organize por pastas e mantenha tudo fácil de encontrar."
                    : `${filteredMaps.length} mapa(s) nesta visão`}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <label className="relative block min-w-[260px]">
                  <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={16} />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Buscar por título ou modo"
                    className="w-full rounded-xl border border-border bg-background px-10 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setTitle("");
                    setMode("brainstorm");
                    setShowMapModal(true);
                  }}
                  className="inline-flex items-center gap-2 rounded-xl bg-[image:var(--gradient-hero)] px-4 py-2.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
                >
                  <Plus size={18} /> Novo mapa
                </button>
              </div>
            </div>

            {loadingMaps ? (
              <div className="rounded-2xl border border-border bg-background/60 py-20 text-center text-muted-foreground">
                Carregando mapas...
              </div>
            ) : filteredMaps.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-border py-20 text-center text-muted-foreground">
                <FileText className="mx-auto mb-3" />
                Nenhum mapa nesta área ainda.
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filteredMaps.map((map) => (
                  <div
                    key={map.id}
                    draggable
                    onDragStart={() => setDraggedMapId(map.id)}
                    onDragEnd={() => setDraggedMapId(null)}
                    className="group rounded-2xl border border-border bg-background/70 p-5 transition-all hover:border-primary/60 hover:shadow-[var(--shadow-soft)]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => navigate({ to: "/editor/$id", params: { id: map.id } })}
                        className="flex-1 text-left"
                      >
                        <h3 className="font-semibold">{map.title}</h3>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {map.nodes.length} nós · {new Date(map.updatedAt).toLocaleDateString("pt-BR")}
                        </p>
                      </button>
                      <button
                        type="button"
                        onClick={() => void toggleFavorite(map)}
                        className={`rounded-full p-2 transition-colors ${map.isFavorite ? "text-amber-500" : "text-muted-foreground hover:text-amber-500"}`}
                        title={map.isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
                      >
                        <Star size={16} className={map.isFavorite ? "fill-current" : ""} />
                      </button>
                    </div>

                    <div className="mt-4 flex items-center gap-2">
                      <select
                        value={map.folderId || ""}
                        onChange={(event) => void moveMapHandler(map, event.target.value || null)}
                        className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="">Sem pasta</option>
                        {folders.map((folder) => (
                          <option key={folder.id} value={folder.id}>
                            {folder.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => setConfirmDeleteMap(map)}
                        className="grid h-9 w-9 place-items-center rounded-lg border border-border text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive"
                        aria-label="Excluir mapa"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="rounded-full bg-muted px-2 py-1 uppercase tracking-wide">{map.mode}</span>
                      <span>{map.parentMapId ? "Submapa" : "Mapa raiz"}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>

      <Dialog open={showMapModal} onOpenChange={setShowMapModal}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Novo mapa mental</DialogTitle>
            <DialogDescription>Defina o título, o modo e a pasta inicial do mapa.</DialogDescription>
          </DialogHeader>
          <form onSubmit={createMap} className="space-y-4">
            <input
              autoFocus
              required
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Título do mapa"
              className="w-full rounded-xl border border-border bg-input px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
            />
            <div>
              <p className="mb-2 text-xs text-muted-foreground">Modo de uso</p>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: "study", label: "Estudo", icon: <BookOpen size={16} />, desc: "Estrutura clara" },
                  { id: "brainstorm", label: "Brainstorm", icon: <Rocket size={16} />, desc: "Exploração livre" },
                  { id: "project", label: "Projeto", icon: <ListChecks size={16} />, desc: "Tarefas e execução" },
                ] as const).map((entry) => (
                  <button
                    type="button"
                    key={entry.id}
                    onClick={() => setMode(entry.id)}
                    className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs transition-colors ${
                      mode === entry.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
                    }`}
                  >
                    {entry.icon}
                    <span className="font-medium">{entry.label}</span>
                    <span className="text-[10px] text-muted-foreground">{entry.desc}</span>
                  </button>
                ))}
              </div>
            </div>
            <DialogFooter>
              <button type="button" onClick={() => setShowMapModal(false)} className="rounded-xl px-4 py-2 hover:bg-muted">
                Cancelar
              </button>
              <button className="rounded-xl bg-[image:var(--gradient-hero)] px-4 py-2 font-medium text-primary-foreground">
                Criar
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showFolderModal}
        onOpenChange={(open) => {
          setShowFolderModal(open);
          if (!open) {
            setFolderName("");
            setFolderBeingEdited(null);
          }
        }}
      >
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>{folderModalMode === "create" ? "Nova pasta" : "Renomear pasta"}</DialogTitle>
            <DialogDescription>
              {folderModalMode === "create"
                ? "Crie uma pasta para organizar os mapas desta área."
                : "Atualize o nome da pasta para manter sua organização clara."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={submitFolderModal} className="space-y-4">
            <input
              autoFocus
              required
              value={folderName}
              onChange={(event) => setFolderName(event.target.value)}
              placeholder="Nome da pasta"
              className="w-full rounded-xl border border-border bg-input px-3 py-2.5 outline-none focus:ring-2 focus:ring-ring"
            />
            <DialogFooter>
              <button type="button" onClick={() => setShowFolderModal(false)} className="rounded-xl px-4 py-2 hover:bg-muted">
                Cancelar
              </button>
              <button className="rounded-xl bg-[image:var(--gradient-hero)] px-4 py-2 font-medium text-primary-foreground">
                {folderModalMode === "create" ? "Criar pasta" : "Salvar"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(confirmDeleteFolder)} onOpenChange={(open) => !open && setConfirmDeleteFolder(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Excluir pasta</DialogTitle>
            <DialogDescription>
              {confirmDeleteFolder
                ? `A pasta "${confirmDeleteFolder.name}" será excluída e os mapas voltarão para a raiz.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button type="button" onClick={() => setConfirmDeleteFolder(null)} className="rounded-xl px-4 py-2 hover:bg-muted">
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                if (!confirmDeleteFolder || !user) return;
                void (async () => {
                  await deleteFolder(confirmDeleteFolder.id, { id: user.id, email: user.email });
                  if (selectedFolderId === confirmDeleteFolder.id) setSelectedFolderId(null);
                  setConfirmDeleteFolder(null);
                  await refreshData();
                  toast.success("Pasta excluída.");
                })();
              }}
              className="rounded-xl bg-destructive px-4 py-2 font-medium text-destructive-foreground"
            >
              Excluir
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(confirmDeleteMap)} onOpenChange={(open) => !open && setConfirmDeleteMap(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Excluir mapa</DialogTitle>
            <DialogDescription>
              {confirmDeleteMap ? `O mapa "${confirmDeleteMap.title}" será removido permanentemente.` : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button type="button" onClick={() => setConfirmDeleteMap(null)} className="rounded-xl px-4 py-2 hover:bg-muted">
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                if (!confirmDeleteMap || !user) return;
                void (async () => {
                  await deleteMap(confirmDeleteMap.id, { id: user.id, email: user.email });
                  setConfirmDeleteMap(null);
                  await refreshData();
                  toast.success("Mapa excluído.");
                })();
              }}
              className="rounded-xl bg-destructive px-4 py-2 font-medium text-destructive-foreground"
            >
              Excluir
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
