import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Bot,
  Plus,
  Search,
  Pencil,
  Trash2,
  Power,
  Sparkles,
  BookOpen,
  Tag,
  X,
  Loader2,
  CheckCircle2,
  Circle,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import {
  listKnowledgeEntries,
  upsertKnowledgeEntry,
  toggleKnowledgeEntry,
  deleteKnowledgeEntry,
  KNOWLEDGE_CATEGORIES,
} from "@/lib/ai-knowledge.functions";

export const Route = createFileRoute("/assistant-ia")({
  component: AssistantIAPage,
  head: () => ({ meta: [{ title: "Assistant IA — Kadence" }] }),
});

type Entry = {
  id: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  priority: number;
  is_active: boolean;
  author_id: string | null;
  created_at: string;
  updated_at: string;
};

const ALL = "__all__";

function categoryLabel(value: string) {
  return KNOWLEDGE_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

function AssistantIAPage() {
  const list = useServerFn(listKnowledgeEntries);
  const upsert = useServerFn(upsertKnowledgeEntry);
  const toggle = useServerFn(toggleKnowledgeEntry);
  const del = useServerFn(deleteKnowledgeEntry);

  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>(ALL);
  const [editing, setEditing] = useState<Partial<Entry> | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await list();
      setEntries(r.entries as Entry[]);
    } catch (e: any) {
      toast.error(e?.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return entries.filter((e) => {
      if (cat !== ALL && e.category !== cat) return false;
      if (!needle) return true;
      return (
        e.title.toLowerCase().includes(needle) ||
        e.content.toLowerCase().includes(needle) ||
        e.tags.some((t) => t.toLowerCase().includes(needle))
      );
    });
  }, [entries, q, cat]);

  const counts = useMemo(() => {
    const active = entries.filter((e) => e.is_active).length;
    const total = entries.length;
    const chars = entries.filter((e) => e.is_active).reduce((acc, e) => acc + e.content.length, 0);
    return { active, total, chars };
  }, [entries]);

  const handleSave = async (payload: Partial<Entry>) => {
    try {
      await upsert({
        data: {
          id: payload.id,
          title: (payload.title || "").trim(),
          content: (payload.content || "").trim(),
          category: payload.category || "general",
          tags: payload.tags || [],
          priority: payload.priority ?? 0,
          is_active: payload.is_active ?? true,
        },
      });
      toast.success(payload.id ? "Connaissance mise à jour" : "Connaissance ajoutée");
      setEditing(null);
      await load();
    } catch (e: any) {
      toast.error(e?.message || "Échec de l'enregistrement");
    }
  };

  const handleToggle = async (e: Entry) => {
    try {
      await toggle({ data: { id: e.id, is_active: !e.is_active } });
      setEntries((prev) => prev.map((x) => (x.id === e.id ? { ...x, is_active: !x.is_active } : x)));
    } catch (err: any) {
      toast.error(err?.message || "Erreur");
    }
  };

  const handleDelete = async (e: Entry) => {
    if (!confirm(`Supprimer "${e.title}" ?`)) return;
    try {
      await del({ data: { id: e.id } });
      setEntries((prev) => prev.filter((x) => x.id !== e.id));
      toast.success("Supprimé");
    } catch (err: any) {
      toast.error(err?.message || "Erreur");
    }
  };

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div
            className="rounded-xl flex items-center justify-center shrink-0"
            style={{ width: 44, height: 44, backgroundColor: "var(--coral)" }}
          >
            <Bot size={22} color="var(--coral-text)" strokeWidth={1.8} />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 500, marginBottom: 2 }}>Assistant IA</h1>
            <p style={{ fontSize: 13, color: "var(--muted-foreground)", maxWidth: 560 }}>
              Alimente le chatbot avec les connaissances Skult. Chaque entrée active est
              automatiquement injectée dans les réponses que reçoivent les employés.
            </p>
          </div>
        </div>
        <button
          onClick={() => setEditing({ category: "general", tags: [], priority: 0, is_active: true })}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md transition active:scale-[0.98]"
          style={{ fontSize: 13, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--coral)" }}
        >
          <Plus size={15} strokeWidth={2} />
          Nouvelle connaissance
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
        <StatCard label="Connaissances actives" value={counts.active.toString()} sub={`sur ${counts.total} au total`} />
        <StatCard label="Volume injecté" value={`${(counts.chars / 1000).toFixed(1)}k`} sub="caractères dans le prompt" />
        <StatCard label="Catégories utilisées" value={new Set(entries.filter(e => e.is_active).map(e => e.category)).size.toString()} sub={`sur ${KNOWLEDGE_CATEGORIES.length} disponibles`} />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div
          className="flex items-center gap-2 px-3 rounded-md flex-1"
          style={{ border: "0.5px solid var(--border)", backgroundColor: "#fff" }}
        >
          <Search size={14} color="var(--muted-foreground)" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Rechercher dans le titre, contenu ou tags…"
            className="flex-1 py-2 outline-none bg-transparent"
            style={{ fontSize: 13 }}
          />
          {q && (
            <button onClick={() => setQ("")} style={{ color: "var(--muted-foreground)" }}>
              <X size={14} />
            </button>
          )}
        </div>
        <select
          value={cat}
          onChange={(e) => setCat(e.target.value)}
          className="px-3 py-2 rounded-md outline-none"
          style={{ fontSize: 13, border: "0.5px solid var(--border)", backgroundColor: "#fff", minWidth: 200 }}
        >
          <option value={ALL}>Toutes les catégories</option>
          {KNOWLEDGE_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center gap-2 py-10 justify-center" style={{ color: "var(--muted-foreground)", fontSize: 13 }}>
          <Loader2 size={14} className="animate-spin" /> Chargement…
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState onCreate={() => setEditing({ category: "general", tags: [], priority: 0, is_active: true })} hasFilter={!!q || cat !== ALL} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtered.map((e) => (
            <EntryCard
              key={e.id}
              entry={e}
              onEdit={() => setEditing(e)}
              onToggle={() => handleToggle(e)}
              onDelete={() => handleDelete(e)}
            />
          ))}
        </div>
      )}

      {editing && (
        <EditSheet
          initial={editing}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div
      className="p-4 rounded-lg"
      style={{ backgroundColor: "#fff", border: "0.5px solid var(--border)" }}
    >
      <div style={{ fontSize: 11, color: "var(--muted-foreground)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </div>
      <div style={{ fontSize: 22, fontWeight: 500, marginTop: 4, color: "var(--foreground)" }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function EmptyState({ onCreate, hasFilter }: { onCreate: () => void; hasFilter: boolean }) {
  return (
    <div
      className="rounded-lg p-10 text-center"
      style={{ backgroundColor: "#fff", border: "0.5px dashed var(--border)" }}
    >
      <div
        className="mx-auto rounded-full flex items-center justify-center mb-3"
        style={{ width: 44, height: 44, backgroundColor: "var(--muted)" }}
      >
        <BookOpen size={20} color="var(--muted-foreground)" strokeWidth={1.6} />
      </div>
      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 4 }}>
        {hasFilter ? "Aucune connaissance trouvée" : "Aucune connaissance pour l'instant"}
      </div>
      <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 14, maxWidth: 380, margin: "0 auto 14px" }}>
        {hasFilter
          ? "Essaie de modifier ta recherche ou de changer de catégorie."
          : "Le chatbot dispose déjà de la base Skult complète. Ajoute ici tout ce qui s'ajoute au fil du temps : nouvelles procédures, FAQ, produits, exceptions…"}
      </div>
      {!hasFilter && (
        <button
          onClick={onCreate}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md"
          style={{ fontSize: 13, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--coral)" }}
        >
          <Plus size={15} /> Première connaissance
        </button>
      )}
    </div>
  );
}

function EntryCard({
  entry, onEdit, onToggle, onDelete,
}: { entry: Entry; onEdit: () => void; onToggle: () => void; onDelete: () => void }) {
  const dim = !entry.is_active;
  return (
    <div
      className="p-4 rounded-lg flex flex-col gap-2"
      style={{
        backgroundColor: "#fff",
        border: "0.5px solid var(--border)",
        opacity: dim ? 0.55 : 1,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span
              className="inline-flex items-center px-1.5 py-0.5 rounded"
              style={{ fontSize: 10, fontWeight: 500, backgroundColor: "var(--muted)", color: "var(--muted-foreground)" }}
            >
              {categoryLabel(entry.category)}
            </span>
            {entry.priority > 0 && (
              <span style={{ fontSize: 10, color: "var(--coral)" }}>
                <Sparkles size={10} className="inline mr-0.5" /> priorité {entry.priority}
              </span>
            )}
            <span style={{ fontSize: 10, color: dim ? "var(--muted-foreground)" : "var(--success-text, #2d8a5f)" }} className="inline-flex items-center gap-1">
              {dim ? <Circle size={10} /> : <CheckCircle2 size={10} />}
              {dim ? "Désactivée" : "Active"}
            </span>
          </div>
          <h3 style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.3 }} className="truncate">
            {entry.title}
          </h3>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <IconBtn title={entry.is_active ? "Désactiver" : "Activer"} onClick={onToggle}><Power size={14} /></IconBtn>
          <IconBtn title="Modifier" onClick={onEdit}><Pencil size={14} /></IconBtn>
          <IconBtn title="Supprimer" onClick={onDelete}><Trash2 size={14} /></IconBtn>
        </div>
      </div>
      <p style={{ fontSize: 12, color: "var(--muted-foreground)", lineHeight: 1.5 }} className="line-clamp-3">
        {entry.content}
      </p>
      {entry.tags.length > 0 && (
        <div className="flex gap-1 flex-wrap">
          {entry.tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded"
              style={{ fontSize: 10, color: "var(--muted-foreground)", border: "0.5px solid var(--border)" }}>
              <Tag size={9} /> {t}
            </span>
          ))}
        </div>
      )}
      <div style={{ fontSize: 10, color: "var(--muted-foreground)" }}>
        Mis à jour {new Date(entry.updated_at).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}
      </div>
    </div>
  );
}

function IconBtn({ children, onClick, title }: { children: React.ReactNode; onClick: () => void; title: string }) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="rounded-md p-1.5 transition hover:bg-black/5"
      style={{ color: "var(--muted-foreground)" }}
    >
      {children}
    </button>
  );
}

function EditSheet({
  initial, onClose, onSave,
}: { initial: Partial<Entry>; onClose: () => void; onSave: (e: Partial<Entry>) => Promise<void> }) {
  const [title, setTitle] = useState(initial.title || "");
  const [content, setContent] = useState(initial.content || "");
  const [category, setCategory] = useState(initial.category || "general");
  const [tagsStr, setTagsStr] = useState((initial.tags || []).join(", "));
  const [priority, setPriority] = useState(initial.priority ?? 0);
  const [isActive, setIsActive] = useState(initial.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const submit = async () => {
    if (!title.trim() || !content.trim()) {
      toast.error("Titre et contenu requis");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        id: initial.id,
        title,
        content,
        category,
        tags: tagsStr.split(",").map((s) => s.trim()).filter(Boolean),
        priority,
        is_active: isActive,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" style={{ backgroundColor: "rgba(0,0,0,0.35)" }} onClick={onClose}>
      <div
        onClick={(e) => e.stopPropagation()}
        className="h-full overflow-y-auto"
        style={{ width: "100%", maxWidth: 640, backgroundColor: "#FAFAF8" }}
      >
        <div className="sticky top-0 z-10 px-5 py-4 flex items-center justify-between"
          style={{ backgroundColor: "#FAFAF8", borderBottom: "0.5px solid var(--border)" }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 500 }}>
              {initial.id ? "Modifier la connaissance" : "Nouvelle connaissance"}
            </div>
            <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
              Sera utilisée par le chatbot pour répondre aux employés
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md" style={{ color: "var(--muted-foreground)" }}>
            <X size={18} />
          </button>
        </div>

        <div className="p-5 flex flex-col gap-4">
          <Field label="Titre" hint="Court et descriptif (ex : Procédure ouverture Châtelain)">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              className="w-full px-3 py-2 rounded-md outline-none"
              style={{ fontSize: 13, border: "0.5px solid var(--border)", backgroundColor: "#fff" }}
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Catégorie">
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-md outline-none"
                style={{ fontSize: 13, border: "0.5px solid var(--border)", backgroundColor: "#fff" }}
              >
                {KNOWLEDGE_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Priorité" hint="0 = normale, 10 = importante">
              <input
                type="number"
                min={0}
                max={100}
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value || "0", 10))}
                className="w-full px-3 py-2 rounded-md outline-none"
                style={{ fontSize: 13, border: "0.5px solid var(--border)", backgroundColor: "#fff" }}
              />
            </Field>
          </div>

          <Field label="Tags" hint="Séparés par des virgules (ex : ouverture, machine, café)">
            <input
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
              className="w-full px-3 py-2 rounded-md outline-none"
              style={{ fontSize: 13, border: "0.5px solid var(--border)", backgroundColor: "#fff" }}
            />
          </Field>

          <Field
            label="Contenu"
            hint="Markdown supporté : **gras**, listes avec -, retours ligne. Soit précis et factuel."
            right={
              <button
                onClick={() => setShowPreview((v) => !v)}
                style={{ fontSize: 11, color: "var(--coral)" }}
              >
                {showPreview ? "Édition" : "Aperçu"}
              </button>
            }
          >
            {showPreview ? (
              <div
                className="kadence-md px-4 py-3 rounded-md"
                style={{ fontSize: 13, lineHeight: 1.5, backgroundColor: "#fff", border: "0.5px solid var(--border)", minHeight: 260 }}
              >
                <ReactMarkdown>{content || "_Aperçu vide_"}</ReactMarkdown>
              </div>
            ) : (
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                maxLength={20000}
                rows={14}
                className="w-full px-3 py-2 rounded-md outline-none resize-y"
                style={{ fontSize: 13, lineHeight: 1.5, fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", border: "0.5px solid var(--border)", backgroundColor: "#fff" }}
                placeholder="Ex : Pour ouvrir le studio Châtelain, arriver à 6h45. Allumer la machine espresso, lancer le rinçage..."
              />
            )}
            <div style={{ fontSize: 10, color: "var(--muted-foreground)", marginTop: 4 }}>
              {content.length}/20000 caractères
            </div>
          </Field>

          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="mt-0.5"
            />
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Active</div>
              <div style={{ fontSize: 11, color: "var(--muted-foreground)" }}>
                Si décochée, cette connaissance ne sera pas utilisée par le chatbot.
              </div>
            </div>
          </label>
        </div>

        <div className="sticky bottom-0 px-5 py-3 flex items-center justify-end gap-2"
          style={{ backgroundColor: "#FAFAF8", borderTop: "0.5px solid var(--border)" }}>
          <button onClick={onClose} className="px-3.5 py-2 rounded-md"
            style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
            Annuler
          </button>
          <button
            onClick={submit}
            disabled={saving}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md disabled:opacity-50"
            style={{ fontSize: 13, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--coral)" }}
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {initial.id ? "Enregistrer" : "Ajouter"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label, hint, right, children,
}: { label: string; hint?: string; right?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <label style={{ fontSize: 12, fontWeight: 500 }}>{label}</label>
        {right}
      </div>
      {children}
      {hint && <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 4 }}>{hint}</div>}
    </div>
  );
}
