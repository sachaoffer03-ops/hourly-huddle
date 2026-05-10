import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  component: LoginPage,
  head: () => ({ meta: [{ title: "Connexion — Kadence" }] }),
});

function LoginPage() {
  const navigate = useNavigate();
  const { session, appRole, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"login" | "forgot" | "signup">("login");

  useEffect(() => {
    if (!authLoading && session && appRole) {
      const target = appRole === "employee" ? "/staff-app" : "/dashboard";
      navigate({ to: target });
    }
  }, [authLoading, session, appRole, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      toast.error(error.message === "Invalid login credentials" ? "Email ou mot de passe incorrect" : error.message);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Email de réinitialisation envoyé");
      setMode("login");
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) return toast.error("Mot de passe : 8 caractères minimum");
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { first_name: firstName, last_name: lastName }, emailRedirectTo: `${window.location.origin}/dashboard` },
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success("Compte créé. Connexion...");
  };

  const onSubmit =
    mode === "login" ? handleLogin :
    mode === "forgot" ? handleForgot :
    handleSignup;

  const titles = {
    login: { title: "Connexion", sub: "Connectez-vous à votre compte" },
    forgot: { title: "Mot de passe oublié", sub: "Entrez votre email pour recevoir un lien" },
    signup: { title: "Créer le compte admin", sub: "Réservé au tout premier compte de l'entreprise" },
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "var(--background)" }}>
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 style={{ fontSize: 28, fontWeight: 500, letterSpacing: "-0.01em" }}>Kadence</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 6 }}>Skult Studios</p>
        </div>

        <div className="rounded-lg border p-6" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          <h2 style={{ fontSize: 18, fontWeight: 500, marginBottom: 4 }}>{titles[mode].title}</h2>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginBottom: 20 }}>{titles[mode].sub}</p>

          <form onSubmit={onSubmit} className="space-y-4">
            {mode === "signup" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)" }}>Prénom</label>
                  <input required value={firstName} onChange={(e) => setFirstName(e.target.value)}
                    className="mt-1 w-full rounded-md border px-3 py-2 outline-none"
                    style={{ fontSize: 14, borderColor: "var(--border)", backgroundColor: "var(--background)" }} />
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)" }}>Nom</label>
                  <input required value={lastName} onChange={(e) => setLastName(e.target.value)}
                    className="mt-1 w-full rounded-md border px-3 py-2 outline-none"
                    style={{ fontSize: 14, borderColor: "var(--border)", backgroundColor: "var(--background)" }} />
                </div>
              </div>
            )}

            <div>
              <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)" }}>Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                className="mt-1 w-full rounded-md border px-3 py-2 outline-none"
                style={{ fontSize: 14, borderColor: "var(--border)", backgroundColor: "var(--background)" }} />
            </div>

            {mode !== "forgot" && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)" }}>Mot de passe</label>
                <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-md border px-3 py-2 outline-none"
                  style={{ fontSize: 14, borderColor: "var(--border)", backgroundColor: "var(--background)" }} />
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full rounded-md py-2.5 disabled:opacity-50"
              style={{ fontSize: 14, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
              {loading ? "..." : mode === "login" ? "Se connecter" : mode === "forgot" ? "Envoyer le lien" : "Créer le compte"}
            </button>

            <div className="flex flex-col items-center gap-1.5 pt-2">
              {mode === "login" && (
                <>
                  <button type="button" onClick={() => setMode("forgot")}
                    style={{ fontSize: 12, color: "var(--muted-foreground)", textDecoration: "underline" }}>
                    Mot de passe oublié ?
                  </button>
                  <button type="button" onClick={() => setMode("signup")}
                    style={{ fontSize: 12, color: "var(--muted-foreground)", textDecoration: "underline" }}>
                    Créer le compte admin (premier usage)
                  </button>
                </>
              )}
              {mode !== "login" && (
                <button type="button" onClick={() => setMode("login")}
                  style={{ fontSize: 12, color: "var(--muted-foreground)", textDecoration: "underline" }}>
                  Retour à la connexion
                </button>
              )}
            </div>
          </form>
        </div>

        <p className="text-center mt-4" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
          Les employés reçoivent une invitation par email pour activer leur compte.
        </p>
      </div>
    </div>
  );
}
