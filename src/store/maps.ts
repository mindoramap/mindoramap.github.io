// Mind map repository with Supabase persistence and local migration fallback
import type { Edge, Node } from "reactflow";
import { supabase } from "@/lib/supabase";

export type MapMode = "study" | "brainstorm" | "project";
export type NodeKind = "text" | "checklist" | "code" | "link";

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
  mode: MapMode;
  updatedAt: number;
  nodes: Node<MindNodeData>[];
  edges: Edge[];
  history?: { nodes: Node<MindNodeData>[]; edges: Edge[]; at: number }[];
}

interface MindMapRow {
  id: string;
  owner_id: string;
  owner_email: string;
  title: string;
  mode: MapMode;
  updated_at: string;
  nodes: Node<MindNodeData>[];
  edges: Edge[];
  history: { nodes: Node<MindNodeData>[]; edges: Edge[]; at: number }[] | null;
}

const KEY = "mm_maps";
const MIGRATION_PREFIX = "mm_maps_migrated_";
const TABLE = "mind_maps";

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const normalizeOptionalEmail = (email?: string) => (email ? normalizeEmail(email) : "");

const readAllMaps = (): MindMap[] => {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
};

const saveAllMaps = (maps: MindMap[]) => localStorage.setItem(KEY, JSON.stringify(maps));

const normalizeLocalMap = (map: Partial<MindMap>, owner: MapOwner): MindMap => {
  const ownerEmail = normalizeOptionalEmail(map.ownerEmail);
  const ownerId = map.ownerId || (ownerEmail && ownerEmail === normalizeEmail(owner.email) ? owner.id : "");

  return {
    id: map.id || crypto.randomUUID(),
    ownerId,
    ownerEmail,
    title: map.title || "Sem titulo",
    mode: (map.mode as MapMode) || "brainstorm",
    updatedAt: typeof map.updatedAt === "number" ? map.updatedAt : Date.now(),
    nodes: Array.isArray(map.nodes) ? map.nodes : [],
    edges: Array.isArray(map.edges) ? map.edges : [],
    history: Array.isArray(map.history) ? map.history : [],
  };
};

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

const removeLocalMapsForOwner = (owner: MapOwner) => {
  saveAllMaps(
    readAllMaps().filter(
      (map) =>
        map.ownerId !== owner.id && normalizeEmail(map.ownerEmail) !== normalizeEmail(owner.email)
    )
  );
};

const getMigrationKey = (owner: MapOwner) => `${MIGRATION_PREFIX}${owner.id}`;

const toRow = (map: MindMap): MindMapRow => ({
  id: map.id,
  owner_id: map.ownerId,
  owner_email: normalizeEmail(map.ownerEmail),
  title: map.title,
  mode: map.mode,
  updated_at: new Date(map.updatedAt).toISOString(),
  nodes: map.nodes,
  edges: map.edges,
  history: map.history || [],
});

const fromRow = (row: MindMapRow): MindMap => ({
  id: row.id,
  ownerId: row.owner_id,
  ownerEmail: normalizeEmail(row.owner_email),
  title: row.title,
  mode: row.mode,
  updatedAt: new Date(row.updated_at).getTime(),
  nodes: row.nodes || [],
  edges: row.edges || [],
  history: row.history || [],
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
  if (error) throw error;

  removeLocalMapsForOwner(owner);
  localStorage.setItem(migrationKey, "done");
};

export const loadMaps = async (owner: MapOwner): Promise<MindMap[]> => {
  if (!supabase) {
    return loadLocalMaps(owner).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  await migrateLocalMapsToSupabase(owner);

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("owner_id", owner.id)
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data || []).map(fromRow);
};

export const getMap = async (id: string, owner: MapOwner) => {
  if (!supabase) {
    return loadLocalMaps(owner).find((map) => map.id === id);
  }

  await migrateLocalMapsToSupabase(owner);

  const { data, error } = await supabase
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .eq("owner_id", owner.id)
    .maybeSingle();

  if (error) throw error;
  return data ? fromRow(data) : undefined;
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
  if (error) throw error;
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
  mode: MapMode = "brainstorm"
): MindMap => ({
  id: crypto.randomUUID(),
  ownerId: owner.id,
  ownerEmail: normalizeEmail(owner.email),
  title,
  mode,
  updatedAt: Date.now(),
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
