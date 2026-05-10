import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Check, ArrowRight, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/activation")({
  component: ActivationPage,
  validateSearch: (s: Record<string, unknown>) => ({ token: (s.token as string) || "" }),
  head: () => ({ meta: [{ title: "Activation du compte — Kadence" }] }),
});

interface Invitation {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  studio_id: string | null;
  contract: string | null;
  status: string;
  expires_at: string;
}

function ActivationPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Step 1
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  // Step 2
  const [phone, setPhone] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [nationality, setNationality] = useState("");
  const [city, setCity] = useState("");
  const [address, setAddress] = useState("");
  // Step 3
  const [niss, setNiss] = useState("");
  const [iban, setIban] = useState("");
  const [emName, setEmName] = useState("");
  const [emPhone, setEmPhone] = useState("");
  const [emRel, setEmRel] = useState("");
  const [studentValid, setStudentValid] = useState(false);
  const [accept, setAccept] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Aucun token fourni");
      setLoading(false);
      return;
    }
    (async () => {
      const { data, error } = await supabase
        .from("invitations")
        .select("id, email, first_name, last_name, phone, studio_id, contract, status, expires_at")
        .eq("token", token)
        .maybeSingle();
      if (error || !data) {
        setError("Invitation introuvable");
      } else if (data.status !== "pending") {
        setError("Cette invitation a déjà été utilisée ou révoquée");
      } else if (new Date(data.expires_at) < new Date()) {
        setError("Cette invitation a expiré. Demandez-en une nouvelle à votre administrateur.");
      } else {
        setInvitation(data);
        if (data.phone) setPhone(data.phone);
      }
      setLoading(false);
    })();
  }, [token]);

  const validateStep1 = () => {
    if (password.length < 8) return toast.error("Mot de passe : 8 caractères minimum");
    if (password !== confirm) return toast.error("Les mots de passe ne correspondent pas");
    setStep(2);
  };
  const validateStep2 = () => {
    if (!phone || !birthDate || !nationality || !city || !address) return toast.error("Tous les champs sont requis");
    setStep(3);
  };

  const handleSubmit = async () => {
    if (!invitation) return;
    if (!niss || !iban || !emName || !emPhone || !emRel) return toast.error("Tous les champs RH sont requis");
    if (invitation.contract === "Étudiant" && !studentValid) return toast.error("Cochez la validité de la carte étudiant");
    if (!accept) return toast.error("Vous devez accepter les conditions");

    setSubmitting(true);

    // Sign up — handle_new_user trigger creates the profile from invitation
    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: invitation.email,
      password,
      options: {
        data: { invitation_token: token, first_name: invitation.first_name, last_name: invitation.last_name },
        emailRedirectTo: `${window.location.origin}/staff-app`,
      },
    });

    if (signUpError) {
      setSubmitting(false);
      return toast.error(signUpError.message);
    }

    // Wait briefly for trigger, then update profile with collected info
    await new Promise((r) => setTimeout(r, 500));

    const userId = signUpData.user?.id;
    if (userId) {
      await supabase.from("profiles").update({
        phone, birth_date: birthDate, nationality, city, address,
        niss, iban,
        emergency_contact_name: emName,
        emergency_contact_phone: emPhone,
        emergency_contact_relation: emRel,
        student_card_valid: studentValid,
      }).eq("id", userId);
    }

    setSubmitting(false);
    toast.success("Bienvenue chez Skult Studios !");
    navigate({ to: "/staff-app" });
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: "var(--background)" }}>
      <p style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Chargement...</p>
    </div>;
  }

  if (error || !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "var(--background)" }}>
        <div className="max-w-md text-center">
          <h1 style={{ fontSize: 22, fontWeight: 500 }}>Lien invalide</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 8 }}>{error}</p>
        </div>
      </div>
    );
  }

  const inputCls = "mt-1 w-full rounded-md border px-3 py-2 outline-none";
  const inputStyle = { fontSize: 14, borderColor: "var(--border)", backgroundColor: "var(--background)" };
  const labelStyle = { fontSize: 12, fontWeight: 500 as const, color: "var(--muted-foreground)" };

  return (
    <div className="min-h-screen px-4 py-10" style={{ backgroundColor: "var(--background)" }}>
      <div className="max-w-xl mx-auto">
        <div className="mb-6 text-center">
          <h1 style={{ fontSize: 26, fontWeight: 500, letterSpacing: "-0.01em" }}>Bienvenue {invitation.first_name}</h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 6 }}>
            Activation de votre compte Skult Studios — étape {step}/3
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{
                backgroundColor: step >= s ? "var(--primary)" : "var(--muted)",
                color: step >= s ? "var(--primary-foreground)" : "var(--muted-foreground)",
                fontSize: 12, fontWeight: 500,
              }}>
                {step > s ? <Check size={14} /> : s}
              </div>
              {s < 3 && <div className="w-12 h-px mx-1" style={{ backgroundColor: step > s ? "var(--primary)" : "var(--border)" }} />}
            </div>
          ))}
        </div>

        <div className="rounded-lg border p-6" style={{ backgroundColor: "var(--card)", borderColor: "var(--border)" }}>
          {step === 1 && (
            <div className="space-y-4">
              <h2 style={{ fontSize: 16, fontWeight: 500 }}>Créer votre mot de passe</h2>
              <div>
                <label style={labelStyle}>Email</label>
                <input type="email" disabled value={invitation.email} className={inputCls} style={{ ...inputStyle, opacity: 0.6 }} />
              </div>
              <div>
                <label style={labelStyle}>Mot de passe (8 caractères min)</label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Confirmer</label>
                <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} style={inputStyle} />
              </div>
              <button onClick={validateStep1} className="w-full rounded-md py-2.5 inline-flex items-center justify-center gap-2"
                style={{ fontSize: 14, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
                Continuer <ArrowRight size={14} />
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h2 style={{ fontSize: 16, fontWeight: 500 }}>Identité</h2>
              <div className="grid grid-cols-2 gap-4">
                <div><label style={labelStyle}>Téléphone</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} style={inputStyle} /></div>
                <div><label style={labelStyle}>Date de naissance</label>
                  <input type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} className={inputCls} style={inputStyle} /></div>
                <div><label style={labelStyle}>Nationalité</label>
                  <input value={nationality} onChange={(e) => setNationality(e.target.value)} className={inputCls} style={inputStyle} /></div>
                <div><label style={labelStyle}>Ville</label>
                  <input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} style={inputStyle} /></div>
              </div>
              <div><label style={labelStyle}>Adresse complète</label>
                <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} style={inputStyle} /></div>
              <div className="flex gap-2">
                <button onClick={() => setStep(1)} className="flex-1 rounded-md border py-2.5 inline-flex items-center justify-center gap-2"
                  style={{ fontSize: 14, fontWeight: 500, borderColor: "var(--border)" }}>
                  <ArrowLeft size={14} /> Retour
                </button>
                <button onClick={validateStep2} className="flex-1 rounded-md py-2.5 inline-flex items-center justify-center gap-2"
                  style={{ fontSize: 14, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
                  Continuer <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h2 style={{ fontSize: 16, fontWeight: 500 }}>Conformité RH</h2>
              <p style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                Informations nécessaires pour la déclaration Dimona et le paiement de votre salaire.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div><label style={labelStyle}>Numéro NISS</label>
                  <input value={niss} onChange={(e) => setNiss(e.target.value)} placeholder="00.00.00-000.00" className={inputCls} style={inputStyle} /></div>
                <div><label style={labelStyle}>IBAN</label>
                  <input value={iban} onChange={(e) => setIban(e.target.value)} placeholder="BE00 0000 0000 0000" className={inputCls} style={inputStyle} /></div>
              </div>
              <div className="pt-2">
                <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 8 }}>Contact d'urgence</p>
                <div className="grid grid-cols-3 gap-3">
                  <div><label style={labelStyle}>Nom</label>
                    <input value={emName} onChange={(e) => setEmName(e.target.value)} className={inputCls} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Téléphone</label>
                    <input value={emPhone} onChange={(e) => setEmPhone(e.target.value)} className={inputCls} style={inputStyle} /></div>
                  <div><label style={labelStyle}>Lien</label>
                    <input value={emRel} onChange={(e) => setEmRel(e.target.value)} placeholder="parent, conjoint..." className={inputCls} style={inputStyle} /></div>
                </div>
              </div>
              {invitation.contract === "Étudiant" && (
                <label className="flex items-center gap-2 pt-2">
                  <input type="checkbox" checked={studentValid} onChange={(e) => setStudentValid(e.target.checked)} />
                  <span style={{ fontSize: 13 }}>Ma carte étudiant est valide pour l'année en cours</span>
                </label>
              )}
              <label className="flex items-start gap-2 pt-2">
                <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-1" />
                <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                  J'accepte que ces informations soient utilisées pour la gestion de mon contrat et la déclaration aux organismes sociaux.
                </span>
              </label>
              <div className="flex gap-2 pt-2">
                <button onClick={() => setStep(2)} className="flex-1 rounded-md border py-2.5 inline-flex items-center justify-center gap-2"
                  style={{ fontSize: 14, fontWeight: 500, borderColor: "var(--border)" }}>
                  <ArrowLeft size={14} /> Retour
                </button>
                <button onClick={handleSubmit} disabled={submitting} className="flex-1 rounded-md py-2.5 disabled:opacity-50"
                  style={{ fontSize: 14, fontWeight: 500, backgroundColor: "var(--foreground)", color: "var(--card)" }}>
                  {submitting ? "Activation..." : "Activer mon compte"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
