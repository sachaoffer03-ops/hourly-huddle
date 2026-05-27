import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  first_name: z.string().min(1).max(80),
  last_name: z.string().min(1).max(80),
  phone: z.string().max(40).nullable().optional(),
  birth_date: z.string().max(20).nullable().optional(),
  nationality: z.string().max(80).nullable().optional(),
  city: z.string().max(120).nullable().optional(),
  address: z.string().max(255).nullable().optional(),
  niss: z.string().max(40).nullable().optional(),
  iban: z.string().max(50).nullable().optional(),
  emergency_contact_name: z.string().max(120).nullable().optional(),
  emergency_contact_phone: z.string().max(40).nullable().optional(),
  emergency_contact_relation: z.string().max(80).nullable().optional(),
  avatar_url: z.string().max(1000).nullable().optional(),
});

export const updateOwnProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const patch: Record<string, unknown> = {
      first_name: data.first_name.trim(),
      last_name: data.last_name.trim(),
      phone: data.phone ?? null,
      birth_date: data.birth_date || null,
      nationality: data.nationality ?? null,
      city: data.city ?? null,
      address: data.address ?? null,
      niss: data.niss ?? null,
      iban: data.iban ?? null,
      emergency_contact_name: data.emergency_contact_name ?? null,
      emergency_contact_phone: data.emergency_contact_phone ?? null,
      emergency_contact_relation: data.emergency_contact_relation ?? null,
    };
    if (data.avatar_url !== undefined) patch.avatar_url = data.avatar_url;

    const { error } = await supabaseAdmin
      .from("profiles")
      .update(patch as any)
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
