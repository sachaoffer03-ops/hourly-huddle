// Migration des studios doublons vers les vrais studios.
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles").select("role")
    .eq("user_id", userId).eq("role", "admin").maybeSingle();
  if (!data) throw new Error("Réservé aux administrateurs");
}

type StudioInfo = {
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
  // On considère "vrai" tout studio dont le nom commence par "Skult".
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
    return {
      studios,
      pairs: pairs.map(p => ({ src: p.src, dst: p.dst })),
    };
  });

export const executeStudioMigration = createServerFn({ method: "POST" })
  .inputValidator((d: { pairs: Array<{ src_id: string; dst_id: string }> }) => d)
  .middleware([requireSupabaseAuth])
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    if (!data.pairs?.length) throw new Error("Aucune paire à migrer");

    const results: Array<{ src_id: string; dst_id: string; stats: any }> = [];
    for (const p of data.pairs) {
      const { data: stats, error } = await supabaseAdmin.rpc("merge_studio" as any, {
        src_id: p.src_id, dst_id: p.dst_id,
      });
      if (error) throw new Error(`merge ${p.src_id}→${p.dst_id}: ${error.message}`);
      console.log(`[migrate-studios] ${p.src_id} → ${p.dst_id}`, stats);
      results.push({ src_id: p.src_id, dst_id: p.dst_id, stats });
    }

    const finalStudios = await loadStudios();
    return { results, finalStudios };
  });
