// Custom mind map node - supports text, checklist, code, link
import { memo, useEffect, useRef, useState } from "react";
import { Handle, Position, type NodeProps } from "reactflow";
import { CheckSquare, Square, Code2, Link as LinkIcon, Type } from "lucide-react";
import type { MindNodeData, NodeKind } from "@/store/maps";
import { isSafeNodeUrl } from "@/lib/security";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";

const KIND_ICON: Record<NodeKind, React.ReactNode> = {
  text: <Type size={12} />,
  checklist: <CheckSquare size={12} />,
  code: <Code2 size={12} />,
  link: <LinkIcon size={12} />,
};

const HANDLE_DEFINITIONS = [
  { side: "top", position: Position.Top },
  { side: "right", position: Position.Right },
  { side: "bottom", position: Position.Bottom },
  { side: "left", position: Position.Left },
] as const;

type HandleSide = (typeof HANDLE_DEFINITIONS)[number]["side"];

function MindNodeBase({ id, data, selected }: NodeProps<MindNodeData>) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(data.label);
  const inputRef = useRef<HTMLInputElement>(null);
  const kind = data.kind || "text";

  useEffect(() => {
    setValue(data.label);
  }, [data.label]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { id: string };
      if (detail.id !== id) return;
      setEditing(true);
    };
    window.addEventListener("mm-node-start-edit", handler);
    return () => window.removeEventListener("mm-node-start-edit", handler);
  }, [id]);

  const dispatch = (patch: Partial<MindNodeData>) => {
    window.dispatchEvent(new CustomEvent("mm-node-update", { detail: { id, patch } }));
  };

  const commit = () => {
    setEditing(false);
    dispatch({ label: value.trim() || "Sem titulo" });
  };

  const requestChildCreation = (
    e: React.MouseEvent | React.PointerEvent,
    side: HandleSide
  ) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent("mm-node-add-child", { detail: { id, side } }));
  };

  const requestAction = (
    action: "add-child" | "add-sibling" | "edit" | "connect" | "create-linked-map" | "delete"
  ) => {
    window.dispatchEvent(new CustomEvent("mm-node-action", { detail: { id, action } }));
  };

  const safeUrl = isSafeNodeUrl(data.url) ? data.url : null;
  const isExternalLink = Boolean(safeUrl && /^https?:\/\//i.test(safeUrl));
  const resolvedUrl = safeUrl?.startsWith("/") ? `#${safeUrl}` : safeUrl;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          className={[
            "group/node px-3 py-2 rounded-xl border transition-all select-none relative",
            "shadow-[var(--shadow-soft)]",
            data.isRoot
              ? "bg-[image:var(--gradient-hero)] text-primary-foreground border-transparent font-semibold"
              : "bg-card text-card-foreground border-border hover:border-primary/50",
            selected ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : "",
          ].join(" ")}
          style={{ minWidth: 140, maxWidth: 260 }}
        >
          {HANDLE_DEFINITIONS.map((handle) => (
            <Handle
              key={`target-${handle.side}`}
              id={`target-${handle.side}`}
              type="target"
              position={handle.position}
              className={`mind-handle mind-handle-${handle.side} !opacity-0 group-hover/node:!opacity-100`}
              onDoubleClick={(e) => requestChildCreation(e, handle.side)}
            />
          ))}

          {HANDLE_DEFINITIONS.map((handle) => (
            <Handle
              key={`source-${handle.side}`}
              id={`source-${handle.side}`}
              type="source"
              position={handle.position}
              className={`mind-handle mind-handle-${handle.side} !opacity-0 group-hover/node:!opacity-100`}
              onDoubleClick={(e) => requestChildCreation(e, handle.side)}
            />
          ))}

          <div className="flex items-center gap-2">
            <span className={data.isRoot ? "opacity-90" : "text-muted-foreground"}>{KIND_ICON[kind]}</span>

            {kind === "checklist" && !data.isRoot && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch({ checked: !data.checked });
                }}
                className="shrink-0"
                aria-label="toggle"
              >
                {data.checked ? <CheckSquare size={14} className="text-primary" /> : <Square size={14} />}
              </button>
            )}

            <div className="flex-1 min-w-0">
              {editing ? (
                <input
                  ref={inputRef}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  onBlur={commit}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") commit();
                    if (e.key === "Escape") {
                      setValue(data.label);
                      setEditing(false);
                    }
                  }}
                  className="bg-transparent outline-none w-full text-sm"
                />
              ) : kind === "code" ? (
                <code
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setEditing(true);
                  }}
                  className={`text-xs font-mono break-all ${data.isRoot ? "" : "text-foreground"}`}
                >
                  {data.label}
                </code>
              ) : kind === "link" && safeUrl ? (
                <a
                  href={resolvedUrl ?? undefined}
                  target={isExternalLink ? "_blank" : undefined}
                  rel={isExternalLink ? "noreferrer" : undefined}
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setEditing(true);
                  }}
                  className="text-sm underline truncate block"
                >
                  {data.label}
                </a>
              ) : kind === "link" ? (
                <span
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setEditing(true);
                  }}
                  className="text-sm break-words text-muted-foreground"
                >
                  Link inválido
                </span>
              ) : (
                <span
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setEditing(true);
                  }}
                  className={`text-sm break-words ${kind === "checklist" && data.checked ? "line-through opacity-60" : ""}`}
                >
                  {data.label}
                </span>
              )}
            </div>
          </div>
        </div>
      </ContextMenuTrigger>

        <ContextMenuContent className="w-52">
          <ContextMenuItem onClick={() => requestAction("edit")}>Editar texto</ContextMenuItem>
          <ContextMenuItem onClick={() => requestAction("add-child")}>Criar filho</ContextMenuItem>
          <ContextMenuItem onClick={() => requestAction("add-sibling")}>Criar irmão</ContextMenuItem>
          <ContextMenuItem onClick={() => requestAction("connect")}>Iniciar conexão</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => requestAction("create-linked-map")}>
          Criar mapa conectado
        </ContextMenuItem>
        {!data.isRoot && (
          <>
            <ContextMenuSeparator />
            <ContextMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => requestAction("delete")}
            >
              Excluir nó
            </ContextMenuItem>
          </>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}

export const MindNode = memo(MindNodeBase);
