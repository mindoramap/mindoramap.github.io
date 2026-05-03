// Tree layout - supports horizontal and vertical orientations with side-aware branches
import type { Edge, Node } from "reactflow";

const GAP_MAIN = 80;
const GAP_CROSS = 28;
const NODE_W = 180;
const NODE_H = 64;

export type LayoutOrientation = "horizontal" | "vertical";
type LayoutSide = "left" | "right" | "top" | "bottom";

function inferTreeSide(edge: Edge, orientation: LayoutOrientation): LayoutSide {
  const treeSide = edge.data?.treeSide;
  if (treeSide === "left" || treeSide === "right" || treeSide === "top" || treeSide === "bottom") {
    return treeSide;
  }

  if (edge.sourceHandle === "source-left") return "left";
  if (edge.sourceHandle === "source-right") return "right";
  if (edge.sourceHandle === "source-top") return "top";
  if (edge.sourceHandle === "source-bottom") return "bottom";
  return orientation === "vertical" ? "bottom" : "right";
}

function getPrimarySides(orientation: LayoutOrientation) {
  return orientation === "vertical"
    ? { negative: "top" as const, positive: "bottom" as const }
    : { negative: "left" as const, positive: "right" as const };
}

export function layoutTree(
  nodes: Node[],
  edges: Edge[],
  orientation: LayoutOrientation = "horizontal"
): Node[] {
  const treeEdges = edges.filter((edge) => edge.data?.kind !== "graph");
  const childrenBySide = new Map<string, Record<LayoutSide, string[]>>();
  const parentOf = new Map<string, string>();
  const primarySides = getPrimarySides(orientation);
  const crossSize = orientation === "vertical" ? NODE_W + GAP_CROSS : NODE_H + GAP_CROSS;
  const mainStep = orientation === "vertical" ? NODE_H + GAP_MAIN + 40 : NODE_W + GAP_MAIN + 40;

  const ensureBuckets = (nodeId: string) => {
    if (!childrenBySide.has(nodeId)) {
      childrenBySide.set(nodeId, {
        left: [],
        right: [],
        top: [],
        bottom: [],
      });
    }
    return childrenBySide.get(nodeId)!;
  };

  treeEdges.forEach((edge) => {
    parentOf.set(edge.target, edge.source);
    const side = inferTreeSide(edge, orientation);
    ensureBuckets(edge.source)[side].push(edge.target);
  });

  const roots = nodes.filter((node) => !parentOf.has(node.id));
  const subtreeSize = new Map<string, number>();

  const getChildren = (nodeId: string, side: LayoutSide) => ensureBuckets(nodeId)[side];

  const computeSpan = (nodeId: string, side: LayoutSide): number => {
    const children = getChildren(nodeId, side);
    if (children.length === 0) return crossSize;
    const total = children.reduce((sum, childId) => sum + computeNodeSize(childId), 0);
    return Math.max(total, crossSize);
  };

  const computeNodeSize = (nodeId: string): number => {
    const negativeSpan = computeSpan(nodeId, primarySides.negative);
    const positiveSpan = computeSpan(nodeId, primarySides.positive);
    const size = Math.max(crossSize, negativeSpan, positiveSpan);
    subtreeSize.set(nodeId, size);
    return size;
  };

  roots.forEach((root) => computeNodeSize(root.id));

  const positions = new Map<string, { x: number; y: number }>();

  const placeBranch = (
    childIds: string[],
    branchCenter: number,
    depth: number,
    side: LayoutSide
  ) => {
    const totalSpan = childIds.reduce((sum, childId) => sum + (subtreeSize.get(childId) || crossSize), 0);
    let cursor = branchCenter - totalSpan / 2;
    childIds.forEach((childId) => {
      const childSize = subtreeSize.get(childId) || crossSize;
      placeNode(childId, cursor, depth, side);
      cursor += childSize;
    });
  };

  const placeNode = (nodeId: string, crossStart: number, depth: number, side?: LayoutSide) => {
    const size = subtreeSize.get(nodeId) || crossSize;
    const crossCenter = crossStart + size / 2;

    if (orientation === "vertical") {
      positions.set(nodeId, { x: crossCenter - NODE_W / 2, y: depth * mainStep });
    } else {
      positions.set(nodeId, { x: depth * mainStep, y: crossCenter - NODE_H / 2 });
    }

    const negativeChildren = getChildren(nodeId, primarySides.negative);
    const positiveChildren = getChildren(nodeId, primarySides.positive);

    if (negativeChildren.length > 0) {
      placeBranch(negativeChildren, crossCenter, depth - 1, primarySides.negative);
    }
    if (positiveChildren.length > 0) {
      placeBranch(positiveChildren, crossCenter, depth + 1, primarySides.positive);
    }
  };

  let cursor = 0;
  roots.forEach((root) => {
    const rootSize = subtreeSize.get(root.id) || crossSize;
    placeNode(root.id, cursor, 0);
    cursor += rootSize;
  });

  return nodes.map((node) => ({ ...node, position: positions.get(node.id) || node.position }));
}
