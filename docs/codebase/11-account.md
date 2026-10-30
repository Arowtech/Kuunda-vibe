# 11 — Compte Studio (web ↔ IDE)

**Phase :** 11  
**Validation steward :** en cours  
**Prérequis :** EXE / DMG internes fonctionnels ; Phases 3bis et 6 livrées

Une **identité Kuunda unique** pour l’IDE et le web (`app.kuunda.cloud` + `app.ide.kuunda-cloud.com`). Email + mot de passe, Google, GitHub, Apple (fournisseurs à activer côté Kuunda Cloud). Crédits, usage, organisation et projets Cloud partagent cette session. L’agent local (Ollama / BYOK) reste utilisable **sans** compte — contrairement à un mur de connexion type Cursor.

## Choix techniques

| Choix | Pourquoi |
| --- | --- |
| Contrib isolé `kuundaAccount/` | Pas de mélange avec GitHub/Microsoft Accounts VS Code |
| Jetons dans `ISecretStorageService` | Mot de passe jamais persisté ; coffre OS |
| Connexion **uniquement sur le site** | Comme Cursor / Windsurf : l’IDE ouvre le navigateur, la session revient toute seule |
| `kuunda-vibe://auth/callback` | Deep link du site vers l’app pour une synchro instantanée (le poll reste le fallback) |
| Device pairing (code court) | Le site authentifie puis approuve l’IDE — aucun mot de passe saisi dans l’éditeur |
| Bearer sur crédits / checkout | Plus de `userId` saisi à la main comme identité primaire |
| Hors-ligne strict coupe `auth` | Même fail-closed que billing / Cloud |

## Livrables publics (ce dépôt)

| Id | Comportement | Où |
| --- | --- | --- |
| 11.1 Studio | Overlay identité / crédits / usage / appareils / Cloud / sécurité | `openKuundaAccountStudio` |
| 11.2 Web sign-in | CTA unique : le site fait login / signup / abonnement, l’IDE synchronise | `/v1/auth/device/start` · `/poll` |
| 11.3 Deep link | Le site peut renvoyer `kuunda-vibe://auth/callback?deviceCode=…` pour une synchro instantanée | `completeWebCallback` |
| 11.4 Providers | Email, Google, GitHub, Apple — gérés **sur le site**, pas dans l’IDE | Auth Kuunda Cloud |
| 11.5 Sync web | Handoff court vers le dashboard déjà identifié | `POST /v1/auth/web-handoff` |
| 11.6 Facturation | Status bar → Studio ; plans et checkout ouverts **sur le site** | `IKuundaBillingService` |

F1 : `kuunda.account.openStudio`, `kuunda.account.signOut`, `kuunda.account.signOutEverywhere`. Menu Comptes de la barre d’activité : **Open Studio**.

## Contrats API (privé `kuunda-vibe-cloud`)

Le Worker doit cesser de répondre 501 sur ces routes et fédérer **Kuunda Cloud Auth** (mêmes utilisateurs que `app.kuunda.cloud`). Une brique est déjà livrée : `POST /v1/auth/session` émet un jeton HMAC de 30 jours (session anonyme, sans email ni mot de passe). Ce qui reste à livrer est la fédération d'identité ci-dessous :

Routes consommées par l’IDE (contrat réel `kuunda-vibe-cloud`) :

- `POST /v1/auth/device-pairing/start` `{ deviceId, label, platform, challenge }` → `{ pairingId, code, expiresIn, pollInterval }`
- `POST /v1/auth/device-pairing/poll` `{ pairingId, challenge }` → `{ status: 'pending' }` **ou** `{ status: 'approved', accessToken, userId, deviceId, expiresIn }`
- `POST /v1/auth/logout` Bearer ; `{ everywhere?: true }` (révoque l’appareil, ou tous)
- `GET /v1/account/me` Bearer → `{ userId, email, displayName, providers, planId }`
- `GET /v1/account/sessions` · `DELETE /v1/account/sessions/:id`
- `POST /v1/auth/web-handoff` Bearer → `{ url }` one-shot (`/login/#handoff=<token>`)

Les sessions appareil (jeton en 5 segments) doivent envoyer l’en-tête `X-Kuunda-Device: <deviceId>` — l’IDE l’extrait du jeton et l’ajoute à chaque appel Bearer, y compris la passerelle IA.

Routes consommées par le **site** (l’IDE ne les appelle plus) : `/v1/auth/signup`, `/v1/auth/login`, `/v1/auth/oauth/start` · `/finish`, `/v1/auth/device-pairing/inspect` · `/approve` · `/deny`. La page `verificationUrl` (`/app/device/?code=…`) est la porte d’entrée unique : elle fait login, signup ou abonnement puis approuve `code`. Après approbation elle renvoie `kuunda-vibe://auth/callback?deviceCode=<pairingId>` pour une synchro instantanée — le `challenge` ne quitte jamais l’IDE.

Session JSON : `{ accessToken, refreshToken?, expiresAt?, userId, email, displayName?, providers?, org?, planId? }` — jamais le mot de passe en retour.

## À activer sur Kuunda Cloud (opérateur)

1. Auth **email + mot de passe** (sur le site)
2. Provider **Google** (sur le site)
3. Provider **GitHub** (sur le site)
4. Provider **Apple** (sur le site)
5. Page web d’appairage IDE (`userCode`, login + approbation) sur `app.kuunda.cloud` / `app.ide.kuunda-cloud.com`
6. Redirect autorisé : `kuunda-vibe://auth/callback` (param `deviceCode` optionnel pour synchro instantanée)

Sans ces providers et sans les routes Worker, le Studio affiche *Account service is not ready yet* (501/503).

## Isolation

- Algorithmes : `packages/kuunda-ai/src/account-policy.js`
- Contrats HTTP : `packages/cloud-client`
- UI : `src/vs/workbench/contrib/kuundaAccount/`
- Accroche crédits : `kuundaBillingService` lit la session et envoie `Authorization: Bearer`
- Accroche Cloud : compte principal auto `kva_<uuid>` (aucun compte web requis) ; `userId` de session envoyé seulement comme indice d’attribution, Bearer si présent — aucun écran de création de compte déclenché par le Cloud
- Accroche accueil : `appendKuundaHomeAccountCta`

## Hors de portée (public)

- Ledger, HMAC paiement, secrets `service_role`
- `wrangler deploy` du Worker privé
- Télémétrie d’usage silencieuse (l’onglet Usage ne lit que `GET /v1/account/usage`)
