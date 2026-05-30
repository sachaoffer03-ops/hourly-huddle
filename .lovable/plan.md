# Plan — Améliorer l'Assistant IA Kadence (3 ajouts)

Cible : `src/components/staff-app/AIChatPanel.tsx` + `src/lib/ai-chat.functions.ts`

## 1. Actions exécutables depuis le chat

Le bot peut déclencher des actions concrètes au lieu de juste répondre du texte.

**Actions activées au lancement :**
- "Poser un congé" → ouvre `DisposSheet` / `StaffActionsSheets` (demande absence) pré-rempli
- "Voir mon prochain shift" → scroll/ouvre la carte planning
- "Voir mes formations à valider" → ouvre `FormationHub`
- "Signaler un problème" → ouvre la sheet signalement

**Mécanique :**
- Le system prompt apprend au modèle à émettre, en fin de réponse, un bloc structuré `[[ACTION:type|param=value]]` (ex : `[[ACTION:open_leave_request]]`).
- Côté `AIChatPanel`, on parse la réponse : on retire le bloc du texte affiché et on rend un bouton CTA sous le message (ex : "Ouvrir la demande de congé").
- Clic → callback typé qui ouvre la bonne sheet via un `onAction` prop passé par `staff-app.tsx`.
- Liste d'actions whitelistée côté client (sécurité : on ignore toute action non reconnue).

## 2. Suggestions rapides contextuelles

Aujourd'hui : 3 suggestions statiques (`SUGGESTIONS` hardcodé).

**Nouveau :** suggestions dynamiques calculées côté serveur dans `getChatHistory` (ou nouveau `getChatSuggestions`) selon le contexte de l'employé :
- A un shift demain → "C'est quoi mon shift de demain ?"
- Formation obligatoire non validée → "Quelles formations dois-je valider ?"
- Pas de dispos posées pour la semaine N+1 → "Comment poser mes dispos ?"
- Score < 7 → "Comment améliorer mon score ?"
- Proposition en attente → "J'ai une proposition de shift, je dois faire quoi ?"
- Fallback : 3 suggestions génériques si rien de pertinent

Affichage : mêmes cartes que maintenant, mais re-calculées à chaque ouverture du panel + suggestions de follow-up après chaque réponse du bot (3 boutons sous le dernier message assistant).

## 3. Entrée vocale (Web Speech API)

Bouton micro à côté du bouton "envoyer" dans la barre d'input.
- Tap → démarre `SpeechRecognition` (Webkit/Standard), langue `fr-FR`, mode continu off (un énoncé à la fois).
- Pendant l'écoute : icône micro pulse en coral, textarea affiche la transcription en temps réel (interim results).
- Tap à nouveau ou silence détecté → arrête et laisse l'utilisateur valider/éditer avant `send()`.
- Fallback : si `SpeechRecognition` indisponible (Safari iOS < 14.5, certains Android), le bouton est masqué.
- Permission micro refusée → toast "Active le micro dans les réglages du navigateur".

Pas d'appel externe, pas d'API key : 100% navigateur, gratuit, latence quasi nulle.

## Technique

### Fichiers modifiés
- `src/components/staff-app/AIChatPanel.tsx` :
  - Parse `[[ACTION:...]]` dans la réponse assistant
  - Rendu de boutons CTA sous les messages
  - Bouton micro + hook `useVoiceInput` (nouveau)
  - Suggestions de follow-up sous chaque réponse
  - Prop `onAction?: (action: ChatAction) => void`
- `src/hooks/use-voice-input.ts` *(nouveau)* : wrapper `SpeechRecognition` propre + cleanup
- `src/lib/ai-chat.functions.ts` :
  - System prompt enrichi : explique les actions disponibles et la syntaxe `[[ACTION:...]]`
  - Nouvelle serverFn `getChatSuggestions` qui retourne 3 suggestions contextuelles basées sur shifts/formations/dispos/score
- `src/routes/staff-app.tsx` (ou parent du panel) : branche `onAction` pour ouvrir les sheets existantes

### Pas de migration DB
Tout est calculé à la volée à partir des tables existantes (`shifts`, `training_course_completions`, `availabilities`, `profiles`, `proposals`).

### Pas de nouvelle dépendance
- Web Speech API : natif navigateur
- Parsing actions : regex simple

## Hors scope (volontairement)
- Pas d'exécution serveur d'actions sensibles (poser le congé directement) — on ouvre juste l'UI existante, l'utilisateur valide. Plus sûr et plus simple.
- Pas de TTS (réponse audio du bot).
- Pas de wake-word ("Hey Kadence").
