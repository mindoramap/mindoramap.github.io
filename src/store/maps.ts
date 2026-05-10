// Mind map repository with Supabase persistence and local migration fallback
import type { Edge, Node } from "reactflow";
import { supabase } from "@/lib/supabase";

export type MapMode = "study" | "brainstorm" | "project";
export type NodeKind = "text" | "checklist" | "code" | "link";
export interface ViewportState {
  x: number;
  y: number;
  zoom: number;
}

export interface MindNodeData {
  label: string;
  isRoot?: boolean;
  kind?: NodeKind;
  checked?: boolean;
  url?: string;
  linkedMapId?: string;
}

export interface MapOwner {
  id: string;
  email: string;
}

export interface MindMap {
  id: string;
  ownerId: string;
  ownerEmail: string;
  title: string;
  folderId: string | null;
  parentMapId?: string | null;
  isFavorite: boolean;
  mode: MapMode;
  updatedAt: number;
  viewport: ViewportState;
  nodes: Node<MindNodeData>[];
  edges: Edge[];
  history?: { nodes: Node<MindNodeData>[]; edges: Edge[]; at: number }[];
}

export interface MindFolder {
  id: string;
  ownerId: string;
  ownerEmail: string;
  name: string;
  parentId: string | null;
  createdAt: number;
  updatedAt: number;
}

interface MindMapRow {
  id: string;
  owner_id: string;
  owner_email: string;
  title: string;
  folder_id: string | null;
  parent_map_id: string | null;
  is_favorite: boolean | null;
  mode: MapMode;
  updated_at: string;
  viewport: ViewportState | null;
  nodes: Node<MindNodeData>[];
  edges: Edge[];
  history: { nodes: Node<MindNodeData>[]; edges: Edge[]; at: number }[] | null;
}

interface MindFolderRow {
  id: string;
  owner_id: string;
  owner_email: string;
  name: string;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

const KEY = "mm_maps";
const FOLDERS_KEY = "mm_folders";
const MIGRATION_PREFIX = "mm_maps_migrated_";
const FOLDERS_MIGRATION_PREFIX = "mm_folders_migrated_";
const TABLE = "mind_maps";
const FOLDERS_TABLE = "mind_folders";
const DEFAULT_VIEWPORT: ViewportState = { x: 0, y: 0, zoom: 1 };
let warnedAboutSchemaFallback = false;

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const normalizeOptionalEmail = (email?: string) => (email ? normalizeEmail(email) : "");
const warnSchemaFallback = () => {
  if (warnedAboutSchemaFallback) return;
  warnedAboutSchemaFallback = true;
  console.warn(
    "[maps] Supabase schema for folders/viewport is missing. Falling back to local persistence until the migration is applied."
  );
};

const isSchemaCapabilityError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;

  const details = [
    "message" in error ? error.message : "",
    "details" in error ? error.details : "",
    "hint" in error ? error.hint : "",
    "code" in error ? error.code : "",
  ]
    .filter((value) => typeof value === "string")
    .join(" ")
    .toLowerCase();

  return (
    details.includes("mind_folders") ||
    details.includes("folder_id") ||
    details.includes("parent_map_id") ||
    details.includes("viewport") ||
    details.includes("is_favorite") ||
    details.includes("42p01") ||
    details.includes("42703") ||
    details.includes("pgrst204")
  );
};

const mergeMapsById = (remoteMaps: MindMap[], localMaps: MindMap[]) => {
  const merged = new Map<string, MindMap>();

  [...remoteMaps, ...localMaps].forEach((map) => {
    const current = merged.get(map.id);
    if (!current || map.updatedAt >= current.updatedAt) {
      merged.set(map.id, map);
    }
  });

  return [...merged.values()].sort((a, b) => b.updatedAt - a.updatedAt);
};

const mergeFoldersById = (remoteFolders: MindFolder[], localFolders: MindFolder[]) => {
  const merged = new Map<string, MindFolder>();

  [...remoteFolders, ...localFolders].forEach((folder) => {
    const current = merged.get(folder.id);
    if (!current || folder.updatedAt >= current.updatedAt) {
      merged.set(folder.id, folder);
    }
  });

  return [...merged.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
};

const readAllMaps = (): MindMap[] => {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
};

const saveAllMaps = (maps: MindMap[]) => localStorage.setItem(KEY, JSON.stringify(maps));
const readAllFolders = (): MindFolder[] => {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(FOLDERS_KEY) || "[]");
  } catch {
    return [];
  }
};

const saveAllFolders = (folders: MindFolder[]) => localStorage.setItem(FOLDERS_KEY, JSON.stringify(folders));

const normalizeLocalMap = (map: Partial<MindMap>, owner: MapOwner): MindMap => {
  const ownerEmail = normalizeOptionalEmail(map.ownerEmail);
  const ownerId = map.ownerId || (ownerEmail && ownerEmail === normalizeEmail(owner.email) ? owner.id : "");

  return {
    id: map.id || crypto.randomUUID(),
    ownerId,
    ownerEmail,
    title: map.title || "Sem titulo",
    folderId: map.folderId || null,
    parentMapId: map.parentMapId || null,
    isFavorite: Boolean(map.isFavorite),
    mode: (map.mode as MapMode) || "brainstorm",
    updatedAt: typeof map.updatedAt === "number" ? map.updatedAt : Date.now(),
    viewport:
      map.viewport &&
      typeof map.viewport.x === "number" &&
      typeof map.viewport.y === "number" &&
      typeof map.viewport.zoom === "number"
        ? map.viewport
        : DEFAULT_VIEWPORT,
    nodes: Array.isArray(map.nodes) ? map.nodes : [],
    edges: Array.isArray(map.edges) ? map.edges : [],
    history: Array.isArray(map.history) ? map.history : [],
  };
};

const normalizeLocalFolder = (folder: Partial<MindFolder>, owner: MapOwner): MindFolder => ({
  id: folder.id || crypto.randomUUID(),
  ownerId: folder.ownerId || owner.id,
  ownerEmail: normalizeOptionalEmail(folder.ownerEmail) || normalizeEmail(owner.email),
  name: folder.name?.trim() || "Nova pasta",
  parentId: folder.parentId || null,
  createdAt: typeof folder.createdAt === "number" ? folder.createdAt : Date.now(),
  updatedAt: typeof folder.updatedAt === "number" ? folder.updatedAt : Date.now(),
});

const migrateLegacyLocalMaps = (owner: MapOwner): MindMap[] => {
  const maps = readAllMaps();
  let changed = false;

  const migrated = maps.map((map) => {
    const current = normalizeLocalMap(map, owner);
    if (
      map.ownerId === current.ownerId &&
      map.ownerEmail === current.ownerEmail &&
      map.title === current.title &&
      map.updatedAt === current.updatedAt
    ) {
      return map as MindMap;
    }

    changed = true;
    return current;
  });

  if (changed) saveAllMaps(migrated);
  return migrated;
};

const loadLocalMaps = (owner: MapOwner): MindMap[] =>
  migrateLegacyLocalMaps(owner).filter(
    (map) =>
      map.ownerId === owner.id || normalizeEmail(map.ownerEmail) === normalizeEmail(owner.email)
  );

const migrateLegacyLocalFolders = (owner: MapOwner): MindFolder[] => {
  const folders = readAllFolders();
  let changed = false;

  const migrated = folders.map((folder) => {
    const current = normalizeLocalFolder(folder, owner);
    if (
      folder.ownerId === current.ownerId &&
      folder.ownerEmail === current.ownerEmail &&
      folder.name === current.name &&
      folder.updatedAt === current.updatedAt
    ) {
      return folder as MindFolder;
    }

    changed = true;
    return current;
  });

  if (changed) saveAllFolders(migrated);
  return migrated;
};

const loadLocalFolders = (owner: MapOwner): MindFolder[] =>
  migrateLegacyLocalFolders(owner).filter(
    (folder) =>
      folder.ownerId === owner.id || normalizeEmail(folder.ownerEmail) === normalizeEmail(owner.email)
  );

const removeLocalMapsForOwner = (owner: MapOwner) => {
  saveAllMaps(
    readAllMaps().filter(
      (map) =>
        map.ownerId !== owner.id && normalizeEmail(map.ownerEmail) !== normalizeEmail(owner.email)
    )
  );
};

const removeLocalFoldersForOwner = (owner: MapOwner) => {
  saveAllFolders(
    readAllFolders().filter(
      (folder) =>
        folder.ownerId !== owner.id && normalizeEmail(folder.ownerEmail) !== normalizeEmail(owner.email)
    )
  );
};

const getMigrationKey = (owner: MapOwner) => `${MIGRATION_PREFIX}${owner.id}`;
const getFoldersMigrationKey = (owner: MapOwner) => `${FOLDERS_MIGRATION_PREFIX}${owner.id}`;

const toRow = (map: MindMap): MindMapRow => ({
  id: map.id,
  owner_id: map.ownerId,
  owner_email: normalizeEmail(map.ownerEmail),
  title: map.title,
  folder_id: map.folderId,
  parent_map_id: map.parentMapId || null,
  is_favorite: map.isFavorite,
  mode: map.mode,
  updated_at: new Date(map.updatedAt).toISOString(),
  viewport: map.viewport,
  nodes: map.nodes,
  edges: map.edges,
  history: map.history || [],
});

const folderToRow = (folder: MindFolder): MindFolderRow => ({
  id: folder.id,
  owner_id: folder.ownerId,
  owner_email: normalizeEmail(folder.ownerEmail),
  name: folder.name,
  parent_id: folder.parentId,
  created_at: new Date(folder.createdAt).toISOString(),
  updated_at: new Date(folder.updatedAt).toISOString(),
});

const fromRow = (row: MindMapRow): MindMap => ({
  id: row.id,
  ownerId: row.owner_id,
  ownerEmail: normalizeEmail(row.owner_email),
  title: row.title,
  folderId: row.folder_id,
  parentMapId: row.parent_map_id,
  isFavorite: Boolean(row.is_favorite),
  mode: row.mode,
  updatedAt: new Date(row.updated_at).getTime(),
  viewport: row.viewport || DEFAULT_VIEWPORT,
  nodes: row.nodes || [],
  edges: row.edges || [],
  history: row.history || [],
});

const folderFromRow = (row: MindFolderRow): MindFolder => ({
  id: row.id,
  ownerId: row.owner_id,
  ownerEmail: normalizeEmail(row.owner_email),
  name: row.name,
  parentId: row.parent_id,
  createdAt: new Date(row.created_at).getTime(),
  updatedAt: new Date(row.updated_at).getTime(),
});

export const migrateLocalMapsToSupabase = async (owner: MapOwner) => {
  if (!supabase || typeof window === "undefined") return;

  const migrationKey = getMigrationKey(owner);
  if (localStorage.getItem(migrationKey) === "done") return;

  const localMaps = loadLocalMaps(owner);
  if (localMaps.length === 0) {
    localStorage.setItem(migrationKey, "done");
    return;
  }

  const { error } = await supabase.from(TABLE).upsert(localMaps.map(toRow), { onConflict: "id" });
  if (error) {
    if (isSchemaCapabilityError(error)) {
      warnSchemaFallback();
      return;
    }
    throw error;
  }

  removeLocalMapsForOwner(owner);
  localStorage.setItem(migrationKey, "done");
};

export const migrateLocalFoldersToSupabase = async (owner: MapOwner) => {
  if (!supabase || typeof window === "undefined") return;

  const migrationKey = getFoldersMigrationKey(owner);
  if (localStorage.getItem(migrationKey) === "done") return;

  const localFolders = loadLocalFolders(owner);
  if (localFolders.length === 0) {
    localStorage.setItem(migrationKey, "done");
    return;
  }

  const { error } = await supabase.from(FOLDERS_TABLE).upsert(localFolders.map(folderToRow), { onConflict: "id" });
  if (error) {
    if (isSchemaCapabilityError(error)) {
      warnSchemaFallback();
      return;
    }
    throw error;
  }

  removeLocalFoldersForOwner(owner);
  localStorage.setItem(migrationKey, "done");
};

export const loadMaps = async (owner: MapOwner): Promise<MindMap[]> => {
  if (!supabase) {
    return loadLocalMaps(owner).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  const localMaps = loadLocalMaps(owner);
  await migrateLocalFoldersToSupabase(owner);
  await migrateLocalMapsToSupabase(owner);

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("owner_id", owner.id)
    .order("updated_at", { ascending: false });

  if (error) {
    if (isSchemaCapabilityError(error)) {
      warnSchemaFallback();
      return localMaps.sort((a, b) => b.updatedAt - a.updatedAt);
    }
    throw error;
  }
  return mergeMapsById((data || []).map(fromRow), localMaps);
};

export const getMap = async (id: string, owner: MapOwner) => {
  if (!supabase) {
    return loadLocalMaps(owner).find((map) => map.id === id);
  }

  const localMap = loadLocalMaps(owner).find((map) => map.id === id);
  await migrateLocalFoldersToSupabase(owner);
  await migrateLocalMapsToSupabase(owner);

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .eq("owner_id", owner.id)
    .maybeSingle();

  if (error) {
    if (isSchemaCapabilityError(error)) {
      warnSchemaFallback();
      return localMap;
    }
    throw error;
  }
  return data ? fromRow(data) : localMap;
};

export const upsertMap = async (map: MindMap) => {
  if (!supabase) {
    const maps = readAllMaps();
    const index = maps.findIndex((storedMap) => storedMap.id === map.id);
    if (index >= 0) maps[index] = map;
    else maps.push(map);
    saveAllMaps(maps);
    return;
  }

  const { error } = await supabase.from(TABLE).upsert(toRow(map), { onConflict: "id" });
  if (error) {
    if (isSchemaCapabilityError(error)) {
      warnSchemaFallback();
      const maps = readAllMaps();
      const index = maps.findIndex((storedMap) => storedMap.id === map.id);
      if (index >= 0) maps[index] = map;
      else maps.push(map);
      saveAllMaps(maps);
      return;
    }
    throw error;
  }
};

export const loadFolders = async (owner: MapOwner): Promise<MindFolder[]> => {
  if (!supabase) {
    return loadLocalFolders(owner).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }

  const localFolders = loadLocalFolders(owner);
  await migrateLocalFoldersToSupabase(owner);

  const { data, error } = await supabase
    .from(FOLDERS_TABLE)
    .select("*")
    .eq("owner_id", owner.id)
    .order("name", { ascending: true });

  if (error) {
    if (isSchemaCapabilityError(error)) {
      warnSchemaFallback();
      return localFolders.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
    }
    throw error;
  }
  return mergeFoldersById((data || []).map(folderFromRow), localFolders);
};

export const upsertFolder = async (folder: MindFolder) => {
  if (!supabase) {
    const folders = readAllFolders();
    const index = folders.findIndex((storedFolder) => storedFolder.id === folder.id);
    if (index >= 0) folders[index] = folder;
    else folders.push(folder);
    saveAllFolders(folders);
    return;
  }

  const { error } = await supabase.from(FOLDERS_TABLE).upsert(folderToRow(folder), { onConflict: "id" });
  if (error) {
    if (isSchemaCapabilityError(error)) {
      warnSchemaFallback();
      const folders = readAllFolders();
      const index = folders.findIndex((storedFolder) => storedFolder.id === folder.id);
      if (index >= 0) folders[index] = folder;
      else folders.push(folder);
      saveAllFolders(folders);
      return;
    }
    throw error;
  }
};

export const deleteFolder = async (id: string, owner: MapOwner) => {
  if (!supabase) {
    const folders = readAllFolders().filter(
      (folder) =>
        !(folder.id === id && (folder.ownerId === owner.id || normalizeEmail(folder.ownerEmail) === normalizeEmail(owner.email)))
    );
    saveAllFolders(folders);
    const maps = readAllMaps().map((map) => (map.folderId === id ? { ...map, folderId: null } : map));
    saveAllMaps(maps);
    return;
  }

  const { error: mapsError } = await supabase
    .from(TABLE)
    .update({ folder_id: null })
    .eq("folder_id", id)
    .eq("owner_id", owner.id);
  if (mapsError) {
    if (isSchemaCapabilityError(mapsError)) {
      warnSchemaFallback();
      const folders = readAllFolders().filter(
        (folder) =>
          !(folder.id === id && (folder.ownerId === owner.id || normalizeEmail(folder.ownerEmail) === normalizeEmail(owner.email)))
      );
      saveAllFolders(folders);
      const maps = readAllMaps().map((map) => (map.folderId === id ? { ...map, folderId: null } : map));
      saveAllMaps(maps);
      return;
    }
    throw mapsError;
  }

  const { error } = await supabase.from(FOLDERS_TABLE).delete().eq("id", id).eq("owner_id", owner.id);
  if (error) {
    if (isSchemaCapabilityError(error)) {
      warnSchemaFallback();
      const folders = readAllFolders().filter(
        (folder) =>
          !(folder.id === id && (folder.ownerId === owner.id || normalizeEmail(folder.ownerEmail) === normalizeEmail(owner.email)))
      );
      saveAllFolders(folders);
      return;
    }
    throw error;
  }
};

export const deleteMap = async (id: string, owner: MapOwner) => {
  if (!supabase) {
    saveAllMaps(
      readAllMaps().filter(
        (map) =>
          !(
            map.id === id &&
            (map.ownerId === owner.id || normalizeEmail(map.ownerEmail) === normalizeEmail(owner.email))
          )
      )
    );
    return;
  }

  const { error } = await supabase.from(TABLE).delete().eq("id", id).eq("owner_id", owner.id);
  if (error) throw error;
};

export const createBlankMap = (
  owner: MapOwner,
  title: string,
  mode: MapMode = "brainstorm",
  options?: { folderId?: string | null; parentMapId?: string | null; viewport?: ViewportState }
): MindMap => ({
  id: crypto.randomUUID(),
  ownerId: owner.id,
  ownerEmail: normalizeEmail(owner.email),
  title,
  folderId: options?.folderId || null,
  parentMapId: options?.parentMapId || null,
  isFavorite: false,
  mode,
  updatedAt: Date.now(),
  viewport: options?.viewport || DEFAULT_VIEWPORT,
  nodes: [
    {
      id: "root",
      type: "mind",
      position: { x: 0, y: 0 },
      data: { label: title || "Ideia central", isRoot: true, kind: "text" },
    },
  ],
  edges: [],
  history: [],
});

export type TemplateId = "blank" | "brainstorm" | "study" | "project";

export const createMapFromTemplate = (
  owner: MapOwner,
  templateId: TemplateId,
  options?: { folderId?: string | null }
): MindMap => {
  const base = {
    id: crypto.randomUUID(),
    ownerId: owner.id,
    ownerEmail: normalizeEmail(owner.email),
    folderId: options?.folderId || null,
    parentMapId: null as string | null,
    isFavorite: false,
    updatedAt: Date.now(),
    viewport: DEFAULT_VIEWPORT,
    history: [] as MindMap["history"],
  };

  if (templateId === "brainstorm") {
    const ids = Array.from({ length: 5 }, () => crypto.randomUUID());
    const labels = ["Contexto", "Problema", "Ideia principal", "Oportunidades", "Próximos passos"];
    const yPositions = [-160, -80, 0, 80, 160];
    return {
      ...base,
      title: "Brainstorm",
      mode: "brainstorm",
      nodes: [
        { id: "root", type: "mind", position: { x: 0, y: 0 }, data: { label: "Brainstorm", isRoot: true, kind: "text" } },
        ...ids.map((id, i) => ({
          id,
          type: "mind",
          position: { x: 260, y: yPositions[i] },
          data: { label: labels[i], kind: "text" as NodeKind },
        })),
      ],
      edges: ids.map((id) => ({
        id: `e-root-${id}`,
        source: "root",
        target: id,
        sourceHandle: "source-right",
        targetHandle: "target-left",
        data: { kind: "tree", treeSide: "right" },
      })),
    };
  }

  if (templateId === "study") {
    const [c1, c2, c3, c1a, c1b, c2a, c3a] = Array.from({ length: 7 }, () => crypto.randomUUID());
    return {
      ...base,
      title: "Mapa de Estudo",
      mode: "study",
      nodes: [
        { id: "root", type: "mind", position: { x: 0, y: 0 }, data: { label: "Tema principal", isRoot: true, kind: "text" } },
        { id: c1, type: "mind", position: { x: 260, y: -150 }, data: { label: "Conceitos fundamentais", kind: "text" as NodeKind } },
        { id: c1a, type: "mind", position: { x: 520, y: -200 }, data: { label: "Definição", kind: "text" as NodeKind } },
        { id: c1b, type: "mind", position: { x: 520, y: -100 }, data: { label: "Características", kind: "text" as NodeKind } },
        { id: c2, type: "mind", position: { x: 260, y: 0 }, data: { label: "Exemplos práticos", kind: "text" as NodeKind } },
        { id: c2a, type: "mind", position: { x: 520, y: 0 }, data: { label: "Exemplo 1", kind: "text" as NodeKind } },
        { id: c3, type: "mind", position: { x: 260, y: 150 }, data: { label: "Revisão", kind: "text" as NodeKind } },
        { id: c3a, type: "mind", position: { x: 520, y: 150 }, data: { label: "Pontos-chave", kind: "text" as NodeKind } },
      ],
      edges: [
        { id: `e-r-c1`, source: "root", target: c1, sourceHandle: "source-right", targetHandle: "target-left", data: { kind: "tree", treeSide: "right" } },
        { id: `e-c1-c1a`, source: c1, target: c1a, sourceHandle: "source-right", targetHandle: "target-left", data: { kind: "tree", treeSide: "right" } },
        { id: `e-c1-c1b`, source: c1, target: c1b, sourceHandle: "source-right", targetHandle: "target-left", data: { kind: "tree", treeSide: "right" } },
        { id: `e-r-c2`, source: "root", target: c2, sourceHandle: "source-right", targetHandle: "target-left", data: { kind: "tree", treeSide: "right" } },
        { id: `e-c2-c2a`, source: c2, target: c2a, sourceHandle: "source-right", targetHandle: "target-left", data: { kind: "tree", treeSide: "right" } },
        { id: `e-r-c3`, source: "root", target: c3, sourceHandle: "source-right", targetHandle: "target-left", data: { kind: "tree", treeSide: "right" } },
        { id: `e-c3-c3a`, source: c3, target: c3a, sourceHandle: "source-right", targetHandle: "target-left", data: { kind: "tree", treeSide: "right" } },
      ],
    };
  }

  if (templateId === "project") {
    const [p1, p2, p3, t1, t2, t3, t4, t5] = Array.from({ length: 8 }, () => crypto.randomUUID());
    return {
      ...base,
      title: "Plano de Projeto",
      mode: "project",
      nodes: [
        { id: "root", type: "mind", position: { x: 0, y: 0 }, data: { label: "Meu Projeto", isRoot: true, kind: "text" } },
        { id: p1, type: "mind", position: { x: 260, y: -150 }, data: { label: "Planejamento", kind: "checklist" as NodeKind } },
        { id: t1, type: "mind", position: { x: 520, y: -200 }, data: { label: "Definir escopo", kind: "checklist" as NodeKind } },
        { id: t2, type: "mind", position: { x: 520, y: -100 }, data: { label: "Levantar requisitos", kind: "checklist" as NodeKind } },
        { id: p2, type: "mind", position: { x: 260, y: 0 }, data: { label: "Execução", kind: "checklist" as NodeKind } },
        { id: t3, type: "mind", position: { x: 520, y: -30 }, data: { label: "Desenvolver", kind: "checklist" as NodeKind } },
        { id: t4, type: "mind", position: { x: 520, y: 70 }, data: { label: "Revisar", kind: "checklist" as NodeKind } },
        { id: p3, type: "mind", position: { x: 260, y: 150 }, data: { label: "Entrega", kind: "checklist" as NodeKind } },
        { id: t5, type: "mind", position: { x: 520, y: 150 }, data: { label: "Publicar", kind: "checklist" as NodeKind } },
      ],
      edges: [
        { id: `e-r-p1`, source: "root", target: p1, sourceHandle: "source-right", targetHandle: "target-left", data: { kind: "tree", treeSide: "right" } },
        { id: `e-p1-t1`, source: p1, target: t1, sourceHandle: "source-right", targetHandle: "target-left", data: { kind: "tree", treeSide: "right" } },
        { id: `e-p1-t2`, source: p1, target: t2, sourceHandle: "source-right", targetHandle: "target-left", data: { kind: "tree", treeSide: "right" } },
        { id: `e-r-p2`, source: "root", target: p2, sourceHandle: "source-right", targetHandle: "target-left", data: { kind: "tree", treeSide: "right" } },
        { id: `e-p2-t3`, source: p2, target: t3, sourceHandle: "source-right", targetHandle: "target-left", data: { kind: "tree", treeSide: "right" } },
        { id: `e-p2-t4`, source: p2, target: t4, sourceHandle: "source-right", targetHandle: "target-left", data: { kind: "tree", treeSide: "right" } },
        { id: `e-r-p3`, source: "root", target: p3, sourceHandle: "source-right", targetHandle: "target-left", data: { kind: "tree", treeSide: "right" } },
        { id: `e-p3-t5`, source: p3, target: t5, sourceHandle: "source-right", targetHandle: "target-left", data: { kind: "tree", treeSide: "right" } },
      ],
    };
  }

  // blank
  return createBlankMap(owner, "Novo mapa", "brainstorm", options);
};

export const createFolder = (owner: MapOwner, name: string, parentId: string | null = null): MindFolder => ({
  id: crypto.randomUUID(),
  ownerId: owner.id,
  ownerEmail: normalizeEmail(owner.email),
  name: name.trim() || "Nova pasta",
  parentId,
  createdAt: Date.now(),
  updatedAt: Date.now(),
});

export const updateMapViewport = async (map: MindMap, viewport: ViewportState) => {
  await upsertMap({
    ...map,
    viewport,
    updatedAt: Date.now(),
  });
};
