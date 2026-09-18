# 06 — Kuunda Cloud par défaut

**Phase :** 6
**Validation steward :** validée le 17 sept. 2026
**Prérequis :** Phase 5 validée (17 sept. 2026)

Chaque **nouveau projet** Kuunda Vibe reçoit une instance Kuunda Cloud (PostgreSQL) par défaut. Désactivation et remplacement restent possibles. Aucune clé opérateur / `service_role` n'entre dans le dépôt public ni dans git.

## Choix techniques

| Choix | Pourquoi |
| --- | --- |
| Provisioning `POST /v1/provisioning/projects` (userId + Bearer de session Studio) | Identité Studio (Phase 11) obligatoire pour lier la base ; pas d’ID de facturation saisi à la main |
| `.env.local` + `.kuunda/cloud.local.json` gitignorés | Secret projet ≠ secret opérateur ; jamais commité |
| Client `src/kuunda/client.js` avec `<SET VIA SECRET STORE>` | CRUD `items` prêt à l'emploi sans jeton fictif qui ressemble à un vrai |
| Mapping `platform_provisioned_projects` dans le dépôt privé | Idempotence user+nom ; SQL 0003 **non appliqué** tant que le steward ne l'a pas demandé |
| Contrib isolé `kuundaCloud/` | Pas de mélange avec le cœur VS Code / Void |

## Livrables

| Id | Comportement | Où |
| --- | --- | --- |
| 6.1 Auto-provision | Après `kuunda.project.create`, appel plateforme ; sans session Studio → `pending_user` ouvre la création de compte ; échec réseau ≠ échec de création (`pending_api`) | `IKuundaCloudService.provisionFolder` |
| 6.2 Credentials projet | URL + anon key (placeholder tant que l'opérateur réel n'émet pas) dans fichiers gitignorés ; `project.json.cloud` sans secret | `scaffoldCloudFiles` |
| 6.3 CRUD | `listItems` / `createItem` via `/rest/v1/items` | `src/kuunda/client.js` |
| 6.4 Panel | Vue sidebar + F1 `kuunda.cloud.showPanel` (tables seed, pas de clés) | `kuundaCloud.contribution.ts` |
| 6.5 Réversible | ON par défaut ; F1 Enable / Disable / Replace | `setEnabled` / `replace` |

## Manifeste (extrait public)

```json
{
  "cloud": {
    "enabled": true,
    "projectRef": "proj_ab",
    "env": "sandbox",
    "url": "https://proj-ab.kuunda-cloud.com"
  }
}
```

F1 : `kuunda.cloud.provision`, `kuunda.cloud.enable`, `kuunda.cloud.disable`, `kuunda.cloud.replace`, `kuunda.cloud.showPanel`.

Sans session Studio, **provision / enable / create** ouvre le Studio en mode **création de compte** (`kuunda.account.openStudio` `{ intent: 'signUp', reason: 'cloud' }`). Après inscription, `retryUnlinkedFolders` rattache le sandbox à cet IDE. L’agent gère le sandbox ; la promotion vers la production se fait dans le dashboard Kuunda Cloud, pas depuis l’IDE.

`cloud.status` (API extensions, permission `kuundaCloud`) : `{ available: true, enabled, projectRef, env }` — jamais de clé.

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
- Accroche wizard : `kuundaProject.contribution` appelle `provisionFolder` après create ; `pending_user` ouvre le Studio
- Accroche session : `kuundaCloud.contribution` réessaie le provisionnement dès qu’une session Studio existe
- Accroche agent : `convertToLLMMessageService` ajoute `formatCloudContext` (sandbox autonome, prod = promotion utilisateur, sans secret)

## Hors de portée

- Application SQL 0003 / `wrangler deploy`
- Clés anon émises par un vrai control-plane Kuunda Cloud (MCP opérateur indisponible)
- Publication store (Phase 7, voir `07-publishing.md`)
