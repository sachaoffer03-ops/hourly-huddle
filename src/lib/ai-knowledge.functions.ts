import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Réservé aux administrateurs");
}

export const listKnowledgeEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("ai_knowledge_entries")
      .select("id, title, content, category, tags, priority, is_active, author_id, created_at, updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { entries: data ?? [] };
  });

const UpsertSchema = z.object({
  id: z.string().uuid().optional(),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(20000),
  category: z.string().min(1).max(60),
  tags: z.array(z.string().min(1).max(40)).max(20).default([]),
  priority: z.number().int().min(0).max(100).default(0),
  is_active: z.boolean().default(true),
});

export const upsertKnowledgeEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => UpsertSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    if (data.id) {
      const { data: row, error } = await supabaseAdmin
        .from("ai_knowledge_entries")
        .update({
          title: data.title,
          content: data.content,
          category: data.category,
          tags: data.tags,
          priority: data.priority,
          is_active: data.is_active,
        })
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return { entry: row };
    }

    const { data: row, error } = await supabaseAdmin
      .from("ai_knowledge_entries")
      .insert({
        title: data.title,
        content: data.content,
        category: data.category,
        tags: data.tags,
        priority: data.priority,
        is_active: data.is_active,
        author_id: userId,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return { entry: row };
  });

export const toggleKnowledgeEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("ai_knowledge_entries")
      .update({ is_active: data.is_active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteKnowledgeEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await assertAdmin(supabase, userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("ai_knowledge_entries").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const KNOWLEDGE_CATEGORIES = [
  { value: "planning", label: "Planning & shifts" },
  { value: "dispos", label: "Disponibilités" },
  { value: "pointage", label: "Pointage & checklists" },
  { value: "scoring", label: "Scoring & évaluations" },
  { value: "formations", label: "Formations" },
  { value: "contrats", label: "Contrats & paie" },
  { value: "procedures", label: "Procédures studio" },
  { value: "produits", label: "Produits & menu" },
  { value: "clients", label: "Relation client" },
  { value: "faq", label: "FAQ employés" },
  { value: "general", label: "Général" },
] as const;
