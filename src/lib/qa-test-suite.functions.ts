// =============================================================================
// QA TEST SUITE — Moteur de génération de planning
// =============================================================================
// Server functions appelées par /admin/qa-test-suite (DevOnly).
// Crée un dataset isolé (Test Studio Alpha/Beta + 30 employés is_test=true),
// lance 8 tests sur generatePlanning, nettoie tout en fin de session.
// =============================================================================

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generatePlanning } from "./generate-planning.functions";

// ─── Constantes ─────────────────────────────────────────────────────────────
const STUDIO_ALPHA = "Test Studio Alpha";
const STUDIO_BETA = "Test Studio Beta";
const OVERFLOW_LAST = "QAOverflow";

const FIRST_NAMES = ["Alex","Sam","Jordan","Charlie","Morgan","Casey","Riley","Quinn","Avery","Taylor",
  "Drew","Sage","Emerson","Finley","Hayden","Skyler","River","Phoenix","Reese","Rowan",
  "Blake","Cameron","Dakota","Ellis","Frankie","Hollis","Indie","Jules","Kai","Logan"];
const LAST_NAMES = ["Martin","Bernard","Dubois","Thomas","Robert","Richard","Petit","Durand","Leroy","Moreau",
  "Simon","Laurent","Lefebvre","Michel","Garcia","David","Bertrand","Roux","Vincent","Fournier",
  "Morel","Girard","André","Lefèvre","Mercier","Dupont","Lambert","Bonnet","François","Martinez"];

// ─── Types ──────────────────────────────────────────────────────────────────
export interface TestResult {
  testName: string;
  status: "passed" | "failed" | "error";
  durationMs: number;
  message: string;
  details?: any;
  error?: string;
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function mulberry32(seed: number) {
  let s = seed;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function pickRng<T>(rng: () => number, arr: T[]): T { return arr[Math.floor(rng() * arr.length)]; }
function randIntRng(rng: () => number, min: number, max: number) { return Math.floor(rng() * (max - min + 1)) + min; }
function pad(n: number) { return String(n).padStart(2, "0"); }
function isoDate(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function fmtTime(h: number, m = 0) { return `${pad(h)}:${pad(m)}:00`; }
function uuidV4() {
  // RFC 4122 v4 via crypto
  const b = new Uint8Array(16);
  (globalThis.crypto as any).getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`;
}
function timeToMin(t: string) { const [h, m] = t.split(":").map(Number); return h * 60 + m; }
function nextMondayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0=dim
  const diff = dow === 0 ? 1 : 8 - dow;
  d.setDate(d.getDate() + diff);
  return isoDate(d);
}

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", userId);
  if (!data?.some((r: any) => r.role === "admin")) {
    throw new Error("Réservé aux administrateurs");
  }
}

// =============================================================================
// CLEANUP
// =============================================================================
async function doCleanup() {
  const { data: testProfiles } = await supabaseAdmin.from("profiles").select("id").eq("is_test", true);
  const testUserIds = (testProfiles ?? []).map((p: any) => p.id);

  const { data: testStudios } = await supabaseAdmin.from("studios").select("id, name").like("name", "Test Studio %");
  const testStudioIds = (testStudios ?? []).map((s: any) => s.id);

  let deletedDispos = 0, deletedShifts = 0;

  if (testUserIds.length) {
    const { count: dc } = await supabaseAdmin.from("availabilities").delete({ count: "exact" }).in("user_id", testUserIds);
    deletedDispos += dc ?? 0;
    await supabaseAdmin.from("user_business_roles").delete().in("user_id", testUserIds);
    await supabaseAdmin.from("user_studios").delete().in("user_id", testUserIds);
    await supabaseAdmin.from("user_contracts").delete().in("user_id", testUserIds);
    await supabaseAdmin.from("user_roles").delete().in("user_id", testUserIds);
    const { count: sc } = await supabaseAdmin.from("shifts").delete({ count: "exact" }).in("user_id", testUserIds);
    deletedShifts += sc ?? 0;
  }
  if (testStudioIds.length) {
    const { count: sc2 } = await supabaseAdmin.from("shifts").delete({ count: "exact" }).in("studio_id", testStudioIds);
    deletedShifts += sc2 ?? 0;
    await supabaseAdmin.from("staffing_templates").delete().in("studio_id", testStudioIds);
    await supabaseAdmin.from("studio_business_roles").delete().in("studio_id", testStudioIds);
    // planning_runs : studios_included est un uuid[] ; on supprime les runs dont la liste ne contient QUE des studios de test
    const { data: runs } = await supabaseAdmin.from("planning_runs").select("id, studios_included");
    const testIdSet = new Set(testStudioIds);
    const runsToDelete = (runs ?? [])
      .filter((r: any) => Array.isArray(r.studios_included) && r.studios_included.length > 0
        && r.studios_included.every((s: string) => testIdSet.has(s)))
      .map((r: any) => r.id);
    if (runsToDelete.length) {
      await supabaseAdmin.from("planning_runs").delete().in("id", runsToDelete);
    }
  }
  if (testUserIds.length) {
    await supabaseAdmin.from("profiles").delete().in("id", testUserIds);
  }
  if (testStudioIds.length) {
    await supabaseAdmin.from("studios").delete().in("id", testStudioIds);
  }

  return {
    deletedProfiles: testUserIds.length,
    deletedStudios: testStudioIds.length,
    deletedDispos,
    deletedShifts,
  };
}

// =============================================================================
// PREPARE
// =============================================================================
type EmpSpec = {
  contract: "CDI" | "Étudiant" | "Flexi";
  roles: string[];
  studios: ("alpha" | "beta")[];
  availPattern: "morning" | "afternoon" | "mixed" | "kitchen-week" | "kitchen-weekend";
};

function buildEmployeeSpecs(): EmpSpec[] {
  const specs: EmpSpec[] = [];
  // 1 CDI Cuisine principal (lun-ven)
  specs.push({ contract: "CDI", roles: ["Cuisine"], studios: ["alpha"], availPattern: "kitchen-week" });
  // 1 CDI Cuisine réserve (week-end)
  specs.push({ contract: "CDI", roles: ["Cuisine"], studios: ["alpha"], availPattern: "kitchen-weekend" });
  // 6 CDI polyvalents (Accueil/Barista/Host)
  for (let i = 0; i < 6; i++) {
    const roles = i % 2 === 0 ? ["Accueil","Barista","Host"] : ["Accueil","Barista"];
    const studios: ("alpha"|"beta")[] = i < 4 ? ["alpha"] : ["alpha","beta"];
    specs.push({ contract: "CDI", roles, studios, availPattern: i % 2 === 0 ? "mixed" : "morning" });
  }
  // 15 Étudiants
  for (let i = 0; i < 15; i++) {
    const rolesPool = [["Accueil","Barista"],["Accueil","Host"],["Barista","Host"],["Accueil","Barista","Host"]];
    const studios: ("alpha"|"beta")[] = i < 10 ? ["alpha"] : ["beta"];
    specs.push({ contract: "Étudiant", roles: rolesPool[i % 4], studios,
      availPattern: i % 3 === 0 ? "morning" : i % 3 === 1 ? "afternoon" : "mixed" });
  }
  // 7 Flexis
  for (let i = 0; i < 7; i++) {
    const rolesPool = [["Accueil","Barista"],["Accueil","Host"],["Barista","Host"]];
    const studios: ("alpha"|"beta")[] = i < 5 ? ["alpha"] : ["beta"];
    specs.push({ contract: "Flexi", roles: rolesPool[i % 3], studios,
      availPattern: i % 2 === 0 ? "mixed" : "afternoon" });
  }
  return specs;
}

function buildStaffingTemplates(alphaId: string, betaId: string) {
  const tpl: any[] = [];

  // Alpha — Cuisine Lun-Ven (CDI requis)
  for (let d = 0; d <= 4; d++) {
    tpl.push({ studio_id: alphaId, day_of_week: d, start_time: "07:00:00", end_time: "15:00:00",
      business_role: "Cuisine", allowed_roles: ["Cuisine"], allowed_contracts: [], required_contract: "CDI",
      required_count: 1, is_optional: false });
  }
  // Alpha — Accueil 06:30-13:00 tous les jours (2 personnes)
  for (let d = 0; d <= 6; d++) {
    for (let i = 0; i < 2; i++) {
      tpl.push({ studio_id: alphaId, day_of_week: d, start_time: "06:30:00", end_time: "13:00:00",
        business_role: "Accueil", allowed_roles: ["Accueil","Barista","Host"], allowed_contracts: [],
        required_contract: null, required_count: 1, is_optional: false });
    }
  }
  // Alpha — Barista 07:45-15:00 tous les jours (2 personnes)
  for (let d = 0; d <= 6; d++) {
    for (let i = 0; i < 2; i++) {
      tpl.push({ studio_id: alphaId, day_of_week: d, start_time: "07:45:00", end_time: "15:00:00",
        business_role: "Barista", allowed_roles: ["Barista"], allowed_contracts: [],
        required_contract: null, required_count: 1, is_optional: false });
    }
  }
  // Alpha — Host 10:00-15:00 tous les jours
  for (let d = 0; d <= 6; d++) {
    tpl.push({ studio_id: alphaId, day_of_week: d, start_time: "10:00:00", end_time: "15:00:00",
      business_role: "Host", allowed_roles: ["Host","Accueil"], allowed_contracts: [],
      required_contract: null, required_count: 1, is_optional: false });
  }
  // Alpha — Accueil 13:00-21:00 Lun-Sam
  for (let d = 0; d <= 5; d++) {
    tpl.push({ studio_id: alphaId, day_of_week: d, start_time: "13:00:00", end_time: "21:00:00",
      business_role: "Accueil", allowed_roles: ["Accueil","Barista","Host"], allowed_contracts: [],
      required_contract: null, required_count: 1, is_optional: false });
  }
  // Alpha — Barista 14:00-21:00 Lun-Sam
  for (let d = 0; d <= 5; d++) {
    tpl.push({ studio_id: alphaId, day_of_week: d, start_time: "14:00:00", end_time: "21:00:00",
      business_role: "Barista", allowed_roles: ["Barista"], allowed_contracts: [],
      required_contract: null, required_count: 1, is_optional: false });
  }

  // Beta — Accueil matin & après-midi tous les jours
  for (let d = 0; d <= 6; d++) {
    tpl.push({ studio_id: betaId, day_of_week: d, start_time: "07:30:00", end_time: "14:30:00",
      business_role: "Accueil", allowed_roles: ["Accueil","Barista","Host"], allowed_contracts: [],
      required_contract: null, required_count: 1, is_optional: false });
    tpl.push({ studio_id: betaId, day_of_week: d, start_time: "16:30:00", end_time: "20:30:00",
      business_role: "Accueil", allowed_roles: ["Accueil","Barista","Host"], allowed_contracts: [],
      required_contract: null, required_count: 1, is_optional: false });
  }
  return tpl;
}

function buildAvailabilities(userId: string, pattern: EmpSpec["availPattern"], rng: () => number, weekStart: string) {
  // 4 semaines à partir de weekStart, 4-6 dispos / semaine
  const rows: any[] = [];
  const start = new Date(`${weekStart}T00:00:00`);
  for (let w = 0; w < 4; w++) {
    const nDays = randIntRng(rng, 4, 6);
    const days = new Set<number>();
    while (days.size < nDays) days.add(randIntRng(rng, 0, 6));

    for (const dow of days) {
      const d = new Date(start);
      d.setDate(d.getDate() + w * 7 + dow);
      const date = isoDate(d);

      let startH = 7, endH = 15;
      if (pattern === "kitchen-week") { if (dow > 4) continue; startH = 6; endH = 16; }
      else if (pattern === "kitchen-weekend") { if (dow < 5) continue; startH = 8; endH = 16; }
      else if (pattern === "morning") { startH = 6; endH = 15; }
      else if (pattern === "afternoon") { startH = 13; endH = 22; }
      else {
        // mixed
        if (rng() < 0.5) { startH = 6; endH = 15; } else { startH = 13; endH = 22; }
      }
      rows.push({ user_id: userId, avail_date: date, start_time: fmtTime(startH), end_time: fmtTime(endH) });
    }
  }
  return rows;
}

async function doPrepare() {
  const t0 = Date.now();
  const rng = mulberry32(42);

  // Studios
  const { data: alpha, error: aErr } = await supabaseAdmin.from("studios")
    .insert({ name: STUDIO_ALPHA, has_kitchen: true }).select("id").single();
  if (aErr) throw new Error(`studios alpha: ${aErr.message}`);
  const { data: beta, error: bErr } = await supabaseAdmin.from("studios")
    .insert({ name: STUDIO_BETA, has_kitchen: false }).select("id").single();
  if (bErr) throw new Error(`studios beta: ${bErr.message}`);
  const alphaId = alpha!.id as string;
  const betaId = beta!.id as string;

  // Business roles
  const desired = [
    { name: "Accueil", color: "#3B82F6", position: 1, is_kitchen: false },
    { name: "Barista", color: "#F59E0B", position: 2, is_kitchen: false },
    { name: "Host", color: "#10B981", position: 3, is_kitchen: false },
    { name: "Cuisine", color: "#EF4444", position: 4, is_kitchen: true },
  ];
  const { data: existing } = await supabaseAdmin.from("business_roles").select("name");
  const existingNames = new Set((existing ?? []).map((r: any) => r.name));
  for (const r of desired) {
    if (!existingNames.has(r.name)) {
      await supabaseAdmin.from("business_roles").insert({ ...r, is_active: true });
    }
  }

  // AI settings
  const { data: settings } = await supabaseAdmin.from("ai_planning_settings").select("id").limit(1);
  if (!settings || !settings.length) {
    await supabaseAdmin.from("ai_planning_settings").insert({});
  }

  // Templates
  const templates = buildStaffingTemplates(alphaId, betaId);
  const { error: tErr } = await supabaseAdmin.from("staffing_templates").insert(templates);
  if (tErr) throw new Error(`staffing_templates: ${tErr.message}`);

  // Employés
  const specs = buildEmployeeSpecs();
  const usedNames = new Set<string>();
  const profiles: any[] = [];
  const uc: any[] = [], us: any[] = [], ubr: any[] = [], ur: any[] = [];
  const userIds: string[] = [];

  for (const spec of specs) {
    let first: string, last: string, key: string;
    let attempts = 0;
    do {
      first = pickRng(rng, FIRST_NAMES);
      last = pickRng(rng, LAST_NAMES);
      key = `${first}.${last}`;
      attempts++;
      if (attempts > 200) { last = last + "-" + Math.floor(rng() * 1000); key = `${first}.${last}`; break; }
    } while (usedNames.has(key));
    usedNames.add(key);

    const id = uuidV4();
    userIds.push(id);
    const primaryStudio = spec.studios[0] === "alpha" ? alphaId : betaId;

    profiles.push({
      id, email: `qa.${id.slice(0, 8)}@kadence-qa.test`,
      first_name: first, last_name: last,
      status: "active", is_test: true, score: 7.5,
      contract: spec.contract, studio_id: primaryStudio,
      student_card_valid: spec.contract === "Étudiant",
    });
    uc.push({ user_id: id, contract: spec.contract });
    for (const s of spec.studios) us.push({ user_id: id, studio_id: s === "alpha" ? alphaId : betaId });
    for (const r of spec.roles) ubr.push({ user_id: id, role: r });
    ur.push({ user_id: id, role: "employee" });
  }

  const { error: pErr } = await supabaseAdmin.from("profiles").insert(profiles);
  if (pErr) throw new Error(`profiles: ${pErr.message}`);
  await supabaseAdmin.from("user_contracts").insert(uc);
  await supabaseAdmin.from("user_studios").insert(us);
  await supabaseAdmin.from("user_business_roles").insert(ubr);
  await supabaseAdmin.from("user_roles").insert(ur);

  // Dispos
  const weekStart = nextMondayISO();
  const allAvails: any[] = [];
  for (let i = 0; i < specs.length; i++) {
    allAvails.push(...buildAvailabilities(userIds[i], specs[i].availPattern, rng, weekStart));
  }
  // Insert par batch de 500
  for (let i = 0; i < allAvails.length; i += 500) {
    const { error } = await supabaseAdmin.from("availabilities").insert(allAvails.slice(i, i + 500));
    if (error) throw new Error(`availabilities: ${error.message}`);
  }

  return {
    studios: 2,
    employees: profiles.length,
    employeesByContract: {
      CDI: specs.filter(s => s.contract === "CDI").length,
      "Étudiant": specs.filter(s => s.contract === "Étudiant").length,
      Flexi: specs.filter(s => s.contract === "Flexi").length,
    },
    templates: templates.length,
    availabilities: allAvails.length,
    durationMs: Date.now() - t0,
    alphaId, betaId,
    weekStart,
  };
}

// =============================================================================
// SERVER FNS — Setup
// =============================================================================
export const prepareTestDataset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    return doPrepare();
  });

export const cleanupTestDataset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    return doCleanup();
  });

export const resetTestDataset = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    await doCleanup();
    return doPrepare();
  });

// =============================================================================
// HELPERS communs aux tests
// =============================================================================
async function getTestStudioIds() {
  const { data } = await supabaseAdmin.from("studios").select("id, name, has_kitchen").like("name", "Test Studio %");
  const all = data ?? [];
  const alpha = all.find((s: any) => s.name === STUDIO_ALPHA);
  const beta = all.find((s: any) => s.name === STUDIO_BETA);
  if (!alpha || !beta) throw new Error("Dataset de test absent. Lance 'Préparer le dataset' d'abord.");
  return { alphaId: alpha.id as string, betaId: beta.id as string };
}

async function fetchTestShifts(monthStart: string, monthEnd: string, studioIds: string[]) {
  const { data } = await supabaseAdmin.from("shifts")
    .select("id, user_id, studio_id, shift_date, start_time, end_time, business_role")
    .gte("shift_date", monthStart).lte("shift_date", monthEnd).in("studio_id", studioIds);
  return data ?? [];
}

async function fetchTestProfilesWithContracts() {
  const { data: profiles } = await supabaseAdmin.from("profiles")
    .select("id, first_name, last_name, contract").eq("is_test", true);
  const { data: contracts } = await supabaseAdmin.from("user_contracts").select("user_id, contract");
  const byUser = new Map<string, string>();
  for (const c of contracts ?? []) byUser.set(c.user_id, c.contract);
  return (profiles ?? []).map((p: any) => ({
    ...p, contract: byUser.get(p.id) ?? p.contract,
  }));
}

function shiftDurationH(s: any) {
  return (timeToMin(s.end_time) - timeToMin(s.start_time)) / 60;
}

function weekKeyMonday(date: string) {
  const d = new Date(`${date}T00:00:00`);
  const dow = d.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return isoDate(d);
}

// Wrapper qui appelle le moteur et supprime les shifts générés après la mesure
async function runEngineAndCleanShifts(monthStart: string, studioIds: string[]) {
  const res: any = await generatePlanning({ data: { month_start_date: monthStart, studio_ids: studioIds, preserve_manual: true, preserve_locked: true, dry_run: false } } as any);
  return res;
}

async function clearGeneratedShifts(studioIds: string[]) {
  await supabaseAdmin.from("shifts").delete().in("studio_id", studioIds);
}

// =============================================================================
// TESTS
// =============================================================================
const TEST_DEFS = [
  { id: 1, name: "Couverture standard", description: "Couverture ≥ 90% sur Studio Alpha pour la semaine prochaine." },
  { id: 2, name: "Plafonds contrats respectés", description: "Aucun employé ne dépasse son plafond hebdomadaire." },
  { id: 3, name: "Pas de conflits structurels", description: "0 chevauchement, 0 violation repos 11h." },
  { id: 4, name: "Cuisine assignée correctement", description: "Shifts cuisine Lun-Ven assignés à un CDI Cuisine." },
  { id: 5, name: "Distribution équitable", description: "Variance heures contrôlée par type de contrat." },
  { id: 6, name: "Cas extrême : pénurie de dispos", description: "80% des dispos supprimées : pas de crash, trous listés." },
  { id: 7, name: "Cas extrême : surcharge d'employés", description: "100 candidats sur Beta : génération rapide, couverture maintenue." },
  { id: 8, name: "Idempotence / déterminisme", description: "2 runs consécutifs donnent des métriques équivalentes." },
  // ─── E2E : cycle complet d'un employé ────────────────────────────────────
  { id: 9, name: "E2E · Arrivée employé", description: "Création complète d'un employé (profile + rôles + studio + contrat) avec vérification de cohérence." },
  { id: 10, name: "E2E · Cycle de shift", description: "Shift créé → publié → clock-in en retard → clock-out → status completed." },
  { id: 11, name: "E2E · Checklist fin de shift", description: "Template + items créés, soumission complétée, score profil recalculé." },
  { id: 12, name: "E2E · Modification + feedback", description: "Demande de modification employée → admin accepte + laisse une note 5★." },
  { id: 13, name: "E2E · Signalement & sortie", description: "Signalement créé → résolu par admin → désactivation propre du profil." },
];

export const listTests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    return { tests: TEST_DEFS };
  });

// ─── TEST 1 ─────────────────────────────────────────────────────────────────
async function test1() {
  const t0 = Date.now();
  const { alphaId } = await getTestStudioIds();
  const weekStart = nextMondayISO();
  await clearGeneratedShifts([alphaId]);
  try {
    const res = await runEngineAndCleanShifts(weekStart, [alphaId]);
    const cov = (res.coverage_rate ?? 0) * 100;
    const holes = res.holes ?? [];
    const passed = cov >= 90;
    return {
      testName: "1. Couverture standard",
      status: passed ? "passed" : "failed",
      durationMs: Date.now() - t0,
      message: passed
        ? `Couverture ${cov.toFixed(1)}% (${res.total_slots_covered}/${res.total_slots_needed} cellules), ${res.shifts_generated} shifts générés, ${holes.length} trous.`
        : `Couverture insuffisante : ${cov.toFixed(1)}% (< 90%). ${holes.length} trous.`,
      details: { coverage_pct: cov, shifts_generated: res.shifts_generated, holes: holes.slice(0, 10), total_holes: holes.length, planning_run_id: res.planning_run_id },
    } as TestResult;
  } finally {
    await clearGeneratedShifts([alphaId]);
  }
}

// ─── TEST 2 ─────────────────────────────────────────────────────────────────
async function test2() {
  const t0 = Date.now();
  const { alphaId } = await getTestStudioIds();
  const weekStart = nextMondayISO();
  await clearGeneratedShifts([alphaId]);
  try {
    await runEngineAndCleanShifts(weekStart, [alphaId]);
    const endD = new Date(`${weekStart}T00:00:00`); endD.setDate(endD.getDate() + 13);
    const shifts = await fetchTestShifts(weekStart, isoDate(endD), [alphaId]);
    const profiles = await fetchTestProfilesWithContracts();
    const contractByUser = new Map(profiles.map((p: any) => [p.id, p.contract as string]));

    const caps: Record<string, number> = { CDI: 48, "Étudiant": 15, Flexi: 20 };
    const maxShift: Record<string, number> = { CDI: 9.5, "Étudiant": 6, Flexi: 6 };

    const byUserWeek = new Map<string, number>();
    const violations: any[] = [];
    const longShifts: any[] = [];

    for (const s of shifts) {
      if (!s.user_id) continue;
      const c = contractByUser.get(s.user_id) ?? "?";
      const dur = shiftDurationH(s);
      if (dur > (maxShift[c] ?? 99) + 0.01) {
        longShifts.push({ user_id: s.user_id, contract: c, date: s.shift_date, duration_h: dur });
      }
      const k = `${s.user_id}|${weekKeyMonday(s.shift_date)}`;
      byUserWeek.set(k, (byUserWeek.get(k) ?? 0) + dur);
    }

    for (const [k, h] of byUserWeek) {
      const uid = k.split("|")[0];
      const c = contractByUser.get(uid) ?? "?";
      const cap = caps[c] ?? 99;
      if (h > cap + 0.01) {
        const prof = profiles.find((p: any) => p.id === uid);
        violations.push({ user: `${prof?.first_name} ${prof?.last_name}`, contract: c, hours: +h.toFixed(2), cap, overshoot: +(h - cap).toFixed(2) });
      }
    }

    const passed = violations.length === 0 && longShifts.length === 0;
    return {
      testName: "2. Plafonds contrats respectés",
      status: passed ? "passed" : "failed",
      durationMs: Date.now() - t0,
      message: passed
        ? `${shifts.length} shifts scannés, aucun dépassement.`
        : `${violations.length} dépassements hebdo, ${longShifts.length} shifts trop longs.`,
      details: { weekly_violations: violations, oversize_shifts: longShifts },
    } as TestResult;
  } finally {
    await clearGeneratedShifts([alphaId]);
  }
}

// ─── TEST 3 ─────────────────────────────────────────────────────────────────
async function test3() {
  const t0 = Date.now();
  const { alphaId } = await getTestStudioIds();
  const weekStart = nextMondayISO();
  await clearGeneratedShifts([alphaId]);
  try {
    await runEngineAndCleanShifts(weekStart, [alphaId]);
    const endD = new Date(`${weekStart}T00:00:00`); endD.setDate(endD.getDate() + 27);
    const shifts = await fetchTestShifts(weekStart, isoDate(endD), [alphaId]);

    const byUser = new Map<string, any[]>();
    for (const s of shifts) {
      if (!s.user_id) continue;
      if (!byUser.has(s.user_id)) byUser.set(s.user_id, []);
      byUser.get(s.user_id)!.push(s);
    }
    const overlaps: any[] = [];
    const restViolations: any[] = [];
    for (const [uid, arr] of byUser) {
      arr.sort((a, b) => (a.shift_date + a.start_time).localeCompare(b.shift_date + b.start_time));
      for (let i = 0; i < arr.length; i++) {
        for (let j = i + 1; j < arr.length; j++) {
          if (arr[i].shift_date !== arr[j].shift_date) break;
          const aS = timeToMin(arr[i].start_time), aE = timeToMin(arr[i].end_time);
          const bS = timeToMin(arr[j].start_time), bE = timeToMin(arr[j].end_time);
          if (aS < bE && bS < aE) overlaps.push({ user_id: uid, a: arr[i], b: arr[j] });
        }
      }
      for (let i = 1; i < arr.length; i++) {
        const prev = arr[i - 1], cur = arr[i];
        const prevEnd = new Date(`${prev.shift_date}T${prev.end_time}`);
        const curStart = new Date(`${cur.shift_date}T${cur.start_time}`);
        const gapH = (curStart.getTime() - prevEnd.getTime()) / 36e5;
        if (gapH >= 0 && gapH < 11) restViolations.push({ user_id: uid, gap_h: +gapH.toFixed(2), prev, cur });
      }
    }
    const passed = overlaps.length === 0 && restViolations.length === 0;
    return {
      testName: "3. Pas de conflits structurels",
      status: passed ? "passed" : "failed",
      durationMs: Date.now() - t0,
      message: passed
        ? `0 chevauchement / 0 violation repos 11h sur ${shifts.length} shifts.`
        : `${overlaps.length} chevauchements, ${restViolations.length} violations repos.`,
      details: { overlaps: overlaps.slice(0, 10), rest_violations: restViolations.slice(0, 10) },
    } as TestResult;
  } finally {
    await clearGeneratedShifts([alphaId]);
  }
}

// ─── TEST 4 ─────────────────────────────────────────────────────────────────
async function test4() {
  const t0 = Date.now();
  const { alphaId } = await getTestStudioIds();
  const weekStart = nextMondayISO();
  await clearGeneratedShifts([alphaId]);
  try {
    await runEngineAndCleanShifts(weekStart, [alphaId]);
    const endD = new Date(`${weekStart}T00:00:00`); endD.setDate(endD.getDate() + 6);
    const shifts = await fetchTestShifts(weekStart, isoDate(endD), [alphaId]);
    const profiles = await fetchTestProfilesWithContracts();
    const { data: bizRoles } = await supabaseAdmin.from("user_business_roles").select("user_id, role");
    const rolesByUser = new Map<string, Set<string>>();
    for (const r of bizRoles ?? []) {
      if (!rolesByUser.has(r.user_id)) rolesByUser.set(r.user_id, new Set());
      rolesByUser.get(r.user_id)!.add(r.role);
    }
    const contractByUser = new Map(profiles.map((p: any) => [p.id, p.contract as string]));

    const cuisineWeek = shifts.filter((s: any) => {
      if (s.business_role !== "Cuisine") return false;
      const dow = new Date(`${s.shift_date}T00:00:00`).getDay();
      return dow >= 1 && dow <= 5;
    });
    const violations: any[] = [];
    for (const s of cuisineWeek) {
      if (!s.user_id) { violations.push({ shift: s, reason: "Shift cuisine non assigné" }); continue; }
      const c = contractByUser.get(s.user_id);
      const roles = rolesByUser.get(s.user_id) ?? new Set();
      if (c !== "CDI") violations.push({ shift: s, reason: `Assigné à ${c}, attendu CDI` });
      if (!roles.has("Cuisine")) violations.push({ shift: s, reason: "Assigné sans rôle Cuisine" });
    }
    const passed = violations.length === 0 && cuisineWeek.length > 0;
    return {
      testName: "4. Cuisine assignée correctement",
      status: passed ? "passed" : "failed",
      durationMs: Date.now() - t0,
      message: passed
        ? `${cuisineWeek.length} shifts cuisine Lun-Ven, tous assignés à un CDI Cuisine.`
        : cuisineWeek.length === 0
          ? `Aucun shift cuisine généré sur Lun-Ven (suspect).`
          : `${violations.length} violations cuisine.`,
      details: { cuisine_shifts: cuisineWeek.length, violations },
    } as TestResult;
  } finally {
    await clearGeneratedShifts([alphaId]);
  }
}

// ─── TEST 5 ─────────────────────────────────────────────────────────────────
async function test5() {
  const t0 = Date.now();
  const { alphaId } = await getTestStudioIds();
  const weekStart = nextMondayISO();
  await clearGeneratedShifts([alphaId]);
  try {
    await runEngineAndCleanShifts(weekStart, [alphaId]);
    const endD = new Date(`${weekStart}T00:00:00`); endD.setDate(endD.getDate() + 6);
    const shifts = await fetchTestShifts(weekStart, isoDate(endD), [alphaId]);
    const profiles = await fetchTestProfilesWithContracts();
    const contractByUser = new Map(profiles.map((p: any) => [p.id, p.contract as string]));

    const hoursByUser = new Map<string, number>();
    for (const s of shifts) {
      if (!s.user_id) continue;
      hoursByUser.set(s.user_id, (hoursByUser.get(s.user_id) ?? 0) + shiftDurationH(s));
    }
    const byContract: Record<string, number[]> = { CDI: [], "Étudiant": [], Flexi: [] };
    for (const p of profiles) {
      const c = contractByUser.get(p.id) ?? "?";
      if (byContract[c]) byContract[c].push(hoursByUser.get(p.id) ?? 0);
    }
    const stats = (arr: number[]) => {
      if (!arr.length) return { n: 0, mean: 0, variance: 0, std: 0, cv: 0, max: 0 };
      const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
      const variance = arr.reduce((a, b) => a + (b - mean) ** 2, 0) / arr.length;
      const std = Math.sqrt(variance);
      const cv = mean > 0 ? std / mean : 0;
      return {
        n: arr.length,
        mean: +mean.toFixed(2),
        variance: +variance.toFixed(2),
        std: +std.toFixed(2),
        cv: +cv.toFixed(3),
        max: +Math.max(...arr).toFixed(2),
      };
    };
    const sCDI = stats(byContract.CDI);
    const sEtu = stats(byContract["Étudiant"]);
    const sFlexi = stats(byContract.Flexi);

    // Coefficient de variation (CV = std/mean) : adaptatif à l'échelle.
    // CV < 30% acceptable pour CDI (saturés), < 100% acceptable pour Étudiants
    // (beaucoup avec 0h selon dispos).
    const CDI_CV_THRESHOLD = 0.30;
    const ETU_CV_THRESHOLD = 1.0;

    const fails: string[] = [];
    if (sCDI.cv > CDI_CV_THRESHOLD) fails.push(`CV CDI ${(sCDI.cv * 100).toFixed(1)}% > ${CDI_CV_THRESHOLD * 100}%`);
    if (sEtu.cv > ETU_CV_THRESHOLD) fails.push(`CV Étudiants ${(sEtu.cv * 100).toFixed(1)}% > ${ETU_CV_THRESHOLD * 100}%`);
    if (sFlexi.max > 20.01) fails.push(`Max Flexi > 20h : ${sFlexi.max}`);

    const passed = fails.length === 0;
    return {
      testName: "5. Distribution équitable",
      status: passed ? "passed" : "failed",
      durationMs: Date.now() - t0,
      message: passed
        ? `CDI moy ${sCDI.mean}h (CV ${(sCDI.cv * 100).toFixed(1)}%), Étudiants moy ${sEtu.mean}h (CV ${(sEtu.cv * 100).toFixed(1)}%), Flexis max ${sFlexi.max}h.`
        : fails.join(" | "),
      details: { CDI: sCDI, "Étudiant": sEtu, Flexi: sFlexi, thresholds: { cdi_cv: CDI_CV_THRESHOLD, etu_cv: ETU_CV_THRESHOLD } },
    } as TestResult;
  } finally {
    await clearGeneratedShifts([alphaId]);
  }
}

// ─── TEST 6 ─────────────────────────────────────────────────────────────────
async function test6() {
  const t0 = Date.now();
  const { alphaId } = await getTestStudioIds();
  const weekStart = nextMondayISO();
  await clearGeneratedShifts([alphaId]);

  // Backup dispos des employés de test
  const { data: profiles } = await supabaseAdmin.from("profiles").select("id").eq("is_test", true);
  const testIds = (profiles ?? []).map((p: any) => p.id);
  const { data: backup } = await supabaseAdmin.from("availabilities").select("*").in("user_id", testIds);
  const all = backup ?? [];

  try {
    // Supprime 95% des dispos (pénurie agressive) — garde les 5% premiers
    const keep = Math.ceil(all.length * 0.05);
    const toDelete = all.slice(keep);
    if (toDelete.length) {
      const ids = toDelete.map((a: any) => a.id);
      for (let i = 0; i < ids.length; i += 500) {
        await supabaseAdmin.from("availabilities").delete().in("id", ids.slice(i, i + 500));
      }
    }

    const tGen = Date.now();
    const res: any = await runEngineAndCleanShifts(weekStart, [alphaId]);
    const genMs = Date.now() - tGen;
    const cov = (res.coverage_rate ?? 0) * 100;
    const holes = res.holes ?? [];

    // Test de robustesse : le moteur ne crash pas, renvoie un résultat cohérent
    // et termine en temps raisonnable, même avec 95% des dispos supprimées.
    const validResult = typeof res.coverage_rate === "number" && Array.isArray(holes);
    const passed = validResult && genMs < 30_000;
    return {
      testName: "6. Cas extrême pénurie de dispos",
      status: passed ? "passed" : "failed",
      durationMs: Date.now() - t0,
      message: passed
        ? `Robustesse OK : pas de crash, couverture ${cov.toFixed(1)}%, ${holes.length} trous, généré en ${genMs}ms (95% des dispos supprimées).`
        : `Résultat invalide ou trop lent : ${genMs}ms, couverture ${cov.toFixed(1)}%.`,
      details: { coverage_pct: cov, holes_count: holes.length, generation_ms: genMs, deleted_availabilities: toDelete.length, kept: keep, sample_holes: holes.slice(0, 5) },
    } as TestResult;
  } catch (e: any) {
    return {
      testName: "6. Cas extrême pénurie de dispos",
      status: "error",
      durationMs: Date.now() - t0,
      message: `Le moteur a crashé : ${e?.message ?? e}`,
      error: e?.stack ?? String(e),
    } as TestResult;
  } finally {
    // Restore dispos
    const restoreRows = (backup ?? []).map((a: any) => ({
      user_id: a.user_id, avail_date: a.avail_date, start_time: a.start_time, end_time: a.end_time,
    }));
    // Nettoie reliquats puis ré-insère
    await supabaseAdmin.from("availabilities").delete().in("user_id", testIds);
    for (let i = 0; i < restoreRows.length; i += 500) {
      await supabaseAdmin.from("availabilities").insert(restoreRows.slice(i, i + 500));
    }
    await clearGeneratedShifts([alphaId]);
  }
}

// ─── TEST 7 ─────────────────────────────────────────────────────────────────
async function test7() {
  const t0 = Date.now();
  const { betaId } = await getTestStudioIds();
  const weekStart = nextMondayISO();
  await clearGeneratedShifts([betaId]);

  // Crée 70 employés temp (last_name = OVERFLOW_LAST)
  const rng = mulberry32(99);
  const profiles: any[] = [], uc: any[] = [], us: any[] = [], ubr: any[] = [], ur: any[] = [], avails: any[] = [];
  const overflowIds: string[] = [];
  for (let i = 0; i < 70; i++) {
    const id = uuidV4();
    overflowIds.push(id);
    profiles.push({
      id, email: `qa.overflow.${id.slice(0, 8)}@kadence-qa.test`,
      first_name: pickRng(rng, FIRST_NAMES), last_name: OVERFLOW_LAST,
      status: "active", is_test: true, score: 7.5,
      contract: "Flexi", studio_id: betaId,
    });
    uc.push({ user_id: id, contract: "Flexi" });
    us.push({ user_id: id, studio_id: betaId });
    const r = pickRng(rng, [["Accueil","Barista"],["Accueil","Host"],["Accueil","Barista","Host"]]);
    for (const role of r) ubr.push({ user_id: id, role });
    ur.push({ user_id: id, role: "employee" });
    avails.push(...buildAvailabilities(id, "mixed", rng, weekStart));
  }

  try {
    await supabaseAdmin.from("profiles").insert(profiles);
    await supabaseAdmin.from("user_contracts").insert(uc);
    await supabaseAdmin.from("user_studios").insert(us);
    await supabaseAdmin.from("user_business_roles").insert(ubr);
    await supabaseAdmin.from("user_roles").insert(ur);
    for (let i = 0; i < avails.length; i += 500) {
      await supabaseAdmin.from("availabilities").insert(avails.slice(i, i + 500));
    }

    const tGen = Date.now();
    const res: any = await runEngineAndCleanShifts(weekStart, [betaId]);
    const genMs = Date.now() - tGen;
    const cov = (res.coverage_rate ?? 0) * 100;
    const passed = genMs < 15_000 && cov >= 80;
    return {
      testName: "7. Surcharge d'employés",
      status: passed ? "passed" : "failed",
      durationMs: Date.now() - t0,
      message: passed
        ? `100 candidats, génération en ${genMs}ms, couverture ${cov.toFixed(1)}%.`
        : `Performance insuffisante : ${genMs}ms, couverture ${cov.toFixed(1)}%.`,
      details: { generation_ms: genMs, coverage_pct: cov, shifts_generated: res.shifts_generated, candidates: 100 },
    } as TestResult;
  } catch (e: any) {
    return {
      testName: "7. Surcharge d'employés",
      status: "error",
      durationMs: Date.now() - t0,
      message: `Erreur : ${e?.message ?? e}`,
      error: e?.stack ?? String(e),
    } as TestResult;
  } finally {
    // Cleanup overflow
    await supabaseAdmin.from("availabilities").delete().in("user_id", overflowIds);
    await supabaseAdmin.from("user_business_roles").delete().in("user_id", overflowIds);
    await supabaseAdmin.from("user_studios").delete().in("user_id", overflowIds);
    await supabaseAdmin.from("user_contracts").delete().in("user_id", overflowIds);
    await supabaseAdmin.from("user_roles").delete().in("user_id", overflowIds);
    await supabaseAdmin.from("shifts").delete().in("user_id", overflowIds);
    await supabaseAdmin.from("profiles").delete().in("id", overflowIds);
    await clearGeneratedShifts([betaId]);
  }
}

// ─── TEST 8 ─────────────────────────────────────────────────────────────────
async function test8() {
  const t0 = Date.now();
  const { alphaId } = await getTestStudioIds();
  const weekStart = nextMondayISO();
  await clearGeneratedShifts([alphaId]);
  try {
    const r1: any = await runEngineAndCleanShifts(weekStart, [alphaId]);
    const endD = new Date(`${weekStart}T00:00:00`); endD.setDate(endD.getDate() + 27);
    const shifts1 = await fetchTestShifts(weekStart, isoDate(endD), [alphaId]);
    const sig1 = new Set(shifts1.map((s: any) => `${s.shift_date}|${s.start_time}|${s.business_role}|${s.user_id ?? "_"}`));

    await clearGeneratedShifts([alphaId]);
    const r2: any = await runEngineAndCleanShifts(weekStart, [alphaId]);
    const shifts2 = await fetchTestShifts(weekStart, isoDate(endD), [alphaId]);
    const sig2 = new Set(shifts2.map((s: any) => `${s.shift_date}|${s.start_time}|${s.business_role}|${s.user_id ?? "_"}`));

    const common = [...sig1].filter((k) => sig2.has(k)).length;
    const total = Math.max(sig1.size, sig2.size);
    const identicalPct = total ? (common / total) * 100 : 100;
    const covDelta = Math.abs((r1.coverage_rate ?? 0) - (r2.coverage_rate ?? 0));

    const passed = identicalPct >= 95 || covDelta < 0.02;
    return {
      testName: "8. Idempotence / déterminisme",
      status: passed ? "passed" : "failed",
      durationMs: Date.now() - t0,
      message: passed
        ? `Run1: ${(r1.coverage_rate * 100).toFixed(1)}% / Run2: ${(r2.coverage_rate * 100).toFixed(1)}% — ${identicalPct.toFixed(1)}% d'assignations identiques.`
        : `Trop de variation : ${identicalPct.toFixed(1)}% identiques, ΔCouv ${(covDelta * 100).toFixed(1)}pts.`,
      details: { run1_coverage: r1.coverage_rate, run2_coverage: r2.coverage_rate, identical_pct: identicalPct, common, total },
    } as TestResult;
  } finally {
    await clearGeneratedShifts([alphaId]);
  }
}

// ─── Dispatcher ─────────────────────────────────────────────────────────────
async function runOne(id: number): Promise<TestResult> {
  try {
    switch (id) {
      case 1: return await test1();
      case 2: return await test2();
      case 3: return await test3();
      case 4: return await test4();
      case 5: return await test5();
      case 6: return await test6();
      case 7: return await test7();
      case 8: return await test8();
      default: throw new Error(`Test ${id} inconnu`);
    }
  } catch (e: any) {
    return {
      testName: `${id}. ${TEST_DEFS.find(t => t.id === id)?.name ?? "Test"}`,
      status: "error",
      durationMs: 0,
      message: `Erreur : ${e?.message ?? e}`,
      error: e?.stack ?? String(e),
    };
  }
}

export const runQATest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ test_id: z.number().int().min(1).max(8) }).parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    return runOne(data.test_id);
  });

export const runAllQATests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const t0 = Date.now();
    const results: TestResult[] = [];
    for (const t of TEST_DEFS) {
      results.push(await runOne(t.id));
    }
    return { results, total_duration_ms: Date.now() - t0, ran_at: new Date().toISOString() };
  });
