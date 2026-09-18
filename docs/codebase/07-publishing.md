# 07 — Pipeline de publication mobile

**Phase :** 7
**Validation steward :** validée le 17 sept. 2026
**Prérequis :** Phase 6 validée (17 sept. 2026)

Les projets **mobile** publient vers Google Play et/ou App Store depuis un panneau dédié. L'UI et l'orchestration vivent dans le dépôt public. Les JSON Play, clés `.p8`, keystores et jetons GitHub restent gitignorés ou dans les secrets CI du dépôt privé.

## Choix techniques

| Choix | Pourquoi |
| --- | --- |
| Credentials copiés sous `.kuunda/` gitignoré | L'API ne reçoit que des drapeaux + métadonnées, jamais le secret store |
| `POST /v1/publishing/jobs` (userId + Bearer de session) | Identité Studio (Phase 11) |
| `resolveGitHubRunner` (0bis.4) | Android = `ubuntu-latest`, iOS = `macos-latest` ; self-hosted plus tard sans changer la facturation |
| Dry-run `pending_ci` si `GITHUB_DISPATCH_TOKEN` absent | Pas d'invention de dispatch GitHub, pas de binaire AAB/IPA fictif |
| Contrib isolé `kuundaPublish/` | Pas de mélange avec le cœur VS Code / Void |

## Livrables

| Id | Comportement | Où |
| --- | --- | --- |
| 7.1 Config credentials | F1 Play JSON / `.p8` + keyId/issuerId ; copies gitignorées | `configurePlay` / `configureAppStore` |
| 7.2 Builds natifs | Workflow `.github/workflows/kuunda-publish.yml` + runners hébergés via l'API privée | `scaffoldPublishFiles` + `publisher.js` |
| 7.3 Bouton Publier | F1 `kuunda.publish.start` + logs/progression dans le panneau | `startPublish` |
| 7.4 Échecs lisibles | `not_mobile`, `no_targets`, `incomplete_metadata`, `missing_credentials`, `missing_signature`, `runner_unavailable` | `decidePublish` |
| 7.5 Panneau sidebar | Visible seulement si `manifest.type === 'mobile'` (`kuunda.publish.visible`) | `kuundaPublish.contribution.ts` |

## Fichiers locaux (gitignorés)

| Chemin | Contenu |
| --- | --- |
| `.kuunda/publish.local.json` | version, packageId, drapeaux, email Play, keyId/issuerId — **pas** de `private_key` |
| `.kuunda/play-service-account.json` | JSON Play copié |
| `.kuunda/authkey.p8` | clé App Store Connect copiée |
| `.kuunda/upload.keystore` | keystore Android copié |

`.kuunda/project.json` ne contient toujours que le type et les cibles (`google_play` / `app_store`).

F1 : `kuunda.publish.showPanel`, `kuunda.publish.configurePlay`, `kuunda.publish.configureAppStore`, `kuunda.publish.configureSignature`, `kuunda.publish.setMetadata`, `kuunda.publish.start`.

`publish.status` (API extensions, permission `kuundaPublish`) : `{ available: true, visible, jobStatus?, targets? }` — jamais de clé.

## Frontière public / privé

| Public (`Arowtech/Kuunda-vibe`) | Privé (`Arowtech/kuunda-vibe-cloud`) |
| --- | --- |
| Panneau, F1, gitignore, client HTTP, politique `decidePublish` | Jobs, `resolveGitHubRunner`, SQL `platform_publish_jobs` |
| Drapeaux `googlePlayConfigured` / `appStoreConfigured` | `GITHUB_DISPATCH_TOKEN` (wrangler secret, optionnel) |

Sans jeton dispatch, l'API crée un job `pending_ci` avec le log `build_not_dispatched`. Elle n'invente pas d'artefact AAB/IPA.

## Isolation

- Algorithmes : `packages/kuunda-ai/src/publish-policy.js`
- Contrats : `packages/cloud-client` (`IPublishClient`)
- Branchement : `src/vs/workbench/contrib/kuundaPublish/`
- Accroche agent : `convertToLLMMessageService` ajoute `formatPublishContext` (sans secret)

## Hors de portée

- Auth session réelle (toujours 501 ; userId-in-body comme 3bis/6)
- Application SQL 0004 / `wrangler deploy` / dispatch GitHub réel
- Upload réel vers Google Play Console ou App Store Connect
- Phase 9 (packaging / signature / auto-update)
