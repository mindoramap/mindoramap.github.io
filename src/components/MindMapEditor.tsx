import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
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
  type Viewport,
} from "reactflow";
import { CircleHelp, Map as MiniMapIcon, PanelRightOpen, SlidersHorizontal } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MindNode } from "./MindNode";
import { FloatingPanel, PanelDockItem } from "./FloatingPanel";
import { PropertiesPanel } from "./PropertiesPanel";
import { useIsMobile } from "@/hooks/use-mobile";
import { layoutTree } from "@/lib/layout";
import { createBlankMap, upsertMap, type MindMap, type MindNodeData, type ViewportState } from "@/store/maps";

const nodeTypes = { mind: MindNode };

interface Props {
  map: MindMap;
  mode: "tree" | "graph";
  orientation: "horizontal" | "vertical";
  connectMode: boolean;
  setConnectMode: (b: boolean) => void;
  organizeSignal: number;
  undoSignal: number;
}

function tokenize(value: string): string[] {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2);
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

function overlapsAnyNode(position: { x: number; y: number }, nodes: Node<MindNodeData>[], ignoreNodeIds: Set<string>) {
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

function getTreeHandleIds(spawnSide: "left" | "right" | "top" | "bottom") {
  if (spawnSide === "left") return { sourceHandle: "source-left", targetHandle: "target-right" };
  if (spawnSide === "top") return { sourceHandle: "source-top", targetHandle: "target-bottom" };
  if (spawnSide === "bottom") return { sourceHandle: "source-bottom", targetHandle: "target-top" };
  return { sourceHandle: "source-right", targetHandle: "target-left" };
}

function EditorInner({ map, mode, orientation, connectMode, setConnectMode, organizeSignal, undoSignal }: Props) {
  const isMobile = useIsMobile();
  const [nodes, setNodes, onNodesChange] = useNodesState<MindNodeData>(map.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(map.edges);
  const [selectedId, setSelectedId] = useState<string | null>("root");
  const [pendingSource, setPendingSource] = useState<string | null>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<ViewportState>(map.viewport);
  const [showInspector, setShowInspector] = useState(true);
  const [inspectorMinimized, setInspectorMinimized] = useState(false);
  const [showMiniMap, setShowMiniMap] = useState(!isMobile);
  const [miniMapMinimized, setMiniMapMinimized] = useState(isMobile);
  const [showHelp, setShowHelp] = useState(false);
  const [helpMinimized, setHelpMinimized] = useState(true);
  const [edgePendingDelete, setEdgePendingDelete] = useState<Edge | null>(null);
  const [panelPositions, setPanelPositions] = useState({
    inspector: { x: 0, y: 0 },
    minimap: { x: 0, y: 0 },
    help: { x: 0, y: 0 },
  });
  const { fitView } = useReactFlow();
  const historyRef = useRef<{ nodes: Node<MindNodeData>[]; edges: Edge[] }[]>([]);
  const skipHistory = useRef(false);
  const lastSavedViewport = useRef<ViewportState>(map.viewport);

  useEffect(() => {
    setNodes(map.nodes);
    setEdges(map.edges);
    setViewport(map.viewport);
    setSelectedId("root");
    setPendingSource(null);
    setHoverId(null);
    lastSavedViewport.current = map.viewport;
  }, [map.id, setNodes, setEdges]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const width = window.innerWidth;
    setPanelPositions({
      inspector: { x: Math.max(16, width - 380), y: 88 },
      minimap: { x: 16, y: Math.max(104, window.innerHeight - 300) },
      help: { x: 16, y: 88 },
    });
  }, [map.id]);

  useEffect(() => {
    if (isMobile) {
      setShowMiniMap(true);
      setMiniMapMinimized(true);
      setShowHelp(true);
      setHelpMinimized(true);
      setInspectorMinimized(false);
      return;
    }

    setShowMiniMap(true);
    setShowHelp(true);
  }, [isMobile]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void upsertMap({ ...map, nodes, edges, viewport, updatedAt: Date.now() }).catch((error) => {
        console.error("Falha ao salvar mapa", error);
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [nodes, edges, viewport, map]);

  useEffect(() => {
    if (skipHistory.current) {
      skipHistory.current = false;
      return;
    }
    historyRef.current.push({ nodes, edges });
    if (historyRef.current.length > 50) historyRef.current.shift();
  }, [nodes, edges]);

  useEffect(() => {
    if (undoSignal === 0) return;
    const history = historyRef.current;
    if (history.length < 2) return;

    history.pop();
    const previous = history[history.length - 1];
    skipHistory.current = true;
    setNodes(previous.nodes);
    skipHistory.current = true;
    setEdges(previous.edges);
  }, [undoSignal, setNodes, setEdges]);

  useEffect(() => {
    if (typeof document !== "undefined") {
      document.documentElement.dataset.mmOrientation = orientation;
    }
  }, [orientation]);

  useEffect(() => {
    if (organizeSignal === 0) return;
    setNodes((currentNodes) => layoutTree(currentNodes, edges, orientation));
    window.setTimeout(() => fitView({ padding: 0.2, duration: 350 }), 50);
  }, [organizeSignal, edges, orientation, setNodes, fitView]);

  useEffect(() => {
    if (mode !== "tree") return;
    setNodes((currentNodes) => layoutTree(currentNodes, edges, orientation));
  }, [mode, orientation, edges, setNodes]);

  useEffect(() => {
    const centerHandler = () => fitView({ padding: 0.2, duration: 350 });
    window.addEventListener("mm-center", centerHandler);
    return () => window.removeEventListener("mm-center", centerHandler);
  }, [fitView]);

  useEffect(() => {
    const handler = (event: Event) => {
      const { id, patch } = (event as CustomEvent).detail as { id: string; patch: Partial<MindNodeData> };
      setNodes((currentNodes) =>
        currentNodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, ...patch } } : node))
      );
    };
    window.addEventListener("mm-node-update", handler);
    return () => window.removeEventListener("mm-node-update", handler);
  }, [setNodes]);

  const connectedSet = useMemo(() => {
    if (!selectedId) return null;
    const connected = new Set<string>([selectedId]);
    edges.forEach((edge) => {
      if (edge.source === selectedId) connected.add(edge.target);
      if (edge.target === selectedId) connected.add(edge.source);
    });
    return connected;
  }, [selectedId, edges]);

  const styledNodes = useMemo(
    () =>
      nodes.map((node) => ({
        ...node,
        style: {
          ...node.style,
          opacity: connectedSet && !connectedSet.has(node.id) ? 0.35 : 1,
          transition: "opacity 200ms ease",
        },
      })),
    [nodes, connectedSet]
  );

  const styledEdges = useMemo(
    () =>
      edges.map((edge) => {
        const involved = selectedId && (edge.source === selectedId || edge.target === selectedId);
        return {
          ...edge,
          className: edge.data?.kind === "graph" ? "graph-edge" : "tree-edge",
          animated: edge.data?.kind === "graph" && Boolean(involved),
          style: {
            opacity: selectedId && !involved ? 0.25 : 1,
            transition: "opacity 200ms ease",
          },
        };
      }),
    [edges, selectedId]
  );

  const onConnect = useCallback(
    (params: Connection) => {
      if (!params.source || !params.target || params.source === params.target) return;
      const exists = edges.some(
        (edge) =>
          (edge.source === params.source && edge.target === params.target) ||
          (edge.source === params.target && edge.target === params.source)
      );
      if (exists) return;

      setEdges((currentEdges) =>
        addEdge(
          {
            ...params,
            id: `e-${params.source}-${params.target}-${Date.now()}`,
            data: { kind: "graph" },
          },
          currentEdges
        )
      );
    },
    [edges, setEdges]
  );

  const addChild = useCallback(
    (
      parentId: string,
      sibling = false,
      nodeData?: Partial<MindNodeData>,
      spawnSide?: "left" | "right" | "top" | "bottom"
    ) => {
      const parent = nodes.find((node) => node.id === parentId);
      if (!parent) return;

      const id = crypto.randomUUID();
      const targetParent = sibling
        ? edges.find((edge) => edge.target === parentId && edge.data?.kind !== "graph")?.source ?? parentId
        : parentId;
      const base = nodes.find((node) => node.id === targetParent) || parent;
      const resolvedSpawnSide = spawnSide || (orientation === "vertical" ? "bottom" : "right");
      const childCount = edges.filter((edge) => edge.source === targetParent && edge.data?.kind !== "graph").length;
      const angle = childCount * 0.6 - 0.6;
      const horizontalDirection = resolvedSpawnSide === "left" ? -1 : 1;
      const verticalDirection = resolvedSpawnSide === "top" ? -1 : 1;
      const dx = orientation === "vertical" ? Math.cos(angle) * 40 : horizontalDirection * 240;
      const dy = orientation === "vertical" ? verticalDirection * 140 : Math.sin(angle) * 40 + childCount * 30 - 30;
      const preferredPosition = {
        x: base.position.x + dx + (orientation === "vertical" ? Math.cos(angle) * 220 : 0),
        y: base.position.y + dy,
      };
      const resolvedPosition = findAvailableChildPosition(
        preferredPosition,
        nodes,
        new Set<string>([targetParent]),
        orientation,
        resolvedSpawnSide
      );
      const handleIds = getTreeHandleIds(resolvedSpawnSide);

      const newNode: Node<MindNodeData> = {
        id,
        type: "mind",
        position: resolvedPosition,
        data: {
          label: "Novo nÃ³",
          kind: map.mode === "project" ? "checklist" : "text",
          ...nodeData,
        },
      };

      setNodes((currentNodes) => [...currentNodes, newNode]);
      setEdges((currentEdges) => [
        ...currentEdges,
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
    [nodes, edges, orientation, map.mode, setNodes, setEdges]
  );

  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      if (connectMode) {
        if (!pendingSource) {
          setPendingSource(node.id);
          return;
        }

        if (pendingSource !== node.id) {
          const exists = edges.some(
            (edge) =>
              (edge.source === pendingSource && edge.target === node.id) ||
              (edge.source === node.id && edge.target === pendingSource)
          );
          if (!exists) {
            setEdges((currentEdges) => [
              ...currentEdges,
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
    const handler = (event: Event) => {
      const { id, side } = (event as CustomEvent).detail as { id: string; side?: "left" | "right" | "top" | "bottom" };
      addChild(id, false, undefined, side);
    };
    window.addEventListener("mm-node-add-child", handler);
    return () => window.removeEventListener("mm-node-add-child", handler);
  }, [addChild]);

  useEffect(() => {
    const handler = (event: Event) => {
      const { id, action } = (event as CustomEvent).detail as {
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
        setNodes((currentNodes) => currentNodes.filter((node) => !idsToRemove.has(node.id)));
        setEdges((currentEdges) =>
          currentEdges.filter((edge) => !idsToRemove.has(edge.source) && !idsToRemove.has(edge.target))
        );
        setSelectedId(null);
        return;
      }

      if (action === "create-linked-map") {
        void (async () => {
          const sourceNode = nodes.find((node) => node.id === id);
          if (!sourceNode) return;

          const linkedMap = createBlankMap(
            { id: map.ownerId, email: map.ownerEmail },
            `${sourceNode.data.label || "Mapa"} - conectado`,
            map.mode,
            { folderId: map.folderId, parentMapId: map.id }
          );

          await upsertMap(linkedMap);
          addChild(id, false, {
            label: linkedMap.title,
            kind: "link",
            url: `/editor/${linkedMap.id}`,
            linkedMapId: linkedMap.id,
          });
          toast.success("Submapa criado com sucesso.");
        })().catch((error) => {
          console.error("Falha ao criar mapa conectado", error);
          toast.error("NÃ£o foi possÃ­vel criar o submapa agora.");
        });
      }
    };

    window.addEventListener("mm-node-action", handler);
    return () => window.removeEventListener("mm-node-action", handler);
  }, [addChild, edges, map.folderId, map.id, map.mode, map.ownerEmail, map.ownerId, nodes, setConnectMode, setEdges, setNodes]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const targetTag = (event.target as HTMLElement)?.tagName;
      if (targetTag === "INPUT" || targetTag === "TEXTAREA") return;

      if (event.key === "Escape") {
        setConnectMode(false);
        setPendingSource(null);
        setSelectedId(null);
        return;
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        window.dispatchEvent(new Event("mm-undo"));
        return;
      }

      if (!selectedId) return;

      if (event.key === "Enter") {
        event.preventDefault();
        addChild(selectedId, true);
      } else if (event.key === "Tab") {
        event.preventDefault();
        addChild(selectedId, false);
      } else if (event.key === "Delete" || event.key === "Backspace") {
        if (selectedId === "root") return;
        event.preventDefault();
        const idsToRemove = getDescendantIds(selectedId, edges);
        setNodes((currentNodes) => currentNodes.filter((node) => !idsToRemove.has(node.id)));
        setEdges((currentEdges) =>
          currentEdges.filter((edge) => !idsToRemove.has(edge.source) && !idsToRemove.has(edge.target))
        );
        setSelectedId(null);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedId, addChild, edges, setNodes, setEdges, setConnectMode]);

  const patchNode = useCallback(
    (id: string, patch: Partial<MindNodeData>) => {
      setNodes((currentNodes) =>
        currentNodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, ...patch } } : node))
      );
    },
    [setNodes]
  );

  const deleteNode = useCallback(
    (id: string) => {
      if (id === "root") return;
      const idsToRemove = getDescendantIds(id, edges);
      setNodes((currentNodes) => currentNodes.filter((node) => !idsToRemove.has(node.id)));
      setEdges((currentEdges) =>
        currentEdges.filter((edge) => !idsToRemove.has(edge.source) && !idsToRemove.has(edge.target))
      );
      setSelectedId(null);
    },
    [edges, setNodes, setEdges]
  );

  const keywordConnect = useCallback(
    (id: string, scope: "one" | "all") => {
      const source = nodes.find((node) => node.id === id);
      if (!source) return;

      const tokens = new Set(tokenize(source.data.label));
      if (tokens.size === 0) {
        toast.warning("O nÃ³ precisa ter palavras significativas para sugerir conexÃµes.");
        return;
      }

      const scored = nodes
        .filter((node) => node.id !== id)
        .map((node) => {
          const words = tokenize(node.data.label);
          const matches = words.filter((word) => tokens.has(word));
          return { node, score: matches.length };
        })
        .filter((entry) => entry.score > 0)
        .sort((left, right) => right.score - left.score);

      if (scored.length === 0) {
        toast.info("Nenhum nÃ³ com palavra-chave em comum foi encontrado.");
        return;
      }

      const targets = scope === "one" ? [scored[0].node] : scored.map((entry) => entry.node);
      const newEdges: Edge[] = [];

      targets.forEach((target) => {
        const exists = edges.some(
          (edge) =>
            (edge.source === id && edge.target === target.id) ||
            (edge.source === target.id && edge.target === id)
        );
        if (!exists) {
          newEdges.push({
            id: `e-kw-${id}-${target.id}-${Date.now()}`,
            source: id,
            target: target.id,
            data: { kind: "graph" },
          });
        }
      });

      if (newEdges.length > 0) {
        setEdges((currentEdges) => [...currentEdges, ...newEdges]);
        toast.success(
          scope === "one" ? "ConexÃ£o sugerida adicionada." : `${newEdges.length} conexÃµes por palavra-chave foram criadas.`
        );
      }
    },
    [nodes, edges, setEdges]
  );

  const persistViewport = useCallback((nextViewport: Viewport | ViewportState) => {
    const normalized = {
      x: Number(nextViewport.x.toFixed(2)),
      y: Number(nextViewport.y.toFixed(2)),
      zoom: Number(nextViewport.zoom.toFixed(3)),
    };
    if (
      normalized.x === lastSavedViewport.current.x &&
      normalized.y === lastSavedViewport.current.y &&
      normalized.zoom === lastSavedViewport.current.zoom
    ) {
      return;
    }
    lastSavedViewport.current = normalized;
    setViewport(normalized);
  }, []);

  const selectedNode = selectedId ? nodes.find((node) => node.id === selectedId) : null;

  const proximityHintEdge = useMemo(() => {
    if (!hoverId || !selectedId || hoverId === selectedId) return null;
    const source = nodes.find((node) => node.id === selectedId);
    const target = nodes.find((node) => node.id === hoverId);
    if (!source || !target) return null;

    const dx = source.position.x - target.position.x;
    const dy = source.position.y - target.position.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > 220) return null;

    const exists = edges.some(
      (edge) =>
        (edge.source === selectedId && edge.target === hoverId) ||
        (edge.source === hoverId && edge.target === selectedId)
    );
    return exists ? null : { source: selectedId, target: hoverId };
  }, [hoverId, selectedId, nodes, edges]);

  const toggleInspector = useCallback(() => {
    if (!selectedNode) return;

    if (isMobile) {
      setShowInspector(true);
      setInspectorMinimized((current) => {
        const next = !current;
        if (!next) {
          setMiniMapMinimized(true);
          setHelpMinimized(true);
        }
        return next;
      });
      return;
    }

    setShowInspector(true);
    setInspectorMinimized((current) => !current);
  }, [isMobile, selectedNode]);

  const toggleMiniMap = useCallback(() => {
    if (isMobile) {
      setShowMiniMap(true);
      setMiniMapMinimized((current) => {
        const next = !current;
        if (!next) {
          setInspectorMinimized(true);
          setHelpMinimized(true);
        }
        return next;
      });
      return;
    }

    setShowMiniMap(true);
    setMiniMapMinimized((current) => !current);
  }, [isMobile]);

  const toggleHelp = useCallback(() => {
    if (isMobile) {
      setShowHelp(true);
      setHelpMinimized((current) => {
        const next = !current;
        if (!next) {
          setInspectorMinimized(true);
          setMiniMapMinimized(true);
        }
        return next;
      });
      return;
    }

    setShowHelp(true);
    setHelpMinimized((current) => !current);
  }, [isMobile]);

  const mobilePanelExpanded =
    isMobile &&
    ((selectedNode && !connectMode && showInspector && !inspectorMinimized) ||
      (showMiniMap && !miniMapMinimized) ||
      (showHelp && !helpMinimized));

  return (
    <div className={`relative h-full w-full ${connectMode ? "cursor-crosshair" : ""}`}>
      <ReactFlow
        nodes={styledNodes}
        edges={styledEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onNodeMouseEnter={(_, node) => setHoverId(node.id)}
        onNodeMouseLeave={() => setHoverId(null)}
        onPaneClick={() => {
          setSelectedId(null);
          setPendingSource(null);
        }}
        onMoveEnd={(_, nextViewport) => persistViewport(nextViewport)}
        onEdgeClick={(_, edge) => setEdgePendingDelete(edge)}
        nodeTypes={nodeTypes}
        defaultViewport={map.viewport}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={null}
        nodesConnectable
        connectOnClick={false}
      >
        <Background gap={24} size={1} color="oklch(0.7 0.02 270 / 0.25)" />
        <Controls
          position="bottom-left"
          className={isMobile ? "!hidden" : "!shadow-none !mb-20 !ml-3"}
          showInteractive={false}
        />
      </ReactFlow>

      {connectMode && (
        <div className="pointer-events-none absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-[var(--shadow-soft)]">
          {pendingSource ? "Clique no nÃ³ de destino..." : "Modo conexÃ£o: selecione o nÃ³ de origem"}
        </div>
      )}

      {proximityHintEdge && (
        <div className="pointer-events-none absolute bottom-20 left-1/2 z-10 -translate-x-1/2 rounded-full border border-primary/50 bg-card px-3 py-1 text-xs text-primary animate-pulse">
          SugestÃ£o: conectar nÃ³s prÃ³ximos
        </div>
      )}

      {selectedNode && !connectMode && showInspector && (
        <FloatingPanel
          id="inspector"
          title="Propriedades"
          icon={<SlidersHorizontal size={16} />}
          open={showInspector}
          minimized={inspectorMinimized}
          mobile={isMobile}
          position={panelPositions.inspector}
          widthClassName="w-[340px]"
          onToggle={toggleInspector}
          onMinimize={() => setInspectorMinimized(true)}
          onPositionChange={(position) => setPanelPositions((current) => ({ ...current, inspector: position }))}
        >
          <PropertiesPanel node={selectedNode} onPatch={patchNode} onDelete={deleteNode} onKeywordConnect={keywordConnect} />
        </FloatingPanel>
      )}

      {showMiniMap && (
        <FloatingPanel
          id="minimap"
          title="Minimapa"
          icon={<MiniMapIcon size={16} />}
          open={showMiniMap}
          minimized={miniMapMinimized}
          mobile={isMobile}
          position={panelPositions.minimap}
          widthClassName="w-[280px]"
          onToggle={toggleMiniMap}
          onMinimize={() => setMiniMapMinimized(true)}
          onPositionChange={(position) => setPanelPositions((current) => ({ ...current, minimap: position }))}
        >
          <MiniMap
            className="!h-[220px] !w-full !overflow-hidden rounded-2xl !border !border-border !bg-card"
            maskColor="oklch(0 0 0 / 0.08)"
            nodeColor={() => "oklch(0.55 0.22 280)"}
            pannable
            zoomable
          />
        </FloatingPanel>
      )}

      {showHelp && (
        <FloatingPanel
          id="help"
          title="Ajuda rÃ¡pida"
          icon={<CircleHelp size={16} />}
          open={showHelp}
          minimized={helpMinimized}
          mobile={isMobile}
          position={panelPositions.help}
          widthClassName="w-[290px]"
          onToggle={toggleHelp}
          onMinimize={() => setHelpMinimized(true)}
          onPositionChange={(position) => setPanelPositions((current) => ({ ...current, help: position }))}
        >
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              <kbd className="rounded bg-muted px-1.5 py-0.5 font-semibold text-foreground">Duplo-clique</kbd> no nÃ³ cria filho
            </p>
            <p>
              <kbd className="rounded bg-muted px-1.5 py-0.5 font-semibold text-foreground">Tab</kbd> cria filho Â· <kbd className="rounded bg-muted px-1.5 py-0.5 font-semibold text-foreground">Enter</kbd> cria irmÃ£o
            </p>
            <p>
              <kbd className="rounded bg-muted px-1.5 py-0.5 font-semibold text-foreground">Ctrl+Z</kbd> desfaz Â· <kbd className="rounded bg-muted px-1.5 py-0.5 font-semibold text-foreground">Del</kbd> remove
            </p>
            {isMobile && <p>Toque no nÃ³ para selecionar e use as abas inferiores para expandir os painÃ©is.</p>}
          </div>
        </FloatingPanel>
      )}

      {isMobile && !mobilePanelExpanded && (
        <div className="absolute bottom-3 left-1/2 z-20 flex max-w-[calc(100%-24px)] -translate-x-1/2 gap-2 overflow-x-auto rounded-full border border-border/80 bg-card/92 p-2 shadow-[var(--shadow-soft)] backdrop-blur-xl">
          {selectedNode && (
            <PanelDockItem
              label="Propriedades"
              icon={<PanelRightOpen size={14} />}
              active={!inspectorMinimized}
              minimized={inspectorMinimized}
              onClick={toggleInspector}
            />
          )}
          <PanelDockItem
            label="Minimapa"
            icon={<MiniMapIcon size={14} />}
            active={!miniMapMinimized}
            minimized={miniMapMinimized}
            onClick={toggleMiniMap}
          />
          <PanelDockItem
            label="Ajuda"
            icon={<CircleHelp size={14} />}
            active={!helpMinimized}
            minimized={helpMinimized}
            onClick={toggleHelp}
          />
        </div>
      )}

      <Dialog open={Boolean(edgePendingDelete)} onOpenChange={(open) => !open && setEdgePendingDelete(null)}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Remover conexÃ£o</DialogTitle>
            <DialogDescription>Esta conexÃ£o serÃ¡ removida do mapa atual.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <button type="button" onClick={() => setEdgePendingDelete(null)} className="rounded-xl px-4 py-2 hover:bg-muted">
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => {
                if (!edgePendingDelete) return;
                setEdges((currentEdges) => currentEdges.filter((currentEdge) => currentEdge.id !== edgePendingDelete.id));
                setEdgePendingDelete(null);
                toast.success("ConexÃ£o removida.");
              }}
              className="rounded-xl bg-destructive px-4 py-2 font-medium text-destructive-foreground"
            >
              Remover
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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

