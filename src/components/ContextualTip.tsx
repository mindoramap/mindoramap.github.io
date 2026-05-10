// Smart contextual hints that appear based on what the user is doing
import { useEffect, useRef, useState } from "react";
import { Lightbulb, X } from "lucide-react";
// window.setTimeout returns number in browsers, not NodeJS Timeout
type TimerId = ReturnType<typeof window.setTimeout>;
import { cn } from "@/lib/utils";

const TIPS_KEY = "mm_tips_v2_";

function getShownTips(userId: string): Set<string> {
  try {
    return new Set<string>(JSON.parse(localStorage.getItem(TIPS_KEY + userId) || "[]"));
  } catch {
    return new Set();
  }
}

function markTipShown(userId: string, tipId: string) {
  const shown = getShownTips(userId);
  shown.add(tipId);
  localStorage.setItem(TIPS_KEY + userId, JSON.stringify([...shown]));
}

interface TipDef {
  id: string;
  message: string;
  condition: (s: { nodeCount: number; graphEdgeCount: number }) => boolean;
  delayMs?: number;
}

const TIP_DEFS: TipDef[] = [
  {
    id: "first-child",
    message: "Pressione Tab para criar seu primeiro nó filho — sem precisar do mouse!",
    condition: ({ nodeCount }) => nodeCount <= 1,
    delayMs: 4000,
  },
  {
    id: "connect-ideas",
    message: "Experimente conectar ideias relacionadas usando o botão Conectar na barra.",
    condition: ({ nodeCount, graphEdgeCount }) => nodeCount >= 4 && graphEdgeCount === 0,
    delayMs: 3000,
  },
  {
    id: "organize",
    message: "Use o botão Organizar para reorganizar todos os nós automaticamente!",
    condition: ({ nodeCount }) => nodeCount >= 7,
    delayMs: 2000,
  },
  {
    id: "context-menu",
    message: "Clique com o botão direito em qualquer nó para ver mais ações rápidas.",
    condition: ({ nodeCount }) => nodeCount >= 3,
    delayMs: 5000,
  },
];

interface Props {
  userId: string;
  nodeCount: number;
  graphEdgeCount: number;
}

export function ContextualTip({ userId, nodeCount, graphEdgeCount }: Props) {
  const [activeTip, setActiveTip] = useState<TipDef | null>(null);
  const [visible, setVisible] = useState(false);
  const dismissTimerRef = useRef<number | null>(null);

  const dismiss = (tipId: string) => {
    markTipShown(userId, tipId);
    setVisible(false);
    window.setTimeout(() => setActiveTip(null), 350);
  };

  // Find the next applicable tip whenever state changes
  useEffect(() => {
    if (activeTip) return; // Don't change tip while one is showing

    const shown = getShownTips(userId);
    const tip = TIP_DEFS.find(
      (t) => !shown.has(t.id) && t.condition({ nodeCount, graphEdgeCount })
    );
    if (!tip) return;

    const delay = tip.delayMs ?? 3000;
    const appearTimer = window.setTimeout(() => {
      setActiveTip(tip);
      setVisible(true);
    }, delay);

    return () => window.clearTimeout(appearTimer);
  }, [userId, nodeCount, graphEdgeCount, activeTip]);

  // Auto-dismiss after 12 seconds
  useEffect(() => {
    if (!activeTip || !visible) return;

    if (dismissTimerRef.current !== null) window.clearTimeout(dismissTimerRef.current);
    dismissTimerRef.current = window.setTimeout(() => {
      dismiss(activeTip.id);
    }, 12000);

    return () => {
      if (dismissTimerRef.current) window.clearTimeout(dismissTimerRef.current);
    };
  }, [activeTip, visible]);

  if (!activeTip) return null;

  return (
    <div
      className={cn(
        "absolute bottom-24 left-1/2 z-10 -translate-x-1/2",
        "flex items-center gap-3 rounded-2xl border border-border/80 bg-card/96 px-4 py-3",
        "shadow-[var(--shadow-soft)] backdrop-blur-xl",
        "transition-all duration-350",
        visible ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0"
      )}
      role="status"
      aria-live="polite"
    >
      <Lightbulb size={15} className="shrink-0 text-amber-500" />
      <p className="max-w-[300px] text-xs leading-relaxed text-muted-foreground">
        {activeTip.message}
      </p>
      <button
        type="button"
        onClick={() => dismiss(activeTip.id)}
        className="shrink-0 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        aria-label="Fechar dica"
      >
        <X size={12} />
      </button>
    </div>
  );
}
