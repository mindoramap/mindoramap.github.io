// Hybrid mind map editor canvas with controlled connection mode, history, focus dimming
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  ReactFlowProvider,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from "reactflow";
import { MindNode } from "./MindNode";
import { PropertiesPanel } from "./PropertiesPanel";
import { layoutTree } from "@/lib/layout";
import { createBlankMap, upsertMap, type MindMap, type MindNodeData } from "@/store/maps";

const nodeTypes = { mind: MindNode };

interface Props {
  map: MindMap;
  mode: "tree" | "graph";
  orientation: "horizontal" | "vertical";
  connectMode: boolean;
  setConnectMode: (b: boolean) => void;
  organizeSignal: number;
  undoSignal: number;
  exposeNodes?: (n: Node<MindNodeData>[]) => void;
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3);
}

function getDescendantIds(nodeId: string, edges: Edge[]): Set<string> {
  const descendants = new Set<string>([nodeId]);
  const queue = [nodeId];

  while (queue.length > 0) {
    const currentId = queue.shift();
    if (!currentId) continue;

    edges.forEach((edge) => {
      if (edge.data?.kind === "graph" || edge.source !== currentId || descendants.has(edge.target)) return;
      descendants.add(edge.target);
      queue.push(edge.target);
    });
  }

  return descendants;
}

function overlapsAnyNode(
  position: { x: number; y: number },
  nodes: Node<MindNodeData>[],
  ignoreNodeIds: Set<string>
) {
  const minHorizontalGap = 210;
  const minVerticalGap = 110;

  return nodes.some((node) => {
    if (ignoreNodeIds.has(node.id)) return false;
    return (
      Math.abs(node.position.x - position.x) < minHorizontalGap &&
      Math.abs(node.position.y - position.y) < minVerticalGap
    );
  });
}

function findAvailableChildPosition(
  preferred: { x: number; y: number },
  nodes: Node<MindNodeData>[],
  ignoreNodeIds: Set<string>,
  orientation: "horizontal" | "vertical",
  spawnSide: "left" | "right" | "top" | "bottom"
) {
  if (!overlapsAnyNode(preferred, nodes, ignoreNodeIds)) return preferred;

  const perpendicularStep = orientation === "horizontal" ? 90 : 180;
  const forwardStep = orientation === "horizontal" ? 70 : 90;
  const horizontalDirection = spawnSide === "left" ? -1 : 1;
  const verticalDirection = spawnSide === "top" ? -1 : 1;

  for (let ring = 1; ring <= 10; ring += 1) {
    const offsets =
      orientation === "horizontal"
        ? [
            { x: 0, y: ring * perpendicularStep },
            { x: 0, y: -ring * perpendicularStep },
            { x: horizontalDirection * ring * forwardStep, y: ring * perpendicularStep },
            { x: horizontalDirection * ring * forwardStep, y: -ring * perpendicularStep },
            { x: horizontalDirection * ring * forwardStep * 2, y: 0 },
          ]
        : [
            { x: ring * perpendicularStep, y: 0 },
            { x: -ring * perpendicularStep, y: 0 },
            { x: ring * perpendicularStep, y: verticalDirection * ring * forwardStep },
            { x: -ring * perpendicularStep, y: verticalDirection * ring * forwardStep },
            { x: 0, y: verticalDirection * ring * forwardStep * 2 },
          ];

    for (const offset of offsets) {
      const candidate = {
        x: preferred.x + offset.x,
        y: preferred.y + offset.y,
      };
      if (!overlapsAnyNode(candidate, nodes, ignoreNodeIds)) return candidate;
    }
  }

  return preferred;
}

function getTreeHandleIds(
  spawnSide: "left" | "right" | "top" | "bottom"
) {
  if (spawnSide === "left") {
    return { sourceHandle: "source-left", targetHandle: "target-right" };
  }
  if (spawnSide === "top") {
    return { sourceHandle: "source-top", targetHandle: "target-bottom" };
  }
  if (spawnSide === "bottom") {
    return { sourceHandle: "source-bottom", targetHandle: "target-top" };
  }
  return { sourceHandle: "source-right", targetHandle: "target-left" };
}

function EditorInner({ map, mode, orientation, connectMode, setConnectMode, organizeSignal, undoSignal }: Props) {
  const [nodes, setNodes, onNodesChange] = useNodesState<MindNodeData>(map.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(map.edges);
  const [selectedId, setSelectedId] = useState<string | null>("root");
  const [pendingSource, setPendingSource] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const { fitView, screenToFlowPosition } = useReactFlow();
  const historyRef = useRef<{ nodes: Node<MindNodeData>[]; edges: Edge[] }[]>([]);
  const skipHistory = useRef(false);

  // ---------- Persistence ----------
  useEffect(() => {
    const t = setTimeout(() => {
      void upsertMap({ ...map, nodes, edges, updatedAt: Date.now() }).catch((error) => {
        console.error("Falha ao salvar mapa", error);
      });
    }, 400);
    return () => clearTimeout(t);
  }, [nodes, edges, map]);

  // ---------- History (undo) ----------
  useEffect(() => {
    if (skipHistory.current) { skipHistory.current = false; return; }
    historyRef.current.push({ nodes, edges });
    if (historyRef.current.length > 50) historyRef.current.shift();
  }, [nodes, edges]);

  useEffect(() => {
    if (undoSignal === 0) return;
    const h = historyRef.current;
    if (h.length < 2) return;
    h.pop(); // current
    const prev = h[h.length - 1];
    skipHistory.current = true;
    setNodes(prev.nodes);
    skipHistory.current = true;
    setEdges(prev.edges);
  }, [undoSignal, setNodes, setEdges]);

  // expose orientation to nodes (for handle positions)
  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.mmOrientation = orientation;
    }
  }, [orientation]);

  // ---------- Auto-organize ----------
  useEffect(() => {
    if (organizeSignal === 0) return;
    setNodes((ns) => layoutTree(ns, edges, orientation));
    setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 50);
  }, [organizeSignal, edges, setNodes, fitView, orientation]);

  useEffect(() => {
    if (mode === "tree") {
      setNodes((ns) => layoutTree(ns, edges, orientation));
      setTimeout(() => fitView({ padding: 0.2, duration: 400 }), 50);
    }
  }, [mode, orientation]); // eslint-disable-line

  useEffect(() => {
    const handler = () => fitView({ padding: 0.2, duration: 400 });
    window.addEventListener("mm-center", handler);
    return () => window.removeEventListener("mm-center", handler);
  }, [fitView]);

  // ---------- Node updates from custom inline editor ----------
  useEffect(() => {
    const handler = (e: Event) => {
      const { id, patch } = (e as CustomEvent).detail as { id: string; patch: Partial<MindNodeData> };
      setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
    };
    window.addEventListener("mm-node-update", handler);
    return () => window.removeEventListener("mm-node-update", handler);
  }, [setNodes]);

  // ---------- Focus highlighting ----------
  const connectedSet = useMemo(() => {
    if (!selectedId) return null;
    const set = new Set<string>([selectedId]);
    edges.forEach((e) => {
      if (e.source === selectedId) set.add(e.target);
      if (e.target === selectedId) set.add(e.source);
    });
    return set;
  }, [selectedId, edges]);

  const styledNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        style: {
          ...n.style,
          opacity: connectedSet && !connectedSet.has(n.id) ? 0.35 : 1,
          transition: "opacity 200ms",
        },
      })),
    [nodes, connectedSet]
  );

  const styledEdges = useMemo(
    () =>
      edges.map((e) => {
        const involved = selectedId && (e.source === selectedId || e.target === selectedId);
        return {
          ...e,
          className: e.data?.kind === "graph" ? "graph-edge" : "tree-edge",
          animated: e.data?.kind === "graph" && !!involved,
          style: {
            opacity: selectedId && !involved ? 0.25 : 1,
            transition: "opacity 200ms",
          },
        };
      }),
    [edges, selectedId]
  );

  // ---------- Connections ----------
  const onConnect = useCallback(
    (params: Connection) => {
      const hasSourceOrTarget = !params.source || !params.target;
      if (hasSourceOrTarget || params.source === params.target) return;
      const exists = edges.some(
        (edge) =>
          (edge.source === params.source && edge.target === params.target) ||
          (edge.source === params.target && edge.target === params.source)
      );
      if (exists) return;
      setEdges((es) =>
        addEdge(
          {
            ...params,
            id: `e-${params.source}-${params.target}-${Date.now()}`,
            data: { kind: "graph" },
          },
          es
        )
      );
    },
    [edges, setEdges]
  );

  // ---------- Node creation ----------
  const addChild = useCallback(
    (
      parentId: string,
      sibling = false,
      nodeData?: Partial<MindNodeData>,
      spawnSide?: "left" | "right" | "top" | "bottom"
    ) => {
      const parent = nodes.find((n) => n.id === parentId);
      if (!parent) return;
      const id = crypto.randomUUID();
      const targetParent = sibling
        ? edges.find((e) => e.target === parentId && e.data?.kind !== "graph")?.source ?? parentId
        : parentId;
      const base = nodes.find((n) => n.id === targetParent) || parent;
      const resolvedSpawnSide =
        spawnSide || (orientation === "vertical" ? "bottom" : "right");
      // Spread children radially
      const childCount = edges.filter((e) => e.source === targetParent && e.data?.kind !== "graph").length;
      const angle = (childCount * 0.6) - 0.6;
      const horizontalDirection = resolvedSpawnSide === "left" ? -1 : 1;
      const verticalDirection = resolvedSpawnSide === "top" ? -1 : 1;
      const dx =
        orientation === "vertical"
          ? Math.cos(angle) * 40
          : horizontalDirection * 240;
      const dy =
        orientation === "vertical"
          ? verticalDirection * 140
          : Math.sin(angle) * 40 + childCount * 30 - 30;
      const preferredPosition = {
        x:
          base.position.x +
          dx +
          (orientation === "vertical" ? Math.cos(angle) * 220 : 0),
        y: base.position.y + dy,
      };
      const occupiedBranchIds = new Set<string>([targetParent]);
      const resolvedPosition = findAvailableChildPosition(
        preferredPosition,
        nodes,
        occupiedBranchIds,
        orientation,
        resolvedSpawnSide
      );
      const handleIds = getTreeHandleIds(resolvedSpawnSide);
      const newNode: Node<MindNodeData> = {
        id,
        type: "mind",
        position: resolvedPosition,
        data: {
          label: "Novo nó",
          kind: map.mode === "project" ? "checklist" : "text",
          ...nodeData,
        },
      };
      setNodes((ns) => [...ns, newNode]);
      setEdges((es) => [
        ...es,
        {
          id: `e-${targetParent}-${id}`,
          source: targetParent,
          target: id,
          sourceHandle: handleIds.sourceHandle,
          targetHandle: handleIds.targetHandle,
          data: { kind: "tree", treeSide: resolvedSpawnSide },
        },
      ]);
      setSelectedId(id);
    },
    [nodes, edges, setNodes, setEdges, orientation, map.mode]
  );

  // ---------- Click handlers ----------
  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      if (connectMode) {
        if (!pendingSource) {
          setPendingSource(node.id);
        } else if (pendingSource !== node.id) {
          const exists = edges.some(
            (e) =>
              (e.source === pendingSource && e.target === node.id) ||
              (e.source === node.id && e.target === pendingSource)
          );
          if (!exists) {
            setEdges((es) => [
              ...es,
              {
                id: `e-${pendingSource}-${node.id}-${Date.now()}`,
                source: pendingSource,
                target: node.id,
                data: { kind: "graph" },
              },
            ]);
          }
          setPendingSource(null);
        }
        return;
      }
      setSelectedId(node.id);
    },
    [connectMode, pendingSource, edges, setEdges]
  );

  useEffect(() => {
    const handler = (e: Event) => {
      const { id, side } = (e as CustomEvent).detail as {
        id: string;
        side?: "left" | "right" | "top" | "bottom";
      };
      addChild(id, false, undefined, side);
    };
    window.addEventListener("mm-node-add-child", handler);
    return () => window.removeEventListener("mm-node-add-child", handler);
  }, [addChild]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { id, action } = (e as CustomEvent).detail as {
        id: string;
        action: "add-child" | "add-sibling" | "edit" | "connect" | "create-linked-map" | "delete";
      };

      if (action === "edit") {
        setSelectedId(id);
        window.dispatchEvent(new CustomEvent("mm-node-start-edit", { detail: { id } }));
        return;
      }

      if (action === "add-child") {
        setSelectedId(id);
        addChild(id, false);
        return;
      }

      if (action === "add-sibling") {
        setSelectedId(id);
        addChild(id, true);
        return;
      }

      if (action === "connect") {
        setSelectedId(id);
        setConnectMode(true);
        setPendingSource(id);
        return;
      }

      if (action === "delete") {
        if (id === "root") return;
        const idsToRemove = getDescendantIds(id, edges);
        setNodes((ns) => ns.filter((n) => !idsToRemove.has(n.id)));
        setEdges((es) => es.filter((edge) => !idsToRemove.has(edge.source) && !idsToRemove.has(edge.target)));
        setSelectedId(null);
        return;
      }

      if (action === "create-linked-map") {
        const sourceNode = nodes.find((node) => node.id === id);
        if (!sourceNode) return;

        const linkedMap = createBlankMap(
          { id: map.ownerId, email: map.ownerEmail },
          `${sourceNode.data.label || "Mapa"} - conectado`,
          map.mode
        );
        void upsertMap(linkedMap).catch((error) => {
          console.error("Falha ao criar mapa conectado", error);
        });

        addChild(id, false, {
          label: linkedMap.title,
          kind: "link",
          url: `/editor/${linkedMap.id}`,
          linkedMapId: linkedMap.id,
        });
      }
    };

    window.addEventListener("mm-node-action", handler);
    return () => window.removeEventListener("mm-node-action", handler);
  }, [addChild, edges, map.mode, map.ownerEmail, nodes, setConnectMode, setEdges, setNodes]);

  // ---------- Keyboard ----------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "Escape") {
        setConnectMode(false);
        setPendingSource(null);
        setSelectedId(null);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        window.dispatchEvent(new Event("mm-undo"));
        return;
      }
      if (!selectedId) return;
      if (e.key === "Enter") { e.preventDefault(); addChild(selectedId, true); }
      else if (e.key === "Tab") { e.preventDefault(); addChild(selectedId, false); }
      else if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedId === "root") return;
        e.preventDefault();
        const idsToRemove = getDescendantIds(selectedId, edges);
        setNodes((ns) => ns.filter((n) => !idsToRemove.has(n.id)));
        setEdges((es) => es.filter((ed) => !idsToRemove.has(ed.source) && !idsToRemove.has(ed.target)));
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedId, addChild, edges, setNodes, setEdges, setConnectMode]);

  // ---------- Properties panel handlers ----------
  const patchNode = useCallback(
    (id: string, patch: Partial<MindNodeData>) => {
      setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)));
    },
    [setNodes]
  );
  const deleteNode = useCallback(
    (id: string) => {
      if (id === "root") return;
      const idsToRemove = getDescendantIds(id, edges);
      setNodes((ns) => ns.filter((n) => !idsToRemove.has(n.id)));
      setEdges((es) => es.filter((e) => !idsToRemove.has(e.source) && !idsToRemove.has(e.target)));
      setSelectedId(null);
    },
    [edges, setNodes, setEdges]
  );

  const keywordConnect = useCallback(
    (id: string, scope: "one" | "all") => {
      const src = nodes.find((n) => n.id === id);
      if (!src) return;
      const tokens = new Set(tokenize(src.data.label));
      if (tokens.size === 0) {
        alert("O nó precisa ter palavras significativas.");
        return;
      }
      const scored = nodes
        .filter((n) => n.id !== id)
        .map((n) => {
          const t = tokenize(n.data.label);
          const matches = t.filter((w) => tokens.has(w));
          return { node: n, score: matches.length };
        })
        .filter((x) => x.score > 0)
        .sort((a, b) => b.score - a.score);

      if (scored.length === 0) {
        alert("Nenhum nó com palavra-chave em comum.");
        return;
      }
      const targets = scope === "one" ? [scored[0].node] : scored.map((s) => s.node);
      const newEdges: Edge[] = [];
      targets.forEach((t) => {
        const exists = edges.some(
          (e) =>
            (e.source === id && e.target === t.id) ||
            (e.source === t.id && e.target === id)
        );
        if (!exists) {
          newEdges.push({
            id: `e-kw-${id}-${t.id}-${Date.now()}`,
            source: id,
            target: t.id,
            data: { kind: "graph" },
          });
        }
      });
      if (newEdges.length) setEdges((es) => [...es, ...newEdges]);
    },
    [nodes, edges, setEdges]
  );

  // listen to "mm-undo"
  useEffect(() => {
    const h = () => window.dispatchEvent(new CustomEvent("mm-undo-internal"));
    window.addEventListener("mm-undo", h);
    return () => window.removeEventListener("mm-undo", h);
  }, []);

  const selectedNode = selectedId ? nodes.find((n) => n.id === selectedId) : null;

  // proximity hint
  const proximityHintEdge = useMemo(() => {
    if (!hoverId || !selectedId || hoverId === selectedId) return null;
    const a = nodes.find((n) => n.id === selectedId);
    const b = nodes.find((n) => n.id === hoverId);
    if (!a || !b) return null;
    const dx = a.position.x - b.position.x;
    const dy = a.position.y - b.position.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 220) return null;
    const exists = edges.some(
      (e) =>
        (e.source === selectedId && e.target === hoverId) ||
        (e.source === hoverId && e.target === selectedId)
    );
    if (exists) return null;
    return { source: selectedId, target: hoverId };
  }, [hoverId, selectedId, nodes, edges]);

  return (
    <div className={`w-full h-full relative ${connectMode ? "cursor-crosshair" : ""}`}>
      <ReactFlow
        nodes={styledNodes}
        edges={styledEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeMouseEnter={(_, n) => setHoverId(n.id)}
        onNodeMouseLeave={() => setHoverId(null)}
        onPaneClick={() => { setSelectedId(null); setPendingSource(null); }}
        onEdgeClick={(_, edge) => {
          if (confirm("Remover esta conexão?")) {
            setEdges((es) => es.filter((e) => e.id !== edge.id));
          }
        }}
        nodeTypes={nodeTypes}
        fitView
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={null}
        nodesConnectable
        connectOnClick={false}
      >
        <Background gap={24} size={1} color="oklch(0.7 0.02 270 / 0.25)" />
        <Controls className="!shadow-none" showInteractive={false} />
        <MiniMap
          className="!bg-card !border !border-border rounded-lg overflow-hidden"
          maskColor="oklch(0 0 0 / 0.1)"
          nodeColor={() => "oklch(0.55 0.22 280)"}
          pannable
          zoomable
        />
      </ReactFlow>

      {/* connect mode overlay banner */}
      {connectMode && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground px-4 py-2 rounded-full shadow-[var(--shadow-soft)] text-sm font-medium z-10 pointer-events-none">
          {pendingSource ? "Clique no nó destino…" : "Modo conexão: selecione o nó de origem"}
        </div>
      )}

      {/* proximity suggestion */}
      {proximityHintEdge && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-card border border-primary/50 rounded-full px-3 py-1 text-xs text-primary z-10 pointer-events-none animate-pulse">
          ✦ Sugestão: conectar nós próximos
        </div>
      )}

      {selectedNode && !connectMode && (
        <PropertiesPanel
          node={selectedNode}
          onPatch={patchNode}
          onDelete={deleteNode}
          onKeywordConnect={keywordConnect}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

export function MindMapEditor(props: Props) {
  return (
    <ReactFlowProvider>
      <EditorInner {...props} />
    </ReactFlowProvider>
  );
}
