// Pure scoring logic — safe to import client & server.
// Mirror of the per-shift score computation used by computeScoreBreakdown
// and the closure recap, so the admin UI can simulate locally.

export interface ScoringRules {
  weight_punctuality: number; // %
  weight_checklist: number;
  weight_photos: number;
  punct_0min: number;
  punct_5min: number;
  punct_15min: number;
  punct_30min: number;
  punct_over: number;
  punct_noshow: number;
  checklist_complete: number;
  checklist_bonus_per_photo_item: number;
  checklist_penalty_per_missed: number;
  photos_all_validated: number;
  photos_penalty_per_refused: number;
}

export const DEFAULT_RULES: ScoringRules = {
  weight_punctuality: 33,
  weight_checklist: 33,
  weight_photos: 34,
  punct_0min: 10,
  punct_5min: 9,
  punct_15min: 7,
  punct_30min: 4,
  punct_over: 1,
  punct_noshow: 0,
  checklist_complete: 10,
  checklist_bonus_per_photo_item: 0.5,
  checklist_penalty_per_missed: 1,
  photos_all_validated: 10,
  photos_penalty_per_refused: 2,
};

export const PROFILES: Record<
  "bienveillant" | "equilibre" | "exigeant",
  ScoringRules & {
    punctuality_tolerance: "forte" | "moyenne" | "faible";
    checklist_strictness: "faible" | "moyenne" | "forte";
    photos_importance: "facultatif" | "important" | "critique";
  }
> = {
  bienveillant: {
    punctuality_tolerance: "forte",
    checklist_strictness: "faible",
    photos_importance: "facultatif",
    weight_punctuality: 25, weight_checklist: 40, weight_photos: 35,
    punct_0min: 10, punct_5min: 10, punct_15min: 8, punct_30min: 6,
    punct_over: 4, punct_noshow: 0,
    checklist_complete: 10, checklist_bonus_per_photo_item: 0.5,
    checklist_penalty_per_missed: 0,
    photos_all_validated: 10, photos_penalty_per_refused: 0,
  },
  equilibre: {
    punctuality_tolerance: "moyenne",
    checklist_strictness: "moyenne",
    photos_importance: "important",
    weight_punctuality: 33, weight_checklist: 33, weight_photos: 34,
    punct_0min: 10, punct_5min: 9, punct_15min: 7, punct_30min: 4,
    punct_over: 1, punct_noshow: 0,
    checklist_complete: 10, checklist_bonus_per_photo_item: 0.5,
    checklist_penalty_per_missed: 1,
    photos_all_validated: 10, photos_penalty_per_refused: 2,
  },
  exigeant: {
    punctuality_tolerance: "faible",
    checklist_strictness: "forte",
    photos_importance: "critique",
    weight_punctuality: 40, weight_checklist: 30, weight_photos: 30,
    punct_0min: 10, punct_5min: 7, punct_15min: 4, punct_30min: 1,
    punct_over: -2, punct_noshow: -5,
    checklist_complete: 10, checklist_bonus_per_photo_item: 1,
    checklist_penalty_per_missed: 3,
    photos_all_validated: 10, photos_penalty_per_refused: 4,
  },
};

// Mapping tolerance levels → punctuality bareme presets
export const PUNCT_PRESETS: Record<
  "forte" | "moyenne" | "faible",
  Pick<ScoringRules, "punct_0min"|"punct_5min"|"punct_15min"|"punct_30min"|"punct_over"|"punct_noshow">
> = {
  forte: { punct_0min: 10, punct_5min: 10, punct_15min: 8, punct_30min: 6, punct_over: 4, punct_noshow: 0 },
  moyenne: { punct_0min: 10, punct_5min: 9, punct_15min: 7, punct_30min: 4, punct_over: 1, punct_noshow: 0 },
  faible: { punct_0min: 10, punct_5min: 7, punct_15min: 4, punct_30min: 1, punct_over: -2, punct_noshow: -5 },
};

export const CHECKLIST_PRESETS: Record<
  "faible" | "moyenne" | "forte",
  Pick<ScoringRules, "checklist_complete"|"checklist_bonus_per_photo_item"|"checklist_penalty_per_missed">
> = {
  faible:  { checklist_complete: 10, checklist_bonus_per_photo_item: 0.5, checklist_penalty_per_missed: 0 },
  moyenne: { checklist_complete: 10, checklist_bonus_per_photo_item: 0.5, checklist_penalty_per_missed: 1 },
  forte:   { checklist_complete: 10, checklist_bonus_per_photo_item: 1,   checklist_penalty_per_missed: 3 },
};

export const PHOTOS_PRESETS: Record<
  "facultatif" | "important" | "critique",
  Pick<ScoringRules, "photos_all_validated"|"photos_penalty_per_refused">
> = {
  facultatif: { photos_all_validated: 10, photos_penalty_per_refused: 0 },
  important:  { photos_all_validated: 10, photos_penalty_per_refused: 2 },
  critique:   { photos_all_validated: 10, photos_penalty_per_refused: 4 },
};

// Compute punctuality score from minutes_late (null = no-show if shift was published & past)
export function scorePunctuality(rules: ScoringRules, minutesLate: number | null, noShow = false): number {
  if (noShow || minutesLate === null) return rules.punct_noshow;
  const ml = minutesLate;
  if (ml <= 0) return rules.punct_0min;
  if (ml <= 5) return rules.punct_5min;
  if (ml <= 15) return rules.punct_15min;
  if (ml <= 30) return rules.punct_30min;
  return rules.punct_over;
}

export function scoreChecklist(rules: ScoringRules, pct: number /* 0..1 */, missedCount = 0): number {
  const base = pct * rules.checklist_complete;
  const penalty = missedCount * rules.checklist_penalty_per_missed;
  return Math.max(0, base - penalty);
}

export function scorePhotos(rules: ScoringRules, pct: number /* 0..1 */, refusedCount = 0): number {
  const base = pct * rules.photos_all_validated;
  const penalty = refusedCount * rules.photos_penalty_per_refused;
  return Math.max(0, base - penalty);
}

export interface ShiftScenario {
  lateMin: number;
  checklistPct: number; // 0..100
  photosValidatedPct: number; // 0..100
  missedItems?: number;
  refusedPhotos?: number;
}

export function applyScoringRules(rules: ScoringRules, s: ShiftScenario): number {
  const p = scorePunctuality(rules, s.lateMin);
  const c = scoreChecklist(rules, s.checklistPct / 100, s.missedItems ?? 0);
  const ph = scorePhotos(rules, s.photosValidatedPct / 100, s.refusedPhotos ?? 0);
  const totalWeight = rules.weight_punctuality + rules.weight_checklist + rules.weight_photos || 100;
  const score =
    (p * rules.weight_punctuality +
      c * rules.weight_checklist +
      ph * rules.weight_photos) / totalWeight;
  return Math.max(0, Math.round(score * 10) / 10);
}
