import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Sheet, PrimaryButton } from "./shared";
import { CheckCircle2, Plus, X, Lock } from "lucide-react";
import { createAvailability, updateAvailability, deleteAvailability, getAvailabilityDeadline } from "@/lib/availabilities.functions";

const DAY_NAMES = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

// Créneaux horaires (pas de 30 min)
const HOURS: string[] = (() => {
  const out: string[] = [];
  for (let h = 6; h <= 23; h++) {
    out.push(`${String(h).padStart(2, "0")}:00`);
    out.push(`${String(h).padStart(2, "0")}:30`);
  }
  return out;
})();

interface Range {
  id?: string; // db id (existant) ou undefined (nouveau)
  start: string; // HH:MM
  end: string;   // HH:MM
}

export function disposKey(userId: string, year: number, month: number) {
  return `dispos_validated_${userId}_${year}_${String(month + 1).padStart(2, "0")}`;
}

export function DisposSheet({ open, onClose, userId }: { open: boolean; onClose: () => void; userId: string }) {
  const monthRef = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1, 1);
    return d;
  }, []);
  const year = monthRef.getFullYear();
  const month = monthRef.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthLabel = monthRef.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

  const [ranges, setRanges] = useState<Record<number, Range[]>>({});
  const [loading, setLoading] = useState(true);
  const [validated, setValidated] = useState(false);

  const dateISO = (day: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  useEffect(() => {
    if (!open) return;
    const flag = typeof window !== "undefined" ? localStorage.getItem(disposKey(userId, year, month)) : null;
    setValidated(!!flag);
    (async () => {
      setLoading(true);
      const start = dateISO(1);
      const end = dateISO(daysInMonth);
      const { data } = await supabase
        .from("availabilities")
        .select("id, avail_date, start_time, end_time")
        .eq("user_id", userId)
        .gte("avail_date", start)
        .lte("avail_date", end);
      const map: Record<number, Range[]> = {};
      data?.forEach((r) => {
        const d = parseInt(r.avail_date.slice(8, 10), 10);
        if (!map[d]) map[d] = [];
        map[d].push({
          id: r.id,
          start: String(r.start_time).slice(0, 5),
          end: String(r.end_time).slice(0, 5),
        });
      });
      setRanges(map);
      setLoading(false);
    })();
  }, [open, userId, year, month, daysInMonth]);

  const addRange = async (day: number) => {
    if (validated) return;
    // Plage par défaut : 9h-13h (modifiable)
    const newRange: Range = { start: "09:00", end: "13:00" };
    const { data, error } = await supabase
      .from("availabilities")
      .insert({ user_id: userId, avail_date: dateISO(day), start_time: newRange.start, end_time: newRange.end })
      .select("id")
      .single();
    if (error || !data) {
      toast.error("Erreur de sauvegarde");
      return;
    }
    setRanges((p) => ({ ...p, [day]: [...(p[day] ?? []), { ...newRange, id: data.id }] }));
  };

  const updateRange = async (day: number, idx: number, patch: Partial<Range>) => {
    if (validated) return;
    const list = ranges[day] ?? [];
    const updated = { ...list[idx], ...patch };
    if (updated.start >= updated.end) {
      toast.error("L'heure de fin doit être après le début");
      return;
    }
    setRanges((p) => ({ ...p, [day]: list.map((r, i) => (i === idx ? updated : r)) }));
    if (updated.id) {
      const { error } = await supabase
        .from("availabilities")
        .update({ start_time: updated.start, end_time: updated.end })
        .eq("id", updated.id);
      if (error) toast.error("Erreur de sauvegarde");
    }
  };

  const removeRange = async (day: number, idx: number) => {
    if (validated) return;
    const list = ranges[day] ?? [];
    const target = list[idx];
    setRanges((p) => ({ ...p, [day]: list.filter((_, i) => i !== idx) }));
    if (target.id) {
      const { error } = await supabase.from("availabilities").delete().eq("id", target.id);
      if (error) toast.error("Erreur de sauvegarde");
    }
  };

  const configured = Object.values(ranges).filter((r) => r.length > 0).length;

  const validate = () => {
    if (configured === 0) {
      toast.error("Indique au moins une disponibilité");
      return;
    }
    localStorage.setItem(disposKey(userId, year, month), new Date().toISOString());
    setValidated(true);
    toast.success("Dispos envoyées pour " + monthLabel);
  };

  return (
    <Sheet open={open} onClose={onClose} title={`Dispos · ${monthLabel}`}>
      {validated ? (
        <div className="rounded-xl px-4 py-6 flex flex-col items-center gap-3 mb-3" style={{ backgroundColor: "var(--success-bg)" }}>
          <CheckCircle2 size={36} style={{ color: "var(--success-text)" }} />
          <div style={{ fontSize: 14, fontWeight: 500, color: "var(--success-text)" }}>Dispos envoyées</div>
          <div style={{ fontSize: 12, color: "var(--success-text)", textAlign: "center", textTransform: "capitalize" }}>
            Tes dispos pour {monthLabel} ont été envoyées.
          </div>
          <div style={{ fontSize: 11, color: "var(--muted-foreground)", textAlign: "center" }}>
            L'admin va générer le planning sous 24-48h. Tu pourras à nouveau modifier tes dispos le mois prochain.
          </div>
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12, color: "var(--muted-foreground)", marginBottom: 12, lineHeight: 1.5 }}>
            Indique tes plages horaires de disponibilité pour <span style={{ textTransform: "capitalize" }}>{monthLabel}</span>. Tu peux ajouter plusieurs plages par jour.
          </div>
          <div className="rounded-xl px-3 py-2 mb-3" style={{ backgroundColor: configured >= 10 ? "var(--success-bg)" : "var(--warning-bg)" }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: configured >= 10 ? "var(--success-text)" : "var(--warning-text)" }}>
              {configured} / {daysInMonth} jours configurés
            </span>
          </div>
        </>
      )}

      {loading ? (
        <div style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Chargement…</div>
      ) : (
        <div className="flex flex-col gap-1.5 mb-3" style={{ opacity: validated ? 0.6 : 1, pointerEvents: validated ? "none" : "auto" }}>
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((day) => {
            const dow = DAY_NAMES[new Date(year, month, day).getDay()];
            const dayRanges = ranges[day] ?? [];
            return (
              <div key={day} className="rounded-lg border px-3 py-2" style={{ backgroundColor: "#fff", borderColor: "rgba(0,0,0,0.08)" }}>
                <div className="flex items-center justify-between mb-1.5">
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{dow} {day}</div>
                  <button
                    onClick={() => addRange(day)}
                    className="flex items-center gap-1 rounded-md px-2 py-0.5"
                    style={{ fontSize: 10, color: "var(--coral)", border: "0.5px solid var(--coral)" }}
                  >
                    <Plus size={11} /> Ajouter
                  </button>
                </div>
                {dayRanges.length === 0 ? (
                  <div style={{ fontSize: 11, color: "var(--muted-foreground)", fontStyle: "italic" }}>Aucune dispo</div>
                ) : (
                  <div className="flex flex-col gap-1">
                    {dayRanges.map((r, idx) => (
                      <div key={idx} className="flex items-center gap-1.5">
                        <select
                          value={r.start}
                          onChange={(e) => updateRange(day, idx, { start: e.target.value })}
                          className="rounded-md px-1.5 py-0.5"
                          style={{ fontSize: 11, border: "0.5px solid var(--border)", backgroundColor: "#fff" }}
                        >
                          {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                        </select>
                        <span style={{ fontSize: 11, color: "var(--muted-foreground)" }}>→</span>
                        <select
                          value={r.end}
                          onChange={(e) => updateRange(day, idx, { end: e.target.value })}
                          className="rounded-md px-1.5 py-0.5"
                          style={{ fontSize: 11, border: "0.5px solid var(--border)", backgroundColor: "#fff" }}
                        >
                          {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                        </select>
                        <button
                          onClick={() => removeRange(day, idx)}
                          className="ml-auto rounded-md p-1"
                          style={{ color: "var(--muted-foreground)" }}
                          aria-label="Supprimer"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!validated && !loading && (
        <PrimaryButton onClick={validate}>Valider mes dispos</PrimaryButton>
      )}
    </Sheet>
  );
}
