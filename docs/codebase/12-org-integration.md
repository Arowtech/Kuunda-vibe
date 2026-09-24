# 12 — Intégration plateforme (organisations) pour Kuunda Cloud

**Destinataires :** équipe Kuunda Cloud (Worker privé `kuunda-vibe-cloud`, `app.kuunda.cloud`, schéma SQL).
**Objectif :** permettre à une plateforme tierce (Kuunda Vibe en premier client) d'intégrer la base Kuunda Cloud et de **gérer à la place de l'utilisateur**, sans jamais passer par l'interface Kuunda Cloud ni demander une inscription à l'utilisateur final.
**Documents jumeaux :** [13-openrouter-ai-gateway.md](13-openrouter-ai-gateway.md) (modèles, crédits, politique de données) et [14-pricing-catalog-admin.md](14-pricing-catalog-admin.md) (catalogue tarifaire et console).

## 1. Le besoin en une phrase

> Une plateforme crée un compte Kuunda Cloud pour son utilisateur, y range TOUS ses projets, choisit un plan par projet, et pilote tout par API — l'utilisateur final ne voit jamais Kuunda Cloud.

C'est le modèle **organisation** (B2B2C, « managed accounts »). Kuunda Cloud n'est pas seulement un dashboard pour humains : c'est une **API de base de données multi-tenant**, avec une console web optionnelle.

## 2. Modèle à 4 niveaux

| Niveau | Qui | Ce que ça représente |
| --- | --- | --- |
| **Organization** | La plateforme partenaire (ex. Arowtech) | Le locataire commercial ; porte l'identité juridique, le quota global et la facturation |
| **Client / Environment** | Un déploiement de la plateforme (`sandbox`, `production`, `ide-windows`) | Clé d'API dédiée, quotas et journaux séparés |
| **Managed account** | L'utilisateur final, créé *pour lui* | Porte ses projets ; peut être optionnellement revendiqué plus tard par l'utilisateur |
| **Project** | Un projet de la plateforme | Une base PostgreSQL + URL REST + clé anon + **son plan** |

Règle d'or : **un managed account appartient à exactement une organisation**. Aucune lecture inter-organisation, jamais.

## 3. Six principes non négociables

1. **Zéro inscription côté utilisateur final.** L'API doit créer un compte fonctionnel avec la seule clé de la plateforme. Aucun e-mail, mot de passe ou vérification n'est une condition d'usage.
2. **Délégation explicite.** La plateforme agit « pour » un compte via un identifiant de compte dans la requête, jamais en se faisant passer pour l'utilisateur (pas d'impersonation de session).
3. **Idempotence partout.** Chaque mutation accepte `Idempotency-Key` et renvoie la même réponse en cas de rejeu. Les plateformes réessaient après une coupure réseau ; un doublon de base de données est inacceptable.
4. **Moindre privilège.** La clé de plateforme ne peut pas lire les autres organisations ni les tables d'exploitation. Le client embarqué ne reçoit **jamais** de clé `service_role`, seulement une clé anon par projet.
5. **Attribution obligatoire.** Chaque ligne écrite via l'API enregistre `organization_id`, `client_id`, `managed_account_id`, et si fourni `external_user_id` (l'identifiant de l'utilisateur chez la plateforme).
6. **La console web reste optionnelle et non destructive.** Ce qu'on peut faire depuis l'API doit pouvoir l'être depuis l'UI, et inversement. Aucune opération API ne doit être bloquée faute de consentement web.

## 4. Authentification et autorisation

| Acteur | Mécanisme | Portée |
| --- | --- | --- |
| Plateforme (serveur) | `Authorization: Bearer <platform_api_key>` (par organisation + environnement) ou OAuth `client_credentials` pour un jeton court | Créer/lire/modifier ses propres managed accounts et projets |
| Client embarqué (IDE, app) | Clé anon **par projet**, émise par l'API | `/rest/v1/*` uniquement, RLS par projet |
| Utilisateur final (optionnel) | Session Kuunda Cloud classique (email/OAuth) | Ne voit que les comptes revendiqués |

En-têtes attendus en plus du Bearer : `X-Kuunda-Organization`, `X-Kuunda-Client`, `X-External-User-Id` (facultatif).

**Revendication (« claim ») :** un managed account créé par une organisation doit pouvoir être rattaché plus tard à un utilisateur réel, sans migration de données ni perte de projets.

## 5. Endpoints à implémenter

Tous sous `/v1`, en JSON, avec erreurs stables.

### Organisation et comptes

| Méthode | Route | Rôle |
| --- | --- | --- |
| `POST` | `/v1/orgs/{orgId}/accounts` | Crée un managed account. Corps : `{ externalUserId?, displayName?, planId?, env? }`. Idempotent sur `(orgId, externalUserId)` |
| `GET` | `/v1/orgs/{orgId}/accounts` | Liste paginée des comptes de l'organisation |
| `GET` | `/v1/orgs/{orgId}/accounts/{accountId}` | Détail : plan global, nombre de projets, statut |
| `POST` | `/v1/orgs/{orgId}/accounts/{accountId}/claim` | Rattache le compte à un utilisateur Kuunda Cloud (e-mail/OAuth) |

### Projets (bases)

| Méthode | Route | Rôle |
| --- | --- | --- |
| `POST` | `/v1/accounts/{accountId}/projects` | Crée la base. Corps : `{ name, type, planId, env, repoUrl?, externalProjectId? }`. Renvoie `{ projectRef, url, anonKey, planId }`. Idempotent sur `(accountId, externalProjectId \|\| name)` |
| `GET` | `/v1/accounts/{accountId}/projects` | Inventaire : `projectRef`, `name`, `type`, `plan`, `env`, `url`, `repoUrl`, `status` (`active`/`archived`), `createdAt` |
| `PATCH` | `/v1/accounts/{accountId}/projects/{ref}` | Renomme / re-tague sans toucher aux données |
| `POST` | `/v1/accounts/{accountId}/projects/{ref}/archive` | Archive : la base reste récupérable, l'URL cesse de répondre |
| `POST` | `/v1/accounts/{accountId}/projects/{ref}/restore` | Restaure une base archivée |
| `DELETE` | `/v1/accounts/{accountId}/projects/{ref}` | Destruction définitive, sur double confirmation explicite (`?confirm=ref`) |
| `POST` | `/v1/accounts/{accountId}/projects/{ref}/credentials/rotate` | Nouvelle clé anon, l'ancienne invalidée |

### Plans et facturation

| Méthode | Route | Rôle |
| --- | --- | --- |
| `GET` | `/v1/plans` | Catalogue : `{ id, name, price: { amount, currency }, limits }` |
| `PUT` | `/v1/accounts/{accountId}/projects/{ref}/plan` | Change le plan **du projet**. Corps `{ planId }`. Renvoie `{ planId, status, checkoutUrl? }` si paiement requis |
| `GET` | `/v1/accounts/{accountId}/usage` | Consommation agrégée + par projet |

### Liaison multi-appareils (sans compte web)

| Méthode | Route | Rôle |
| --- | --- | --- |
| `POST` | `/v1/accounts/{accountId}/link/start` | Renvoie un `code` court (ex. `AB12-CD34`), valable 10 min |
| `POST` | `/v1/accounts/link/claim` | Corps `{ code }` → `{ accountId }`. Permet à un second appareil d'adopter le **même** compte, sans inscription |

## 6. Webhooks

À pousser vers la plateforme (HMAC signé, rejeu avec `eventId`) :

- `project.created`, `project.updated`, `project.archived`, `project.restored`, `project.deleted`
- `project.plan_changed`, `project.quota_exceeded`
- `invoice.paid`, `invoice.failed`, `subscription.status_changed`
- `account.claimed`

Chaque événement doit porter `organizationId`, `accountId`, `projectRef` et un `occurredAt` ISO.

## 7. Règles de plans

- **Un plan par projet** est obligatoire : une organisation facture une plateforme, mais chaque base a son propre niveau.
- Un changement de plan vers un palier payant peut renvoyer `checkoutUrl` (paiement hébergé) ; vers un palier gratuit, il s'applique immédiatement.
- Le serveur reste **autorité** : toute modification de plan côté API doit être reflétée par `GET /projects` et par un webhook.
- Prorata et rétrogradation doivent avoir la même sémantique que la console web.
- Un projet en plan dépassé doit passer `status: restricted` plutôt que d'être supprimé.

## 8. Quotas, limites et erreurs

| Cas | Réponse |
| --- | --- |
| Rejeu idempotent | `200` avec la réponse d'origine (jamais un second projet) |
| Quota d'organisation atteint | `429` + `Retry-After`, corps `{ error: "org_quota_exceeded" }` |
| Paiement requis | `402` + `{ error: "payment_required", checkoutUrl }` |
| Clé invalide / expirée | `401` + `{ error: "invalid_api_key" }` |
| Compte hors périmètre | `403` + `{ error: "account_not_owned" }` — jamais de fuite d'existence |
| Projet introuvable | `404` + `{ error: "project_not_found" }` |

Rate limits par clé de plateforme, en-têtes `X-RateLimit-*` systématiques.

## 9. Sécurité et conformité

- RLS activée sur chaque table portant `account_id` / `organization_id`.
- Clé anon par projet, révocable et rotative ; aucune clé `service_role` ne quitte le Worker.
- Journaux d'audit immuables : qui (organisation, client, IP), quoi, quand, sur quel projet.
- Effacement RGPD : suppression d'un managed account = suppression en cascade de ses projets + clés, avec preuve d'exécution.
- Export : la plateforme doit pouvoir exporter les données d'un projet (dump ou API paginée).

## 10. Ce que Kuunda Vibe fait déjà (à ne pas dupliquer)

Côté client, cette logique est déjà implémentée et testée :

- compte principal auto `kva_<uuid>` envoyé comme `accountId` **et** `ownerId` ;
- `POST /v1/provisioning/projects` avec `{ accountId, ownerId, displayName, projectType, planId, repoUrl, env, userId? }` pour l'instant pointé sur `/v1/provisioning/*` ;
- synchro d'inventaire push + pull toutes les 60 s (`syncProjects`) ;
- plan par projet, archivage récupérable, restauration ;
- liaison multi-machines par code court, localisation du code via `cloud.repo`.

**Migration déjà entamée côté client :** Kuunda Vibe appelle désormais les routes de la spec `/v1/accounts/{accountId}/…` **en priorité**, avec repli automatique sur les routes legacy (`/v1/provisioning/*`, `/v1/account/*`) tant qu'elles répondent `404`/`501`. Le choix est mémorisé 10 minutes par famille de routes, et une famille déjà servie par la spec ne repasse jamais en legacy sur un `404` de ressource. Conséquence directe pour vous :

- **Implémenter les routes de la spec suffit** — aucun changement de client ne sera nécessaire le jour où elles répondent.
- **Une seule voie doit survivre.** Quand les routes `/v1/accounts/…` sont en production, prévenez-nous : la branche legacy est retirée en un point unique (`requestSpecOrLegacy`) et les anciennes routes peuvent être dépréciées après une fenêtre de recouvrement. Nous ne décidons pas à l'aveugle : le client compte, par famille de routes et de façon **persistante**, les appels servis par la spec et ceux servis par le legacy (commande `kuunda.cloud.routes`, réglage `kuunda.cloud.legacyRoutes` = `auto` | `off`). Quand chaque famille affiche `spec>0` et `legacy=0`, la suppression du legacy est prouvée — et un test en `off` (aucun appel legacy autorisé) est la vérification directe que la spec est complète.
- **Route manquante dans la spec :** les tables du projet n'ont pas d'équivalent `accounts`. Le client interroge `GET /v1/accounts/{accountId}/projects/{ref}/tables` puis retombe sur le legacy. Merci de confirmer cette forme (ou d'en proposer une) pour qu'elle rejoigne la spec.

## 11. Critères d'acceptation

- [ ] Créer un managed account et un projet avec la seule clé de plateforme, sans aucune inscription.
- [ ] Rejouer chaque création 5 fois avec la même `Idempotency-Key` → un seul compte, un seul projet.
- [ ] Lire l'inventaire d'un compte et retrouver `plan`, `status`, `repoUrl` exacts.
- [ ] Archiver puis restaurer un projet : les données sont intactes, l'URL redevient active.
- [ ] Changer le plan d'un projet par API → répercuté dans `GET /projects` et par webhook.
- [ ] Faire adopter le même compte par un second appareil via `link/start` + `link/claim`.
- [ ] Une clé d'organisation A ne peut rien lire de l'organisation B (`403` sans fuite).
- [ ] Webhooks signés, rejouables, avec `eventId` stable.
- [ ] Aucune route appelée par Kuunda Vibe ne renvoie `404`/`501` : après quelques jours d'usage réel en `kuunda.cloud.legacyRoutes: off`, `kuunda.cloud.routes` affiche `spec>0` et `legacy=0` pour **toutes** les familles (création, inventaire, archivage/restauration, plan, tables, plans, link).

## 12. Hors périmètre

- Hébergement de code : le code source reste chez la plateforme / git, jamais dans Kuunda Cloud.
- Impersonation de session utilisateur : la délégation passe par `accountId`, pas par un jeton utilisateur.
- Console web pour utilisateurs finaux : elle reste optionnelle, uniquement pour la revendication.
