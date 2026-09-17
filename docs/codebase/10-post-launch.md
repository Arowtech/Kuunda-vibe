# 10 — Itération post-lancement

**Phase :** 10  
**Validation steward :** en cours  
**Prérequis :** Phase 9 (packaging interne) implémentée

Canal de retours structuré, priorisation des évolutions à partir de **ces rapports**, Dependabot + playbook de rebase vscode. **Pas** de télémétrie d’usage silencieuse. **Pas** de rebase automatique. **Pas** de `wrangler deploy`. **Pas** de release publique.

## Livrables

| Id | Comportement | Où |
| --- | --- | --- |
| 10.1 Feedback | Canal dédié opt-in F1 ; hors-ligne strict coupe ; pas de workspace ; secrets/dumps refusés | `kuundaFeedback` + `POST /v1/feedback` |
| 10.2 Priorisation | Score crash > bug > feature > docs selon les rapports, pas un tracker | `prioritizeBacklog` / `feedback-plane` |
| 10.3 Upstream | Dependabot weekly ; plan de rebase vscode/void **sans** l’exécuter | `scripts/kuunda-upstream/`, `.github/workflows/kuunda-upstream.yml` |

## Isolation

- Algorithmes : `packages/kuunda-ai/src/post-launch-policy.js`
- UI : `src/vs/workbench/contrib/kuundaFeedback/`
- Inbox privée : `packages/feedback-plane` (dépôt privé)
- Contrat public : `IFeedbackClient.submitFeedback`

## Contrôles fail-closed (10.1)

- `consent === true` uniquement (`'true'` / `1` ne suffisent pas)
- `includeWorkspace` et `telemetry` refusés même si `'true'` / `1`
- Détection secrets (BYOK, GitHub, JWT, `service_role`, …) et dumps (`.kuunda/`, `.p8`, trop de lignes)
- Qualité client hors `internal`/`staging` recodée en `internal` (pas de `stable` auto-déclaré)
- `usage_telemetry` toujours refusé par `decideExternalSend`
- Ingest privé : Origin allowlist + 5/min/IP + cap 200 tickets mémoire ; backlog opérateur token + rate-limit

## Playbook rebase vscode (10.3, manuel)

1. `node scripts/kuunda-upstream/plan.mjs <jours>` — refuse `autoRebase` / `forcePush`
2. Branche locale `sync/vscode-YYYY-MM`
3. Fetch `microsoft/vscode` et `voideditor/void`
4. Rebase **local** ; jamais `--force` sur `main`
5. Relancer `npm test` public + privé
6. Attendre la validation steward avant merge

Le workflow `kuunda-upstream` imprime le plan (`contents: read`) et ne rebase pas.

## Hors de portée

- Lancer une télémétrie diagnostic (VS Code/Void reste un réglage séparé)
- Rebase réel de `microsoft/vscode` / `voideditor/void`
- `wrangler deploy`, paiements live, diffusion `stable`
- Compile Electron
- Persistence SQL de l’inbox (store mémoire d’isolate, comme le ledger de tests)
