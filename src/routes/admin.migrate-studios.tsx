import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { previewStudioMigration, executeStudioMigration } from "@/lib/migrate-studios.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";

export const Route = createFileRoute("/admin/migrate-studios")({
  component: MigrateStudiosPage,
});

function MigrateStudiosPage() {
  const preview = useServerFn(previewStudioMigration);
  const execute = useServerFn(executeStudioMigration);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [data, setData] = useState<Awaited<ReturnType<typeof preview>> | null>(null);
  const [result, setResult] = useState<Awaited<ReturnType<typeof execute>> | null>(null);

  async function load() {
    setLoading(true);
    try { setData(await preview({})); }
    catch (e: any) { toast.error(e.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  async function run() {
    if (!data?.pairs.length) return;
    if (!confirm("Cela va déplacer toutes les données des studios doublons vers les vrais studios, puis supprimer les doublons. Continuer ?")) return;
    setRunning(true);
    try {
      const res = await execute({ data: { pairs: data.pairs.map(p => ({ src_id: p.src.id, dst_id: p.dst.id })) } });
      setResult(res);
      toast.success("Migration terminée");
    } catch (e: any) { toast.error(e.message); }
    finally { setRunning(false); }
  }

  if (loading) return <div className="p-6">Chargement…</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-medium">Migration des studios</h1>
        <Button variant="outline" onClick={load} disabled={running}>Recharger</Button>
      </div>

      <Card className="p-4">
        <h2 className="font-medium mb-3">Studios actuels</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-muted-foreground">
            <tr><th className="py-1">Nom</th><th>Templates</th><th>Employés</th><th>Shifts</th><th>Profils</th><th>ID</th></tr>
          </thead>
          <tbody>
            {data?.studios.map(s => (
              <tr key={s.id} className="border-t">
                <td className="py-1">{s.name}</td>
                <td>{s.staffing_templates}</td>
                <td>{s.user_studios}</td>
                <td>{s.shifts}</td>
                <td>{s.profiles}</td>
                <td className="text-xs text-muted-foreground font-mono">{s.id.slice(0, 8)}…</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card className="p-4">
        <h2 className="font-medium mb-3">Paires détectées (doublon → vrai)</h2>
        {data?.pairs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun doublon détecté.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {data?.pairs.map(p => (
              <li key={p.src.id} className="flex items-center gap-3">
                <span className="px-2 py-0.5 rounded bg-destructive/10 text-destructive">{p.src.name}</span>
                <span>→</span>
                <span className="px-2 py-0.5 rounded bg-primary/10">{p.dst.name}</span>
                <span className="text-muted-foreground">
                  ({p.src.staffing_templates} templates, {p.src.user_studios} liens employés, {p.src.shifts} shifts, {p.src.profiles} profils à migrer)
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="flex gap-2">
        <Button onClick={run} disabled={running || !data?.pairs.length}>
          {running ? "Migration en cours…" : "Lancer la migration"}
        </Button>
        <Link to="/admin/seeder"><Button variant="outline">Retour au seeder</Button></Link>
      </div>

      {result && (
        <Card className="p-4 space-y-3 border-primary">
          <h2 className="font-medium">Résultat</h2>
          {result.results.map(r => (
            <div key={r.src_id} className="text-sm">
              <div className="font-medium">{r.src_id.slice(0, 8)}… → {r.dst_id.slice(0, 8)}…</div>
              <pre className="text-xs bg-muted p-2 rounded mt-1">{JSON.stringify(r.stats, null, 2)}</pre>
            </div>
          ))}
          <div>
            <h3 className="font-medium mb-1">État final</h3>
            <ul className="text-sm space-y-1">
              {result.finalStudios.map(s => (
                <li key={s.id}>
                  <span className="font-medium">{s.name}</span>{" "}
                  <span className="text-muted-foreground text-xs">({s.id})</span>{" "}
                  — {s.staffing_templates} templates, {s.user_studios} employés, {s.shifts} shifts
                </li>
              ))}
            </ul>
          </div>
          <Link to="/planning/generate"><Button>Aller à la génération de planning</Button></Link>
        </Card>
      )}
    </div>
  );
}
