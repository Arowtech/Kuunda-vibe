# 06 — Kuunda Cloud par défaut

**Phase :** 6
**Validation steward :** validée le 17 sept. 2026
**Prérequis :** Phase 5 validée (17 sept. 2026)

Un **compte principal Kuunda Vibe** (`kva_<uuid>`, créé automatiquement à l’installation) centralise **tous** les projets créés dans l’IDE. Chaque projet reçoit son instance Kuunda Cloud (PostgreSQL), son plan, et l’inventaire est réconcilié automatiquement entre Kuunda Vibe et Kuunda Cloud. Ni inscription, ni compte web ne sont jamais requis. Désactivation, remplacement et archivage restent possibles. Aucune clé opérateur / `service_role` n'entre dans le dépôt public ni dans git.

## Choix techniques

| Choix | Pourquoi |
| --- | --- |
| Compte principal `kva_<uuid>` généré et persisté localement, envoyé comme `accountId`/`ownerId` | Aucune inscription : l’IDE possède son compte et la plateforme y rattache chaque projet |
| Provisioning `POST /v1/provisioning/projects` (accountId + Bearer si session) | Le `userId` de session n’est qu’un indice d’attribution, jamais une condition |
| Plan par projet (`standard` par défaut), géré dans les réglages de l’IDE | Un espace Cloud par projet, upgrade dans Kuunda Vibe sans passer par le site |
| `.env.local` + `.kuunda/cloud.local.json` gitignorés | Secret projet ≠ secret opérateur ; jamais commité |
| Client `src/kuunda/client.js` avec `<SET VIA SECRET STORE>` | CRUD `items` prêt à l'emploi sans jeton fictif qui ressemble à un vrai |
| Mapping `platform_provisioned_projects` dans le dépôt privé | Idempotence user+nom ; SQL 0003 **non appliqué** tant que le steward ne l'a pas demandé |
| Contrib isolé `kuundaCloud/` | Pas de mélange avec le cœur VS Code / Void |

## Livrables

| Id | Comportement | Où |
| --- | --- | --- |
| 6.1 Auto-provision | Après `kuunda.project.create`, appel plateforme avec `ownerId` anonyme ; jamais de `pending_user` lié au login ; échec réseau ≠ échec de création (`pending_api`) | `IKuundaCloudService.provisionFolder` |
| 6.2 Credentials projet | URL + anon key (placeholder tant que l'opérateur réel n'émet pas) dans fichiers gitignorés ; `project.json.cloud` sans secret | `scaffoldCloudFiles` |
| 6.3 CRUD | `listItems` / `createItem` via `/rest/v1/items` | `src/kuunda/client.js` |
| 6.4 Panel | Vue sidebar + F1 `kuunda.cloud.showPanel` (tables seed, pas de clés) | `kuundaCloud.contribution.ts` |
| 6.5 Réversible | ON par défaut ; F1 Enable / Disable / Replace | `setEnabled` / `replace` |
| 6.6 Plan | F1 `kuunda.cloud.plan` : catalogue `GET /v1/provisioning/plans`, upgrade `POST /v1/provisioning/projects/:ref/plan`, plan écrit dans `project.json.cloud.plan` ; barre d’état = plan courant | `listPlans` / `startPlanCheckout` / `setPlan` |
| 6.7 Réglages IDE | `kuunda.cloud.enabled` (auto-provisioning, défaut ON) et `kuunda.cloud.defaultPlan` (défaut `standard`) dans les Paramètres | contribution cloud |
| 6.8 Inventaire | F1 `kuunda.cloud.sync` + boucle 60 s : push des projets locaux sans espace Cloud, puis pull du plan/statut du serveur ; le compte reste la source de vérité pour le plan | `syncProjects` / `GET /v1/account/projects` |
| 6.9 Archivage | F1 `kuunda.cloud.archive` et `kuunda.cloud.projects` : suppression locale = archivage récupérable, jamais de destruction ; `restoreProject` remet l’espace en service | `archiveFolder` / `restoreProject` |
| 6.10 Multi-machines | F1 `kuunda.cloud.link` / `kuunda.cloud.adopt` : code court pour adopter le même compte ailleurs sans compte web | `linkAccount` / `adoptAccount` |
| 6.11 Source | `cloud.repo` déduit de `.git/config` (`parseGitRemote`), poussé en `repoUrl` et recopié au clone depuis l’inventaire | `readGitRemote` / `sanitizeRepoUrl` |

## Manifeste (extrait public)

```json
{
  "cloud": {
    "enabled": true,
    "projectRef": "proj_ab",
    "env": "sandbox",
    "url": "https://proj-ab.kuunda-cloud.com",
    "plan": "standard",
    "repo": "https://github.com/Arowtech/app"
  }
}
```

F1 : `kuunda.cloud.provision`, `kuunda.cloud.enable`, `kuunda.cloud.disable`, `kuunda.cloud.replace`, `kuunda.cloud.plan`, `kuunda.cloud.sync`, `kuunda.cloud.projects`, `kuunda.cloud.archive`, `kuunda.cloud.link`, `kuunda.cloud.adopt`, `kuunda.cloud.routes`, `kuunda.cloud.showPanel`.

Réglages : `kuunda.cloud.enabled`, `kuunda.cloud.defaultPlan`, `kuunda.cloud.legacyRoutes` (`auto` \| `off`).

**Aucune inscription Kuunda Cloud n’est demandée.** L’IDE possède un compte principal `kva_<uuid>` (généré une fois, persisté localement) sous lequel tous les projets sont centralisés. La plateforme crée automatiquement l’espace de chaque projet sur le plan `standard`, puis le plan peut être changé / upgradé projet par projet depuis l’IDE (`kuunda.cloud.plan`, barre d’état). `syncProjects` réconcilie l’inventaire au boot, à l’ouverture de dossier et toutes les 60 s : le serveur fait autorité sur le plan et le statut, l’IDE reste autoritaire sur les fichiers. La suppression est un **archivage récupérable** (`kuunda.cloud.archive`), jamais une destruction. L’agent gère le sandbox ; la promotion vers la production se fait dans le dashboard Kuunda Cloud, pas depuis l’IDE.

`cloud.status` (API extensions, permission `kuundaCloud`) : `{ available: true, enabled, projectRef, env, plan }` — jamais de clé.

## Compte principal & synchronisation (contrat plateforme)

Toutes les routes de la spec (voir `12-org-integration.md`) sont appelées **en premier** ; le repli legacy n’existe que le temps que la plateforme migre. Le choix est mémorisé 10 min (`ROUTE_PROBE_TTL`) : seuls `404`/`501` déclenchent le repli, et une famille de routes déjà utilisée avec succès ne repasse jamais en legacy sur un 404 de ressource.

| Rôle | Route spec (primaire) | Repli legacy (temporaire) |
| --- | --- | --- |
| Créer le projet | `POST /v1/accounts/{accountId}/projects` | `POST /v1/provisioning/projects` |
| Inventaire du compte | `GET /v1/accounts/{accountId}/projects` | `GET /v1/account/projects?accountId=…` |
| Archivage récupérable | `POST /v1/accounts/{accountId}/projects/{ref}/archive` \| `/restore` | `POST /v1/account/projects/{ref}/archive` \| `/restore` |
| Catalogue de plans | `GET /v1/plans` | `GET /v1/provisioning/plans` |
| Plan du projet | `PUT /v1/accounts/{accountId}/projects/{ref}/plan` | `POST /v1/provisioning/projects/{ref}/plan` |
| Liaison multi-machines | `POST /v1/accounts/{accountId}/link/start` · `POST /v1/accounts/link/claim` | `POST /v1/account/link/start` · `/v1/account/link/claim` |
| Tables du projet | `GET /v1/accounts/{accountId}/projects/{ref}/tables` *(proposée, pas encore dans la spec)* | `GET /v1/provisioning/projects/{ref}/tables` |

Corps envoyé à la création : `{ accountId, ownerId, displayName, projectType, planId, repoUrl, env: 'sandbox', userId? }` ; la réponse porte `planId`. L’inventaire renvoie `projectRef`, `name`, `type`, `plan`, `env`, `url`, `repoUrl`, `status` (`active` \| `archived`).

**Une seule voie doit survivre — et on sait quand, avec preuve.** Chaque appel passe par `requestSpecOrLegacy`, qui compte les réponses par famille dans un rapport (`routeReport()`), persisté dans le stockage profil sous `kuunda.cloud.routeEvidence` : les compteurs **survivent aux redémarrages**, donc la preuve n’est pas limitée à une session.

- `kuunda.cloud.routes` (F1) liste les familles : `spec=n legacy=m last=…`, avec les deux routes concernées ; sélectionner une famille affiche son rapport détaillé, et la dernière entrée remet les compteurs à zéro (`resetRouteEvidence`).
- Le panneau Cloud affiche la même ligne de synthèse (`routes: spec=… legacy=… mode=… (…)`).
- `legacyRemovable` n’est vrai que si **toutes** les familles ont au moins un appel servi par la spec et **aucun** appel legacy : c’est le critère de suppression de la branche legacy de `requestSpecOrLegacy` et des routes de la colonne droite. Des familles « unexercised » gardent le verdict à « not yet » — le doute n’est jamais compté comme une preuve.
- Réglage `kuunda.cloud.legacyRoutes` : `auto` (défaut) autorise le repli ; `off` n’appelle **jamais** une route legacy, donc une route de spec manquante remonte comme une erreur réelle au lieu d’être masquée. `off` est le mode à utiliser pour prouver la disparition du legacy : un succès en `off` est une preuve directe.

**Limites traitées** (au lieu d’être laissées ouvertes) :

- **Le code ne voyage pas par Kuunda Cloud.** L’enregistrement du projet porte `cloud.repo` (remote `origin` lu dans `.git/config`, normalisé https) : sur une nouvelle machine, `kuunda.cloud.projects` copie l’URL à cloner. Le code se synchronise donc par git, pas par la base.
- **Migration de routes en cours.** Le client appelle déjà `/v1/accounts/{accountId}/…` en priorité avec repli legacy, et le compteur de `kuunda.cloud.routes` dit quand le repli peut être supprimé ; voir le tableau des routes ci-dessus.
- **Multi-machines sans compte web.** `kuunda.cloud.link` émet un code court depuis la machine d’origine ; `kuunda.cloud.adopt` le saisit ailleurs, adopte le même `kva_…` et relance la synchro. Aucun formulaire d’inscription n’est nécessaire.

## Frontière public / privé

| Public (`Arowtech/Kuunda-vibe`) | Privé (`Arowtech/kuunda-vibe-cloud`) |
| --- | --- |
| Injection projet, panel, client HTTP | Opérateur, mapping, seed SQL `items` |
| Placeholder `<SET VIA SECRET STORE>` | `KUUNDA_OPERATOR_URL` / `KUUNDA_OPERATOR_TOKEN` (wrangler secret, optionnel au boot) |

Sans opérateur configuré, l'API alloue un `proj_*` + URL `https://proj-{hex}.kuunda-cloud.com` (underscore de la ref converti en tiret DNS) et renvoie le placeholder. Elle n'invente pas de `kuunda_anon_…`.

## Isolation

- Algorithmes : `packages/kuunda-ai/src/cloud-provision.js`
- Contrats : `packages/cloud-client` (`IKuundaProvisioningClient`)
- Branchement : `src/vs/workbench/contrib/kuundaCloud/`
- Accroche wizard : `kuundaProject.contribution` appelle `provisionFolder` après create (compte principal, sans Studio)
- Accroche synchronisation : `kuundaCloud.contribution` réconcilie l’inventaire au boot, à l’ouverture de dossier et toutes les 60 s (sans exiger de session Studio)
- Accroche agent : `convertToLLMMessageService` ajoute `formatCloudContext` (sandbox autonome, prod = promotion utilisateur, sans secret)

## Hors de portée

- Application SQL 0003 / `wrangler deploy`
- Clés anon émises par un vrai control-plane Kuunda Cloud (MCP opérateur indisponible)
- Publication store (Phase 7, voir `07-publishing.md`)
