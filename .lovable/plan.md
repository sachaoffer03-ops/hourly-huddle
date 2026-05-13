## Objectif

Tout ce qui est aujourd'hui hardcodé (rôles métier, couleurs de rôle, listes "Barista/Accueil/Host/Cuisine") devient éditable par l'admin via l'UI Réglages. Le client final pourra ajouter "Bar", "Plonge", "Manager du soir"… sans toi.

## 1. Migration DB — table `business_roles` éditable

Créer `public.business_roles` :
- `id uuid pk`, `name text unique not null`, `color text not null` (hex ou token), `position smallint`, `is_active boolean default true`, `created_at`, `updated_at`
- RLS : SELECT pour tous authentifiés, ALL pour admins
- Seed avec les 4 valeurs actuelles + couleurs actuelles (coral/teal/purple/pink)

**Migration des colonnes existantes** (le point délicat) :
- `shifts.business_role`, `staffing_templates.business_role`, `user_business_roles.role`, `checklist_templates.business_role`, `formations.required_role`, `training_paths.required_role`, `invitations.business_roles[]`
- Tous passent de `ENUM business_role` → `TEXT` avec FK logique sur `business_roles.name` (pas FK stricte pour éviter de casser l'historique si l'admin renomme — on validera côté app)
- Drop de l'ENUM `business_role` à la fin
- Recréation de `handle_new_user()` (qui boucle sur `business_role[]`) en version `text[]`

## 2. Hook partagé `useBusinessRoles()`

Un hook qui :
- Charge `business_roles` une fois (cache via React Query déjà présent ou state global léger)
- Expose `roles: {name, color}[]`, `roleColor(name): string`, `isLoading`
- Realtime optionnel pour que les changements se reflètent immédiatement

Remplace tous les `const ROLES = ["Barista","Accueil","Host","Cuisine"]` éparpillés dans :
- `StaffingTemplatesEditor.tsx`, `shifts.functions.ts` (z.enum → z.string + check via DB), `generate-planning.functions.ts`, `CreateShiftModal.tsx`, `InviteEmployeeModal.tsx`, `planning.tsx` (color map), `staff.*.tsx`, `studios.tsx`, `dashboard.tsx`, `formation.tsx`, `checklists.tsx`, `mock-data.ts`, `staff-helpers.ts`.

## 3. UI admin dans Réglages

Nouvel onglet "Rôles métier" dans `/reglages` :
- Liste éditable (nom + color picker + position drag-handle + toggle actif)
- Bouton "Ajouter un rôle"
- Suppression bloquée si le rôle est utilisé par un shift/employé (warning + désactivation à la place)

## 4. Couleurs de rôle = data-driven

- Plus de map `{ Barista: "#F0997B", … }` en dur
- `roleColor(name)` lit `business_roles.color`
- Le seed initialise avec les couleurs actuelles → zéro régression visuelle
- Mémoire `mem://design/tokens` : on garde les couleurs comme valeurs par défaut au seed, mais on note qu'elles sont désormais en DB

## 5. Studios — déjà OK mais on vérifie

`studios` a déjà `name` + `color` en DB. Audit rapide pour s'assurer qu'aucun composant n'utilise `studio.name === "Châtelain"` pour piocher une couleur (si oui → utiliser `studio.color`).

## 6. Pagination Supabase `.range()`

Helper utilitaire `fetchAllPaginated(query, batchSize=1000)` qui boucle `.range(offset, offset+999)` jusqu'à recevoir < batchSize lignes. Appliqué dans :
- `generate-planning.functions.ts` (load availabilities, shifts existants, profiles)
- `publishPlanning` (load drafts)
- Toute query qui peut dépasser 1000 sur longue période

## Détails techniques

```sql
-- Nouvelle table
create table public.business_roles (
  id uuid pk default gen_random_uuid(),
  name text not null unique,
  color text not null default '#888888',
  position smallint not null default 0,
  is_active boolean not null default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Migration colonne (exemple shifts)
alter table shifts add column business_role_new text;
update shifts set business_role_new = business_role::text;
alter table shifts drop column business_role;
alter table shifts rename column business_role_new to business_role;
alter table shifts alter column business_role set not null;
-- idem pour les 6 autres tables
drop type business_role;
```

```ts
// helper pagination
export async function fetchAll<T>(builder: any, batch = 1000): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += batch) {
    const { data, error } = await builder.range(from, from + batch - 1);
    if (error) throw new Error(error.message);
    if (!data?.length) break;
    out.push(...data);
    if (data.length < batch) break;
  }
  return out;
}
```

## Ordre d'exécution

1. Migration DB (table + colonnes + drop enum + recréation `handle_new_user`)
2. Hook `useBusinessRoles` + `roleColor` helper
3. Refacto fichiers (par lots : settings → planning → staff → autres)
4. Onglet "Rôles métier" dans Réglages
5. Pagination dans generate-planning
6. Update mémoire projet

## Risques & mitigations

- **Drop ENUM** : si une vue/fonction stockée s'appuie dessus → migration échoue. On vérifiera avant.
- **Renommer un rôle utilisé** : on autorise mais on UPDATE en cascade dans toutes les tables (transaction côté server fn).
- **Suppression d'un rôle utilisé** : bloquée, on propose "désactiver" à la place (`is_active=false` → caché des dropdowns mais shifts historiques préservés).
