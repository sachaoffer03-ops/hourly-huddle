# Notifications cliquables → page liée

## Constat

J'ai audité tous les endroits qui insèrent dans `notifications` (≈25 sites) et les deux endroits qui les affichent (TopBar admin + EmployeeNotifsWidget). Trois problèmes :

1. **Liens trop génériques** : la majorité pointent vers `/staff-app` ou `/staff-app?tab=xxx` — donc on retombe sur l'Accueil sans contexte.
2. **Liens jamais lus** : `staff-app` n'interprète **pas** `?tab=…` (seul `?openDocs=1` est géré). Les liens `?tab=planning` / `?tab=accueil` / `?tab=chat` posés par `use-staff-notifications` ne font rien.
3. **Pas de deep-link ressource** : aucun lien ne porte d'ID (shift, demande, formation, document). Impossible d'ouvrir directement le bon sheet/élément.

Symétrie admin / employé attendue par l'utilisateur : chaque notif = 1 ressource = 1 clic = bonne page + bon élément ouvert.

## Plan

### 1. Convention de deep-link (table)

| Évènement | Destinataire | Lien |
|---|---|---|
| Shift assigné / modifié / supprimé | employé | `/staff-app?tab=planning&shift=<id>` |
| Rappel "shift dans 1h / commence" | employé | `/staff-app?tab=accueil&shift=<id>` |
| Nouveau message chat | employé | `/staff-app?tab=chat&thread=<id>` |
| Document à signer | employé | `/staff-app?tab=profil&openDocs=1&doc=<id>` |
| Formation assignée / rappel | employé | `/staff-app?tab=formation&course=<id>` |
| Proposition shift (offre) | employé | `/staff-app?tab=accueil&proposal=<id>` |
| Réponse à demande modif | employé | `/staff-app?tab=planning&request=<id>` |
| Checklist clôture manquée | employé | `/staff-app?tab=accueil&shift=<id>` |
| Récap fin de shift | employé | `/staff-app?tab=profil` (déjà ok) |
| Clôture soumise par X | admin | `/cloture?submission=<id>` |
| Demande de modif reçue | admin | `/demandes?request=<id>` |
| Proposition / swap à valider | admin | `/trous?proposal=<id>` |
| Pointage anormal | admin | `/pointage?shift=<id>` |
| Formation terminée | admin | `/staff/<userId>?tab=formation` |
| Document uploadé par employé | admin | `/staff/<userId>?tab=documents` |
| Feedback employé | admin | `/feedbacks?id=<id>` |
| Nouveau staff inscrit | admin | `/staff/<userId>` |

Règle d'or : **toujours un lien non-null**, **toujours un ID dans la query** quand une ressource existe.

### 2. Backend — mettre à jour les inserts

Modifier les 25 sites repérés pour produire le lien selon la table ci-dessus :
- `src/lib/shifts.functions.ts` (6 inserts) — ajouter `&shift=<id>`
- `src/lib/proposals.functions.ts` (5 inserts) — `proposal=<id>` côté employé, `/trous?proposal=` côté admin
- `src/lib/formation.functions.ts` (3 inserts) — `course=<id>`, et côté admin `/staff/<userId>?tab=formation`
- `src/lib/documents.functions.ts` — `doc=<id>`
- `src/lib/demandes.functions.ts` — `request=<id>` côté employé, `/demandes?request=` côté admin
- `src/lib/closure-flow.server.ts` — `submission=<id>` pour admin, `shift=<id>` pour employé
- `src/lib/planning-workflow.functions.ts` — `shift=<id>`
- `src/lib/pointage.functions.ts` — `shift=<id>`
- `src/hooks/use-checklists.ts` — `shift=<id>`
- `src/hooks/use-staff-notifications.ts` — corriger les liens fallback
- `src/routes/feedbacks.tsx`, `src/routes/staff.$id.tsx` — ajouter ID
- `src/lib/seed-demo.functions.ts` — aligner les liens de démo

### 3. Frontend — interpréter les liens

**`src/routes/staff-app.tsx`** : au mount + à chaque changement d'URL, lire les query params et :
- `?tab=<accueil|planning|pointage|formation|chat|profil>` → `setTab(...)`
- `?shift=<id>` → ouvrir le sheet détail shift (Planning ou Accueil selon contexte)
- `?proposal=<id>` → ouvrir ProposalsSheet sur cette offre
- `?request=<id>` → ouvrir RequestModificationSheet en mode lecture
- `?thread=<id>` → ouvrir ChatSheet sur ce thread
- `?course=<id>` → ouvrir FormationHub sur ce cours
- `?doc=<id>` → ouvrir EmployeeDocumentsTab sur ce doc
- Après lecture, faire `history.replaceState` pour nettoyer la query (comme déjà fait pour `openDocs`).

**Pages admin** (`/cloture`, `/demandes`, `/trous`, `/pointage`, `/feedbacks`, `/staff/$id`) : lire le query param correspondant et ouvrir/scroller vers l'item ciblé (sheet ou highlight).

### 4. Click handlers — garantir la navigation

- **`TopBar.tsx`** (admin) : si `n.link` null, fallback intelligent par `category` (`planning`→`/planning`, `shift`→`/pointage`, `request`→`/demandes`, `training`→`/formation`, `document`→`/staff`, `pointage`→`/pointage`, `general`→`/dashboard`). Plus jamais de notif inerte.
- **`EmployeeNotifsWidget.tsx`** : même fallback côté employé (`→ /staff-app?tab=<dérivé de category>`).
- Les deux marquent `read_at` avant de naviguer (déjà le cas).

### 5. Tests manuels

- Notif "shift assigné" employé → ouvre Planning + sheet du bon shift
- Notif "demande modif" admin → ouvre `/demandes` avec ligne surlignée
- Notif "document à signer" → ouvre profil + sheet docs + doc ouvert
- Notif "nouveau message" → ouvre Chat sur le bon thread
- Notif sans link explicite → fallback de catégorie OK

## Détails techniques

- Pas de migration DB : `link` existe déjà (text nullable). On la remplit mieux.
- Ajout d'un helper `src/lib/notif-links.ts` exportant `employeeLink({...})` et `adminLink({...})` pour centraliser la convention et éviter la dérive entre les 25 sites d'insertion.
- Le parsing query côté `staff-app` passe par un seul `useEffect` au top-level du composant (pas dans chaque Tab) qui dispatch vers les setters d'état appropriés.
- Pour les pages admin, helper `useOpenFromQuery(param, onOpen)` dans `src/hooks/` pour factoriser.
- Aucun changement de business logic : on n'ajoute/supprime aucune notif, on rend juste chaque notif actionnable.

## Hors scope

- Pas de refactor du système de notifications (catégories, priorités).
- Pas de nouvelle page admin notifs (juste la cloche, comme demandé précédemment).
- Pas de changement de design des items notif.
