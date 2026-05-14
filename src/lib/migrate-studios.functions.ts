// Migration v2 : nettoyage radical + bascule des doublons vers les vrais studios.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role")
    .eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Réservé aux administrateurs");
}

export type StudioInfo = {
  id: string; name: string;
  staffing_templates: number;
  user_studios: number;
  shifts: number;
  profiles: number;
};

function normalize(s: string) {
  return s.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/^skult\s+/i, "")
    .replace(/s$/, "")
    .trim();
}

async function loadStudios(): Promise<StudioInfo[]> {
  const { data: studios } = await supabaseAdmin.from("studios").select("id, name").order("name");
  const out: StudioInfo[] = [];
  for (const s of studios ?? []) {
    const [st, us, sh, pr] = await Promise.all([
      supabaseAdmin.from("staffing_templates").select("id", { count: "exact", head: true }).eq("studio_id", s.id),
      supabaseAdmin.from("user_studios").select("user_id", { count: "exact", head: true }).eq("studio_id", s.id),
      supabaseAdmin.from("shifts").select("id", { count: "exact", head: true }).eq("studio_id", s.id),
      supabaseAdmin.from("profiles").select("id", { count: "exact", head: true }).eq("studio_id", s.id),
    ]);
    out.push({
      id: s.id, name: s.name,
      staffing_templates: st.count ?? 0,
      user_studios: us.count ?? 0,
      shifts: sh.count ?? 0,
      profiles: pr.count ?? 0,
    });
  }
  return out;
}

function autoMatchPairs(studios: StudioInfo[]) {
  const reals = studios.filter(s => /^skult\b/i.test(s.name));
  const others = studios.filter(s => !/^skult\b/i.test(s.name));
  const pairs: Array<{ src: StudioInfo; dst: StudioInfo }> = [];
  for (const dup of others) {
    const key = normalize(dup.name);
    const match = reals.find(r => normalize(r.name) === key);
    if (match) pairs.push({ src: dup, dst: match });
  }
  return pairs;
}

export const previewStudioMigration = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const studios = await loadStudios();
    const pairs = autoMatchPairs(studios);

    // Compteurs prévisionnels pour le bandeau de stratégie
    const totalShifts = studios.reduce((a, s) => a + s.shifts, 0);
    const oldTemplatesOnReal = studios
      .filter(s => /^skult\b/i.test(s.name))
      .reduce((a, s) => a + s.staffing_templates, 0);
    const newTemplatesToMove = pairs.reduce((a, p) => a + p.src.staffing_templates, 0);
    const employeesToMove = pairs.reduce((a, p) => a + p.src.user_studios, 0);
    const profilesToMove = pairs.reduce((a, p) => a + p.src.profiles, 0);

    return {
      studios,
      pairs: pairs.map(p => ({ src: p.src, dst: p.dst })),
      preview: { totalShifts, oldTemplatesOnReal, newTemplatesToMove, employeesToMove, profilesToMove },
    };
  });

export const executeStudioMigration = createServerFn({ method: "POST" })
  .inputValidator((d: { pairs: Array<{ src_id: string; dst_id: string }> }) => d)
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    if (!data.pairs?.length) throw new Error("Aucune paire à migrer");

    console.log("[migrate-studios v2] start", data.pairs);

    const { data: report, error } = await supabaseAdmin.rpc(
      "migrate_studios_v2" as any,
      { pairs: data.pairs as any },
    );
    if (error) {
      console.error("[migrate-studios v2] failed", error);
      throw new Error(error.message);
    }

    console.log("[migrate-studios v2] success", report);
    const finalStudios = await loadStudios();
    return { report, finalStudios };
  });
