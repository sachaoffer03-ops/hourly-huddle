import { Star } from "lucide-react";

interface RatingInputProps {
  value: number;          // 0..10
  onChange: (v: number) => void;
  size?: "sm" | "md" | "lg";
  readOnly?: boolean;
  showNumber?: boolean;
}

/**
 * Note manager sur 10. Affiche 10 étoiles cliquables + le chiffre.
 * Centralisé pour /staff/$id, modale Noter de /planning, et tout autre point d'entrée.
 */
export function RatingInput({ value, onChange, size = "md", readOnly = false, showNumber = true }: RatingInputProps) {
  const px = size === "sm" ? 12 : size === "lg" ? 22 : 16;
  const gap = size === "sm" ? 1 : size === "lg" ? 3 : 2;
  const safe = Math.max(0, Math.min(10, Math.round(value || 0)));
  return (
    <div className="inline-flex items-center" style={{ gap: 8 }}>
      <div className="inline-flex items-center" style={{ gap }}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const filled = n <= safe;
          const Btn: any = readOnly ? "span" : "button";
          return (
            <Btn
              key={n}
              type={readOnly ? undefined : "button"}
              onClick={readOnly ? undefined : () => onChange(n)}
              aria-label={readOnly ? undefined : `Note ${n} sur 10`}
              style={{
                display: "inline-flex", lineHeight: 0,
                cursor: readOnly ? "default" : "pointer",
                background: "transparent", border: "none", padding: 0,
              }}
            >
              <Star
                size={px}
                fill={filled ? "var(--coral)" : "transparent"}
                color={filled ? "var(--coral)" : "rgba(0,0,0,0.22)"}
                strokeWidth={1.4}
              />
            </Btn>
          );
        })}
      </div>
      {showNumber && (
        <span style={{ fontSize: size === "sm" ? 11 : 12, fontWeight: 500, color: "var(--muted-foreground)" }}>
          {safe}/10
        </span>
      )}
    </div>
  );
}

/** Rendu compact en lecture seule (pour listes denses). */
export function RatingBadge({ value }: { value: number }) {
  const safe = Math.max(0, Math.min(10, Math.round(value || 0)));
  const color = safe >= 8 ? "var(--coral)" : safe >= 5 ? "var(--muted-foreground)" : "var(--danger-text, #b94c4c)";
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
      style={{ fontSize: 11, fontWeight: 500, color, backgroundColor: "color-mix(in oklab, var(--muted) 70%, transparent)" }}>
      <Star size={11} fill={color} color={color} strokeWidth={1.4} />
      {safe}/10
    </span>
  );
}
