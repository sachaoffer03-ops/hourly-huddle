import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Input = z.object({
  userId: z.string().uuid(),
});

/**
 * Régénère un lien d'accès individuel pour un employé.
 * - Si l'utilisateur a déjà un compte auth : génère un lien de récupération
 *   (type recovery) qui le connecte une fois et lui permet de définir un
 *   nouveau mot de passe.
 * - Le lien est unique, valide une seule fois, et fonctionne partout
 *   (WhatsApp, mail, SMS).
 */
export const regenerateEmployeeAccessLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId: callerId } = context;

    // Vérifier admin
    const { data: roleRow } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) throw new Error("Réservé aux administrateurs");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Récupérer l'email de l'employé
    const { data: profile, error: pErr } = await supabaseAdmin
      .from("profiles")
      .select("id, email, first_name")
      .eq("id", data.userId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!profile?.email) throw new Error("Employé introuvable ou sans email");

    const redirectTo = "https://app.shyft.flashsite.fr/reset-password";

    const { data: linkData, error: linkErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: profile.email,
      options: { redirectTo },
    });
    if (linkErr) throw new Error(linkErr.message);

    const url = linkData?.properties?.action_link;
    if (!url) throw new Error("Impossible de générer le lien");

    return { url, email: profile.email, first_name: profile.first_name ?? "" };
  });
