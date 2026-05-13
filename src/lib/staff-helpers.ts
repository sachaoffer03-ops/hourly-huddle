// Helpers partagés pour les pages connectées à Supabase.
// Les rôles métier sont éditables côté admin (table business_roles).
// On dérive le style à partir de la couleur stockée en DB via le cache du hook.
import { getRoleColor } from "@/hooks/use-business-roles";

export type BusinessRole = string;

// Mélange une couleur hex avec du blanc pour produire un fond clair.
function tint(hex: string, alpha = 0.18): string {
  return `color-mix(in oklab, ${hex} ${Math.round(alpha * 100)}%, white)`;
}
function darken(hex: string, ratio = 0.55): string {
  return `color-mix(in oklab, ${hex} ${Math.round(ratio * 100)}%, black)`;
}

export function getRoleStyle(role: string | null | undefined) {
  if (role === "manager") {
    return { bg: "var(--muted)", text: "var(--foreground)", dot: "var(--foreground)" };
  }
  const c = getRoleColor(role, "#888");
  return { bg: tint(c, 0.18), text: darken(c, 0.55), dot: c };
}

export const initials = (first?: string | null, last?: string | null) =>
  `${(first?.[0] || "").toUpperCase()}${(last?.[0] || "").toUpperCase()}` || "?";

export const fullName = (p: { first_name?: string | null; last_name?: string | null } | null | undefined) =>
  p ? `${p.first_name || ""} ${p.last_name || ""}`.trim() || "—" : "—";

export const hhmm = (t?: string | null) => (t ? t.slice(0, 5).replace(":", "h") : "—");

export const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });
