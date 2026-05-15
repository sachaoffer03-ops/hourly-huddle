import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Réservé aux administrateurs");
}

const studioInput = z.object({
  name: z.string().trim().min(1).max(120),
  short_name: z.string().trim().min(1).max(60),
  address: z.string().trim().max(255).optional().nullable(),
  manager_id: z.string().uuid().nullable().optional(),
  has_kitchen: z.boolean().optional().default(false),
});

export const listStudiosAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: studios, error } = await supabaseAdmin
      .from("studios")
      .select("id,name,short_name,address,manager_id,has_kitchen,deleted_at")
      .is("deleted_at", null as any)
      .order("name");
    if (error) throw new Error(error.message);

    const ids = (studios ?? []).map((s) => s.id);
    const managerIds = Array.from(
      new Set((studios ?? []).map((s) => s.manager_id).filter(Boolean) as string[]),
    );

    const [{ data: counts }, { data: managers }] = await Promise.all([
      ids.length
        ? supabaseAdmin
            .from("profiles")
            .select("studio_id")
            .in("studio_id", ids)
            .eq("status", "active")
        : Promise.resolve({ data: [] as any[] }),
      managerIds.length
        ? supabaseAdmin
            .from("profiles")
            .select("id,first_name,last_name")
            .in("id", managerIds)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const countByStudio: Record<string, number> = {};
    (counts ?? []).forEach((p: any) => {
      if (p.studio_id) countByStudio[p.studio_id] = (countByStudio[p.studio_id] ?? 0) + 1;
    });
    const managerById: Record<string, { first_name: string; last_name: string }> = {};
    (managers ?? []).forEach((m: any) => (managerById[m.id] = m));

    return (studios ?? []).map((s) => ({
      ...s,
      employee_count: countByStudio[s.id] ?? 0,
      manager: s.manager_id ? managerById[s.manager_id] ?? null : null,
    }));
  });

export const listAdminCandidates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const ids = (roles ?? []).map((r: any) => r.user_id);
    if (!ids.length) return [];
    const { data: profs } = await supabaseAdmin
      .from("profiles")
      .select("id,first_name,last_name,email")
      .in("id", ids)
      .order("first_name");
    return profs ?? [];
  });

export const createStudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => studioInput.parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: row, error } = await supabaseAdmin
      .from("studios")
      .insert({
        name: data.name,
        short_name: data.short_name,
        address: data.address ?? null,
        manager_id: data.manager_id ?? null,
        has_kitchen: !!data.has_kitchen,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const updateStudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ id: z.string().uuid(), patch: studioInput.partial() }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await supabaseAdmin
      .from("studios")
      .update(data.patch as any)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteStudio = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: blockers, error: bErr } = await supabaseAdmin.rpc(
      "studio_blockers" as any,
      { _studio_id: data.id },
    );
    if (bErr) throw new Error(bErr.message);
    const b = (blockers ?? {}) as Record<string, number>;
    const blocking = ["shifts", "staffing_templates", "profiles", "user_studios"]
      .filter((k) => Number(b[k] ?? 0) > 0);
    if (blocking.length) {
      const labels: Record<string, string> = {
        shifts: "shifts existants",
        staffing_templates: "templates de staffing",
        profiles: "profils rattachés",
        user_studios: "employés rattachés",
      };
      throw new Error(
        `Impossible de supprimer ce studio : ${blocking.map((k) => `${b[k]} ${labels[k]}`).join(", ")}.`,
      );
    }
    // Soft delete
    const { error } = await supabaseAdmin
      .from("studios")
      .update({ deleted_at: new Date().toISOString() } as any)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
