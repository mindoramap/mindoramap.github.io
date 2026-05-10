// Properties side panel for the selected node
import type { MindNodeData, NodeKind } from "@/store/maps";
import { Type, CheckSquare, Code2, Link as LinkIcon, Trash2, Sparkles } from "lucide-react";
import { sanitizeNodeUrl } from "@/lib/security";

interface Props {
  node: { id: string; data: MindNodeData } | null;
  onPatch: (id: string, patch: Partial<MindNodeData>) => void;
  onDelete: (id: string) => void;
  onKeywordConnect: (id: string, scope: "one" | "all") => void;
  onClose: () => void;
}

const KINDS: { id: NodeKind; label: string; icon: React.ReactNode }[] = [
  { id: "text", label: "Texto", icon: <Type size={14} /> },
  { id: "checklist", label: "Tarefa", icon: <CheckSquare size={14} /> },
  { id: "code", label: "Codigo", icon: <Code2 size={14} /> },
  { id: "link", label: "Link", icon: <LinkIcon size={14} /> },
];

export function PropertiesPanel({ node, onPatch, onDelete, onKeywordConnect, onClose }: Props) {
  if (!node) return null;
  const { id, data } = node;
  const kind = data.kind || "text";
  const rawUrl = data.url || "";
  const sanitizedUrl = sanitizeNodeUrl(rawUrl);
  const showInvalidUrl = Boolean(rawUrl && !sanitizedUrl);

  return (
    <aside className="absolute top-4 right-4 w-72 bg-card/95 backdrop-blur border border-border rounded-2xl shadow-[var(--shadow-soft)] p-4 z-20 animate-in fade-in slide-in-from-right-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold">Propriedades</h3>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">
          Fechar
        </button>
      </div>

      <label className="text-xs text-muted-foreground">Rótulo</label>
      <input
        value={data.label}
        onChange={(e) => onPatch(id, { label: e.target.value })}
        className="w-full mt-1 mb-3 px-2 py-1.5 rounded-md bg-input border border-border text-sm outline-none focus:ring-2 focus:ring-ring"
      />

      <label className="text-xs text-muted-foreground">Tipo</label>
      <div className="grid grid-cols-4 gap-1 mt-1 mb-3">
        {KINDS.map((entry) => (
          <button
            key={entry.id}
            onClick={() => onPatch(id, { kind: entry.id })}
            className={`flex flex-col items-center gap-1 py-2 rounded-md border text-[10px] transition-colors ${
              kind === entry.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted"
            }`}
          >
            {entry.icon}
            {entry.label}
          </button>
        ))}
      </div>

      {kind === "link" && (
        <>
          <label className="text-xs text-muted-foreground">URL</label>
          <input
            value={rawUrl}
            onChange={(e) => onPatch(id, { url: e.target.value.trim() })}
            placeholder="https://... ou /editor/..."
            className="w-full mt-1 mb-3 px-2 py-1.5 rounded-md bg-input border border-border text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          {showInvalidUrl && (
            <p className="text-xs text-destructive -mt-2 mb-3">
              Use apenas links `https://`, `http://` ou caminhos internos iniciando com `/`.
            </p>
          )}
        </>
      )}

      {kind === "checklist" && (
        <label className="flex items-center gap-2 text-sm mb-3">
          <input
            type="checkbox"
            checked={!!data.checked}
            onChange={(e) => onPatch(id, { checked: e.target.checked })}
          />
          Concluído
        </label>
      )}

      <div className="border-t border-border pt-3 mt-2 space-y-2">
        <p className="text-xs font-medium flex items-center gap-1.5">
          <Sparkles size={12} className="text-primary" /> Conectar por palavra-chave
        </p>
        <div className="flex gap-1">
          <button
            onClick={() => onKeywordConnect(id, "one")}
            className="flex-1 px-2 py-1.5 rounded-md border border-border hover:bg-muted text-xs"
          >
            Sugerir 1
          </button>
          <button
            onClick={() => onKeywordConnect(id, "all")}
            className="flex-1 px-2 py-1.5 rounded-md border border-border hover:bg-muted text-xs"
          >
            Conectar todos
          </button>
        </div>
      </div>

      {!data.isRoot && (
        <button
          onClick={() => onDelete(id)}
          className="w-full mt-3 px-2 py-1.5 rounded-md border border-destructive/40 text-destructive hover:bg-destructive/10 text-xs flex items-center justify-center gap-1.5"
        >
          <Trash2 size={12} /> Excluir nó
        </button>
      )}
    </aside>
  );
}
