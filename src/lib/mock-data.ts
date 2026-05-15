// Types partagés + roleColors dynamique (Proxy branché sur business_roles).
// Les anciens tableaux fictifs (employees, todayShifts, etc.) ont été retirés :
// l'app lit désormais ces données depuis Supabase. Seuls les types et helpers
// encore référencés en runtime sont conservés.

export type Role = string;
export type ContractType = "Étudiant" | "Flexi" | "CDI";
export type Studio = string;
export type ShiftStatus = "terminé" | "en-cours" | "retard" | "à-venir";

// Conservé pour compat : utilisé par du code legacy non rendu (ChecklistsTab).
export interface ChecklistTemplate {
  id: string;
  studio: Studio;
  role: Role;
  items: { id: string; label: string; photoRequired: boolean; aiValidation: boolean }[];
  completionRate: number;
  frequentlySkipped: string[];
}

// roleColors : proxy dynamique qui lit la table business_roles via le cache du hook.
// Conserve l'API existante `roleColors[role].dot/bg/text` partout dans l'app.
import { getRoleStyle } from "./staff-helpers";
export const roleColors: Record<string, { bg: string; text: string; dot: string }> = new Proxy(
  {},
  { get: (_t, prop: string) => getRoleStyle(prop) },
) as any;

// Stub vide : la vraie source est la table checklist_templates (DB).
export const checklistTemplates: ChecklistTemplate[] = [];

export function getQuotaStatus(
  used: number | null,
  max: number | null,
): "safe" | "warning" | "danger" | null {
  if (used === null || max === null) return null;
  const pct = used / max;
  if (pct >= 0.9) return "danger";
  if (pct >= 0.5) return "warning";
  return "safe";
}
