# 08 — Sécurité et fiabilité avant production

**Phase :** 8
**Validation steward :** validée (steward, 17 sept. 2026)
**Prérequis :** Phase 7 validée (17 sept. 2026)

Phase de durcissement. Pas de packaging. Les appels externes ont un timeout, les secrets restent hors git, le shell agent demande confirmation par défaut.

## Choix techniques

| Choix | Pourquoi |
| --- | --- |
| `productionAdjacent` défaut `true` | 8.4 : jamais d'auto-exécution shell, même si Void `autoApprove.terminal` est coché |
| `fetchWithTimeout` 15 s | 8.3 : AbortController, codes opaques `timeout` / `offline` / `http` |
| Audit `auditCredentialStorage` | 8.1 : gitignore obligatoire + persistables sans `private_key` / Genius Pay |
| `rewritePersistentShell` fail-closed | `cd` / `CD` / `pushd` / `&` / `||` hors workspace refusés ; un `cd` illisible est refusé |
| Auth session | Voir Phase 11 (`kuundaAccount`) |

## Livrables

| Id | Comportement | Où |
| --- | --- | --- |
| 8.1 Audit credentials | Agent BYOK = settings Void ; Cloud = `.env.local` gitignoré ; stores = `.p8` / JSON / keystore gitignorés ; Genius Pay = dépôt privé uniquement | `credential-policy` + `.gitignore` |
| 8.2 Non-régression | Agent, diffs/hunks, publishing, billing restent verts | `kuunda-ai.test.mjs` Phase 8.2 |
| 8.3 Réseau | Timeout 15 s ; timeout/offline **ne** simulent **pas** un job `pending_ci` ; Cloud HTTP 501 reste `pending_api` | `network-policy` + `fetchWithTimeout` |
| 8.4 Production-adjacent | Shell `confirm` obligatoire ; F1 `kuunda.agent.setProductionAdjacent` pour bac à sable local ; `cd` persisté validé | `decideToolPermission` + `rewritePersistentShell` |

## Isolation

- Algorithmes : `packages/kuunda-ai` (`credential-policy.js`, `network-policy.js`, `permissions.js`, `terminal-access.js`)
- Contrats HTTP : `packages/cloud-client` (timeout, toujours sans secret)
- Branchement : contribs existants `kuundaAi` / `kuundaBilling` / `kuundaCloud` / `kuundaPublish` — **pas** de nouveau contrib
- Accroche Void : `chatThreadService` (notice Arowtech) passe `productionAdjacent` et réécrit `run_persistent_command`

## Frontière public / privé

| Public | Privé |
| --- | --- |
| Audit gitignore + persistables IDE | Custody Genius Pay, operator, `GITHUB_DISPATCH_TOKEN` (wrangler secret) |
| Timeout des appels `api.ide.kuunda-cloud.com` | Helper outbound Worker + tests d'audit des fichiers privés |
| UI confirmation shell | Pas de logique tarifaire ni HMAC |

## Hors de portée

- Phase 10 post-lancement (livrée à part)
- `wrangler deploy`
- Application SQL 0004
