# Refonte page Clôture

Objectif : transformer /cloture en outil de configuration réel (vs maquette), branché de bout en bout au parcours employé, aux notifications et au scoring existant.

## 1. Câbler les boutons cassés (priorité absolue)

**Checklist par poste — "Ajouter un point"**
- Lire `cloture.tsx` pour trouver le handler de l'ajout d'item (`checklist_template_items`).
- Diagnostiquer pourquoi le bouton ne déclenche rien (probable handler manquant / state non lié).
- Brancher un insert réel + invalidation de la liste.

**Photos de clôture — "Ajouter une zone"**
- Même traitement sur `checklist_template_photos`.

**Questions post-shift — "Ajouter une question"**
- Même traitement sur `closure_questions` (déjà en base).

**Modèles suggérés**
- Suppression complète de la section (jamais demandée).

Toutes ces actions doivent persister en base via les tables existantes, sans toucher au schéma.

## 2. Connecter la config pointage au parcours employé réel

Actuellement les champs `clock_out_button_appears_before_min` / `clock_out_grace_period_min` / `clock_out_overdue_action` sont stockés sur `studios` mais ne sont **pas** lus côté employé.

**Côté employé (`ClosureFlow.tsx` + `staff-app/`)**
- Le bouton "Pointer ma sortie" n'apparaît qu'à partir de `end_time − clock_out_button_appears_before_min`.
- Si l'employé n'a pas pointé à `end_time + clock_out_grace_period_min` → déclencher l'action configurée (`notify_manager` → insert dans `notifications` pour tous admins/managers du studio).

**Côté serveur**
- Nouveau server fn `notifyOverdueClockOuts` (peut être appelé à la demande au chargement de la page admin, ou via trigger frontend simple sans cron pour rester simple).

## 3. QR code — un seul mode "tablette"

- Suppression des options "impression comptoir" / "téléphone manager".
- Suppression de la section "géolocalisation complémentaire".
- Ajout d'un encart explicatif court : "Le code actuel est le QR affiché sur la tablette du studio. Il se renouvelle automatiquement toutes les N secondes pour empêcher la triche."
- Bouton "Régénérer maintenant" déjà existant — vérifier qu'il fonctionne.

## 4. Seuil IA — Faible / Moyen / Élevé

Remplacer le slider 0-100 par 3 boutons :
- **Souple** (équivalent 50/100) — accepte les photos même imparfaites
- **Standard** (75/100) — recommandé
- **Strict** (90/100) — refuse au moindre doute

Stocké sur la même colonne `ai_validation_threshold` (50/75/90).

## 5. Analyse IA des photos — branchement Lovable AI

**Nouveau server fn `analyzeClosurePhoto`**
- Reçoit `submission_photo_id`.
- Récupère l'URL de la photo + la photo de référence + le hint du template.
- Appelle Lovable AI (`google/gemini-3-flash-preview` en multimodal) avec prompt : "Compare cette photo à la référence. Le poste a-t-il été correctement nettoyé/rangé ? Réponds en JSON `{verdict: 'pass'|'fail', confidence: 0-100, reason: string}`."
- Compare `confidence` au seuil du template → écrit `ai_validation_status` (`validated` / `rejected`) + `ai_validation_message` + `ai_validated_at`.

**Côté employé (`ClosureFlow.tsx`)**
- Après upload d'une photo, appeler ce server fn.
- Afficher Faible/Moyen/Élevé en français + raison.

**Côté admin (rapports)**
- Les photos rejetées remontent déjà (table existe), juste vérifier l'affichage.

## 6. Connexion au scoring (vérification, pas réécriture)

Le user a confirmé que le scoring est déjà câblé via `calculate_profile_score` (trigger sur `checklist_submissions` / `checklist_submission_items`). Je vérifie seulement que :
- Les réponses aux questions de clôture (`closure_question_responses`) sont bien sauvegardées (déjà fait dans `finalizeClosure`).
- Aucune régression sur le trigger existant.

## Fichiers touchés

- `src/routes/cloture.tsx` — refonte UI (boutons, suppression modèles suggérés, QR simplifié, seuil 3 niveaux)
- `src/components/staff-app/ClosureFlow.tsx` — apparition conditionnelle du bouton clock-out + appel analyse IA
- `src/lib/closure-flow.functions.ts` + `.server.ts` — nouveau `analyzeClosurePhoto`, nouveau `notifyOverdueClockOuts`
- `src/lib/ai-gateway.ts` (nouveau si absent) — helper provider Lovable AI

## Hors scope (à faire dans un prompt séparé si tu veux)

- Modes QR "impression" et "téléphone manager"
- Page dédiée "Règles de scoring"
- Cron job serveur pour les overdue clock-outs (pour l'instant déclenché au load admin)
