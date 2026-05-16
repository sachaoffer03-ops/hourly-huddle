# QA Test Suite — Moteur de planning

## Fichiers à créer

1. **`src/lib/qa-test-suite.functions.ts`** — server functions (admin-guard via `requireSupabaseAuth` + check `user_roles.role='admin'`, utilise `supabaseAdmin`)
   - `prepareTestDataset()` → crée Studio Alpha + Beta, 30 employés `is_test=true`, 52 staffing templates, ~600 dispos sur 4 semaines
   - `cleanupTestDataset()` → supprime tout `is_test=true` + studios `name LIKE 'Test Studio %'` + leurs auth.users, shifts, dispos, templates, planning_runs liés
   - `resetTestDataset()` → cleanup puis prepare
   - `runTest1_CoverageStandard` … `runTest8_Idempotence` → chacun retourne `TestResult { testName, status, durationMs, message, details?, error? }`
   - Chaque test : appel direct du handler de `generatePlanning` via une fonction interne partagée (pas via fetch), assertions sur le résultat
   - Tests 6 & 7 sauvegardent/restaurent l'état (dispos / employés temporaires) en `try/finally`

2. **`src/routes/admin.qa-test-suite.tsx`** — route TanStack wrappée dans `<DevOnly label="La QA Test Suite">`
   - **Section 1 — Setup** : 3 boutons (Préparer / Nettoyer avec confirm / Reset) avec `useMutation` + toast + affichage du résultat
   - **Section 2 — Suite de tests** : liste 8 cartes (nom, description, bouton "Lancer", badge statut) + gros bouton "Lancer TOUS les tests" (séquentiel)
   - **Section 3 — Résultats** : tableau récap avec ✅/❌, durée par test, total, bouton "Voir détails" → Sheet avec inputs/output/diff/stack, bouton "Exporter le rapport" (download JSON + Markdown)
   - État local React + persistance `localStorage` du dernier run pour comparaison cross-session

## Détails techniques

**Dataset déterministe** (seed RNG fixe pour reproductibilité) :
- Studios : "Test Studio Alpha" (has_kitchen=true), "Test Studio Beta" (has_kitchen=false)
- Business roles : vérifie/crée Accueil, Barista, Host, Cuisine
- Templates : 40 sur Alpha (incl. 5 cuisine Lun-Ven CDI), 12 sur Beta
- Employés : pools de prénoms/noms fournis, distribution exacte (8 CDI / 15 Étudiants / 7 Flexis), dispos générées 4-6/sem sur 4 semaines

**Cleanup safe** : double check `is_test=true` ET `name LIKE 'Test Studio %'` ; jamais d'admin supprimé ; supprime aussi `availabilities`, `shifts`, `staffing_templates`, `planning_runs`, `studio_business_roles`, `user_studios`, `user_contracts`, `user_business_roles`, `user_roles` liés via `user_id IN (...)` ou `studio_id IN (...)`.

**Tests** :
- Période de test = lundi prochain (déterministe)
- T1 : genère sur Alpha, assert `coverage_rate >= 0.90`
- T2 : 2 semaines, scan shifts par user, vérifie plafonds par contrat
- T3 : scan tous shifts par user, détecte chevauchements + paires consécutives < 11h
- T4 : filtre shifts cuisine Lun-Ven, vérifie assignation = CDI cuisine
- T5 : variance heures par contrat-type
- T6 : delete 80% des dispos, génère, restore — assert no throw + couverture < 50% + alerts non vide
- T7 : crée 70 employés temp `is_test=true` flag spécial, génère sur Beta, mesure durée, supprime
- T8 : 2 runs consécutifs, compare assignations (≥ 95% identiques)

**Sécurité / contraintes** :
- Route DevOnly (cachée en prod)
- Toutes les server fns vérifient role admin
- Cleanup avec double filtre `is_test=true` + `name LIKE 'Test%'`
- Tests séquentiels, jamais en parallèle
- Aucune modification du moteur (`generate-planning.functions.ts` non touché)

## Hors scope

- Pas de migration SQL (`is_test` existe déjà sur `profiles`)
- Pas de modification du moteur même si tests fail (rapport seulement, l'utilisateur décide ensuite)
- Pas de modification des autres routes admin

## Livrables finaux

Liste des fichiers créés, confirmation DevOnly, description UI, et — après ton "go" — une première run pour le verdict X/8 tests.