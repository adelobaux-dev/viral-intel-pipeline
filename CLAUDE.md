# CLAUDE.md

## Contexte du projet

Cette application web est un **assistant de closing en temps réel** développé pour
le cabinet de chirurgie esthétique du **Dr Alexis Delobaux**.

Pendant un échange téléphonique ou en visio avec un patient, l'application :

1. **Écoute** le micro de l'utilisateur (closer, IDE, médecin).
2. **Transcrit** l'audio en temps réel via **Deepgram** (streaming WebSocket).
3. **Analyse** la conversation avec **Claude (Anthropic)** pour fournir des
   recommandations de closing très courtes, basées sur la méthode **C.A.R.E.S.**
4. À la fin de l'appel, **score** la performance, génère un **feedback écrit**,
   un **résumé patient** (à copier dans Doctolib), archive le tout sur
   **Google Drive** et envoie un **email récapitulatif** au patient via Gmail.
5. Centralise les **performances de l'équipe** dans un dashboard avec gestion
   des rôles.

## Méthode C.A.R.E.S.

- **C**onnecter : créer le lien, instaurer la confiance.
- **A**nalyser : comprendre le motif, la morphologie, le budget, les attentes.
- **R**assurer : lever les objections (prix, sécurité, douleur, résultats).
- **E**ngager : proposer la prochaine étape (consultation, devis, RDV).
- **S**écuriser : confirmer, verrouiller le prépaiement (déduit du devis).

Spécialités concernées : **SMART BBL**, **remodelage costal**, chirurgie
esthétique haut de gamme.

## Stack technique

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind CSS**
- **Deepgram** : transcription audio temps réel
- **Anthropic Claude** : recommandations temps réel + scoring final
- **Supabase** (PostgreSQL) : auth + persistance
- **googleapis** : intégrations Google Drive & Gmail
- **zustand** : état client ; **framer-motion** / **lucide-react** : UI

## Rôles

- `admin` : **Dr Delobaux** et **Prescillia** — vue globale équipe + classement.
- `closer` / `ide` / `doctor` : stats personnelles + historique de leurs appels.

## Conventions

- Les recommandations IA doivent rester **ultra-courtes** (1 phrase max).
- Ne jamais exposer `ANTHROPIC_API_KEY`, `DEEPGRAM_API_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY` ni les identifiants Google côté client.
- Les routes `/dashboard` et `/live-call` sont protégées par middleware.

## Structure

```
src/
  app/            Pages & routes API (App Router)
  components/     Composants UI
  hooks/          Hooks React (useAudioRecorder…)
  lib/            Clients & services (supabase, anthropic, deepgram, google…)
supabase/
  migrations/     Schéma SQL
```
