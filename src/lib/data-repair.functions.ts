import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const linkAllEmployeesToAllStudios = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context;
    const { data: roleCheck } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleCheck) throw new Error("Admin uniquement");

    const { data: studios } = await supabaseAdmin.from("studios").select("id, name");
    const { data: adminRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");
    const adminIds = new Set((adminRoles ?? []).map((r: any) => r.user_id));
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("status", "active");
    const employees = (profiles ?? []).filter((p: any) => !adminIds.has(p.id));

    let added = 0;
    for (const emp of employees) {
      const { data: existing } = await supabaseAdmin
        .from("user_studios")
        .select("studio_id")
        .eq("user_id", emp.id);
      const existingSet = new Set((existing ?? []).map((r: any) => r.studio_id));
      const missing = (studios ?? []).filter((s: any) => !existingSet.has(s.id));
      if (missing.length > 0) {
        await supabaseAdmin
          .from("user_studios")
          .insert(missing.map((s: any) => ({ user_id: emp.id, studio_id: s.id })));
        added += missing.length;
      }
    }
    return { employees: employees.length, links_added: added, studios: (studios ?? []).length };
  });
