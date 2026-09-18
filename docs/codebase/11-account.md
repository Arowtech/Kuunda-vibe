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
| PKCE + `kuunda-vibe://auth/callback` | Retour OAuth dans l’app, pas un copier-coller de code |
| Device pairing (code court) | Approuver l’IDE depuis le dashboard web sans taper le mot de passe dans l’éditeur |
| Bearer sur crédits / checkout | Plus de `userId` saisi à la main comme identité primaire |
| Hors-ligne strict coupe `auth` | Même fail-closed que billing / Cloud |

## Livrables publics (ce dépôt)

| Id | Comportement | Où |
| --- | --- | --- |
| 11.1 Studio | Overlay identité / crédits / usage / appareils / Cloud / sécurité | `openKuundaAccountStudio` |
| 11.2 Email | Signup + login in-app ; Cloud `pending_user` ouvre ce formulaire | `POST /v1/auth/signup` · `/v1/auth/login` |
| 11.3 OAuth | Google / GitHub / Apple via navigateur + PKCE | `/v1/auth/oauth/start` · `/finish` |
| 11.4 Pairing | Code court + poll | `/v1/auth/device/start` · `/poll` |
| 11.5 Sync web | Handoff court vers le dashboard déjà identifié | `POST /v1/auth/web-handoff` |
| 11.6 Facturation | Status bar → Studio ; Bearer + `userId` de session | `IKuundaBillingService` |

F1 : `kuunda.account.openStudio`, `kuunda.account.signOut`, `kuunda.account.signOutEverywhere`. Menu Comptes de la barre d’activité : **Open Studio**.

## Contrats API (privé `kuunda-vibe-cloud`)

Le Worker doit cesser de répondre 501 et fédérer **Kuunda Cloud Auth** (mêmes utilisateurs que `app.kuunda.cloud`) :

- `POST /v1/auth/signup` `{ email, password, displayName? }` → session
- `POST /v1/auth/login` `{ email, password }` → session
- `POST /v1/auth/oauth/start` `{ provider, redirectUri, codeChallenge, state }` → `{ authorizationUrl, state }`
- `POST /v1/auth/oauth/finish` `{ provider, code, codeVerifier, state }` → session
- `POST /v1/auth/device/start` `{ client: "ide" }` → `{ deviceCode, userCode, verificationUrl, expiresIn, interval }`
- `POST /v1/auth/device/poll` `{ deviceCode }` → session **ou** `{ pending: true }`
- `POST /v1/auth/refresh` `{ refreshToken }` → session
- `POST /v1/auth/logout` Bearer ; `{ everywhere?: true }`
- `GET /v1/account/me` Bearer → profil (email, org, plan, providers, `cloud.projectCount`)
- `GET /v1/account/usage` Bearer → crédits + ventilation agent / Tab / publish
- `GET /v1/account/sessions` · `DELETE /v1/account/sessions/:id`
- `POST /v1/auth/web-handoff` Bearer → `{ url }` one-shot

Session JSON : `{ accessToken, refreshToken?, expiresAt?, userId, email, displayName?, providers?, org?, planId? }` — jamais le mot de passe en retour.

## À activer sur Kuunda Cloud (opérateur)

1. Auth **email + mot de passe**
2. Provider **Google**
3. Provider **GitHub**
4. Provider **Apple**
5. Page web d’approbation device (`userCode`) sur `app.kuunda.cloud` / `app.ide.kuunda-cloud.com`
6. Redirect OAuth autorisé : `kuunda-vibe://auth/callback`

Sans ces providers et sans les routes Worker, le Studio affiche *Account service is not ready yet* (501/503).

## Isolation

- Algorithmes : `packages/kuunda-ai/src/account-policy.js`
- Contrats HTTP : `packages/cloud-client`
- UI : `src/vs/workbench/contrib/kuundaAccount/`
- Accroche crédits : `kuundaBillingService` lit la session et envoie `Authorization: Bearer`
- Accroche Cloud : `pending_user` → Studio `{ intent: 'signUp', reason: 'cloud' }` ; Bearer sur `POST /v1/provisioning/projects` (`env: sandbox`)
- Accroche accueil : `appendKuundaHomeAccountCta`

## Hors de portée (public)

- Ledger, HMAC paiement, secrets `service_role`
- `wrangler deploy` du Worker privé
- Télémétrie d’usage silencieuse (l’onglet Usage ne lit que `GET /v1/account/usage`)
