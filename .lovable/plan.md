## État actuel constaté

**Bonne nouvelle** : 
- `StaffingTemplatesEditor` (onglet Besoins en staff) est **déjà DB-backed** — il fait un lookup `studios.name → id` puis lit/écrit `staffing_templates`. Rien à faire ici.
- `Studio` est déjà `type Studio = string` (pas une union stricte), ce qui évite une cascade de typecheck.

**Ce qui reste hardcodé** dans `src/routes/studios.tsx` (2095 lignes) :
1. `baseStudioTabs = ["Skult Rhodes", "Skult Châtelain"]` — liste de tabs (devrait venir de `studios`).
2. `initialInfos` — adresses, téléphones, manager, capacité, surface, ouverture, notes (state-local).
3. `initialWeek` — horaires d'ouverture par jour (state-local).
4. `initialRoleHours` — horaires par rôle (state-local).
5. `initialActive` + `customRoles` — rôles actifs par studio (state-local).
6. `initialNeeds` — non utilisé visuellement (StaffingTemplatesEditor a remplacé) mais toujours dans le state.
7. `ExceptionsTab` — mock `studioExceptions` de mock-data.ts.
8. Création / suppression studio = pur state-local (rien en DB).

## Migrations SQL nécessaires

### A. Compléter `studios` 
```
ALTER TABLE studios ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE studios ADD COLUMN IF NOT EXISTS surface_m2 integer;
ALTER TABLE studios ADD COLUMN IF NOT EXISTS opened_at date;
ALTER TABLE studios ADD COLUMN IF NOT EXISTS internal_notes text;
ALTER TABLE studios ADD COLUMN IF NOT EXISTS opening_hours jsonb DEFAULT '[]'::jsonb;
ALTER TABLE studios ADD COLUMN IF NOT EXISTS role_hours jsonb DEFAULT '{}'::jsonb;
```
`address`, `postal_code`, `city`, `phone`, `capacity`, `manager_id`, `has_kitchen`, `short_name` existent déjà.

`opening_hours` = `[{day:"Lundi", open:"07h00", close:"18h00", closed:false}, ...]` (7 entrées). Stocker en JSONB plutôt qu'une table `studio_opening_hours` parce que c'est toujours 7 lignes par studio, lues/écrites en bloc, jamais filtrées en SQL.

`role_hours` = `{"Barista":{"open":"07h00","close":"18h00"}, ...}`. Idem, JSONB suffit.

### B. Nouvelle table `studio_business_roles` (liaison rôles ↔ studio)
```
CREATE TABLE studio_business_roles (
  studio_id uuid NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  role text NOT NULL,                    -- nom du rôle (Barista, Cuisine, ou custom)
  PRIMARY KEY (studio_id, role)
);
```
+ RLS admin-only ALL, SELECT pour authentifiés.

### C. Nouvelle table `studio_exceptions`
```
CREATE TABLE studio_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES studios(id) ON DELETE CASCADE,
  exception_date date NOT NULL,
  exception_type text NOT NULL,          -- 'fermeture' | 'evenement' | 'ajustement'
  title text NOT NULL,
  description text,
  staff_adjustments jsonb DEFAULT '[]'::jsonb,  -- [{role:"Host", delta:+2}, ...]
  created_at timestamptz NOT NULL DEFAULT now()
);
```
+ RLS admin/manager ALL, SELECT authentifiés.

### D. Déjà fait dans une migration précédente : `studios.deleted_at`. Ajouter si absent.

## Server functions à créer

`src/lib/studios.functions.ts` — `getStudios`, `getStudioById`, `createStudio`, `updateStudio`, `softDeleteStudio` (avec vérif blockers via `studio_blockers`), `addBusinessRoleToStudio`, `removeBusinessRoleFromStudio`.

`src/lib/studio-exceptions.functions.ts` — CRUD complet.

(`staffing-templates.functions.ts` non nécessaire : `StaffingTemplatesEditor` fait déjà ses propres calls Supabase.)

## Refactor de `studios.tsx`

**Stratégie** : remplacer le state-local par des hooks DB-backed, **sans toucher au JSX**.

- `studioTabs` ← `useStudios()` (query getStudios + realtime).
- `infos[studio]` ← lookup dans la liste DB par nom (le studio sélectionné a un `id` qu'on garde dans le state local).
- `week`, `roleHours`, `infos.*` ← tous lus depuis l'objet studio courant. Les `setX` deviennent des appels `updateStudio({id, ...patch})` + invalidation.
- `activeRoles` + `customRoles` ← merge depuis `studio_business_roles` ; toggles = `addBusinessRoleToStudio` / `removeBusinessRoleFromStudio`.
- `ExceptionsTab` ← `useExceptions(studio_id)` + CRUD.
- `createStudio` UI → server fn `createStudio({name})` (short_name = name.replace(/^Skult /, "")).
- `deleteStudio` UI → server fn `softDeleteStudio(id)` (set `deleted_at = now()`).
- `getStudios` filtre `WHERE deleted_at IS NULL`. Mêmes filtres ajoutés dans `use-employees`, `planning.tsx`, `generate-planning.functions.ts` (3 endroits).

Le **JSX reste inchangé à 100 %** : tabs, sous-tabs, modal nouveau studio, modal confirmation suppression, cards, classes Tailwind, libellés français — rien ne bouge.

## Plan d'exécution en 3 sous-tours

1. **Sous-tour 1** : Migrations SQL (A+B+C+D) + `src/lib/studios.functions.ts` + `src/lib/studio-exceptions.functions.ts` + `src/hooks/use-studios.ts` + filtrer `deleted_at IS NULL` dans `use-employees`, `planning.tsx`, `generate-planning.functions.ts`.
2. **Sous-tour 2** : Refactor `studios.tsx` → onglet **Informations** (incl. edit modal, postes actifs, suppression studio, modal nouveau studio) en gardant le JSX intact.
3. **Sous-tour 3** : Refactor `ExceptionsTab` (toujours dans `studios.tsx`) + suppression `studioExceptions` de mock-data.ts + mise à jour audit hardcoding + rapport final.

## Décisions à valider avant de coder

1. **`opening_hours` et `role_hours` en JSONB** sur `studios` plutôt que tables dédiées — OK pour toi ?
2. **`studio_business_roles`** stocke le `role` par **nom** (string), pas par FK vers `business_roles.id`, pour rester aligné avec la convention déjà en place dans `user_business_roles` (qui utilise aussi `role text`). OK ?
3. **Suppression studio** = soft delete (`deleted_at`), refusée si shifts/templates/profils encore liés (via fonction RPC `studio_blockers` qui existe déjà). OK ?
4. **Le bouton "Modifier"** : actuellement il existe dans l'UI et les champs sont déjà éditables inline (state local). Je conserve l'édition inline et persiste à chaque blur/change (debounced 400ms). Pas de modal supplémentaire. OK ?

Si tu valides ces 4 points (ou que tu réponds "go" tout court), j'enchaîne le sous-tour 1.