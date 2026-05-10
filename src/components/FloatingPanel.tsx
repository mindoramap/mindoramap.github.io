import { useEffect, useRef, useState } from "react";
import { Minus, Move, PanelBottomOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface FloatingPanelProps {
  id: string;
  title: string;
  icon: React.ReactNode;
  open: boolean;
  minimized: boolean;
  mobile: boolean;
  position: { x: number; y: number };
  widthClassName?: string;
  onToggle: () => void;
  onMinimize: () => void;
  onPositionChange: (position: { x: number; y: number }) => void;
  children: React.ReactNode;
}

function useFloatingDrag(
  mobile: boolean,
  panelRef: React.RefObject<HTMLDivElement | null>,
  onPositionChange: (position: { x: number; y: number }) => void
) {
  const dragOffset = useRef({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!dragging || mobile) return;

    const handlePointerMove = (event: PointerEvent) => {
      const panel = panelRef.current;
      if (!panel) return;

      const maxX = Math.max(16, window.innerWidth - panel.offsetWidth - 16);
      const maxY = Math.max(16, window.innerHeight - panel.offsetHeight - 16);

      onPositionChange({
        x: Math.min(maxX, Math.max(16, event.clientX - dragOffset.current.x)),
        y: Math.min(maxY, Math.max(16, event.clientY - dragOffset.current.y)),
      });
    };

    const handlePointerUp = () => setDragging(false);

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };
  }, [dragging, mobile, onPositionChange, panelRef]);

  const startDrag = (event: React.PointerEvent) => {
    if (mobile) return;
    const panel = panelRef.current;
    if (!panel) return;

    dragOffset.current = {
      x: event.clientX - panel.offsetLeft,
      y: event.clientY - panel.offsetTop,
    };
    setDragging(true);
  };

  return { dragging, startDrag };
}

export function FloatingPanel({
  id,
  title,
  icon,
  open,
  minimized,
  mobile,
  position,
  widthClassName = "w-[320px]",
  onToggle,
  onMinimize,
  onPositionChange,
  children,
}: FloatingPanelProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const { dragging, startDrag } = useFloatingDrag(mobile, panelRef, onPositionChange);

  if (!open) return null;

  if (minimized) {
    if (mobile) return null;

    return (
      <button
        ref={panelRef as React.RefObject<HTMLButtonElement>}
        type="button"
        data-panel-id={`${id}-tab`}
        className={cn(
          "absolute z-20 inline-flex items-center gap-2 rounded-full border border-border/80 bg-card/95 px-3 py-2 text-xs font-medium text-foreground shadow-[var(--shadow-soft)] backdrop-blur-xl transition-colors hover:bg-muted",
          dragging && "select-none cursor-grabbing"
        )}
        style={{ left: position.x, top: position.y }}
        onPointerDown={startDrag}
        onClick={onToggle}
        aria-label={`Expandir ${title}`}
      >
        <span className="grid h-7 w-7 place-items-center rounded-full bg-primary/10 text-primary">{icon}</span>
        <span>{title}</span>
        <PanelBottomOpen size={14} className="text-muted-foreground" />
      </button>
    );
  }

  return (
    <div
      ref={panelRef}
      data-panel-id={id}
      className={cn(
        "z-20 overflow-hidden rounded-3xl border border-border/80 bg-card/95 text-card-foreground shadow-[var(--shadow-soft)] backdrop-blur-xl",
        mobile ? "fixed inset-x-3 bottom-20 max-h-[70vh]" : `absolute ${widthClassName}`,
        dragging && "select-none"
      )}
      style={mobile ? undefined : { left: position.x, top: position.y }}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-3 border-b border-border/70 px-4 py-3",
          mobile ? "cursor-default" : "cursor-grab active:cursor-grabbing"
        )}
        onPointerDown={startDrag}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-2xl bg-primary/10 text-primary">{icon}</span>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{title}</div>
            <div className="text-[11px] text-muted-foreground">{mobile ? "Painel móvel" : "Arraste para mover"}</div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {!mobile && <Move size={14} className="text-muted-foreground" />}
          <button
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onMinimize}
            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title="Minimizar"
            aria-label={`Minimizar ${title}`}
          >
            <Minus size={14} />
          </button>
        </div>
      </div>

      <div className={cn("overflow-auto", mobile ? "max-h-[calc(70vh-65px)] p-4" : "max-h-[65vh] p-4")}>{children}</div>
    </div>
  );
}

interface PanelDockItemProps {
  label: string;
  icon: React.ReactNode;
  active: boolean;
  minimized: boolean;
  onClick: () => void;
}

export function PanelDockItem({ label, icon, active, minimized, onClick }: PanelDockItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium shadow-[var(--shadow-soft)] transition-all",
        active
          ? "border-primary/40 bg-primary text-primary-foreground"
          : minimized
            ? "border-border/80 bg-card/95 text-foreground hover:bg-muted"
            : "border-border/80 bg-card/70 text-muted-foreground hover:text-foreground"
      )}
    >
      {active ? <PanelBottomOpen size={14} /> : icon}
      <span>{label}</span>
    </button>
  );
}
