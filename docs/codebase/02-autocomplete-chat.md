# 02 — Complétion et édition assistée

**Phase :** 2
**Validation steward :** en cours
**Prérequis :** Phase 1 validée (17 sept. 2026)

Cette phase ajoute la parité Cursor « niveau 1 » **sans** réécrire `contrib/void` (rebase). L'agent autonome est la Phase 3.

## Livrables

| Id | Comportement | Où |
| --- | --- | --- |
| 2.1 Tab multi-ligne | `decideAutocompleteMode` dans `kuundaAi` pilote `autocompleteService` ; `enableAutocomplete: true` | `packages/kuunda-ai` + `contrib/kuundaAi` + accroche Void |
| 2.2 Ctrl+K | UI Void (Ctrl/Cmd+K) + hunks accept/reject ; apply partiel `applyAcceptedHunks` | `inlineEdit` / `streamingDiff` |
| 2.3 @Codebase | Index BM25 ; mention `@codebase` ; hits + extraits dans le system prompt | `kuundaCodebaseService` + `inputs.tsx` + `convertToLLMMessageService` |
| 2.4 Diffs streaming | `extractApplyBlocks` : ORIGINAL/FINAL Void, sinon SEARCH/REPLACE Cursor | `editCodeService` via `kuundaAi` |

## Isolation

- Algorithmes testables : `packages/kuunda-ai` (JS ESM, 0 dépendance, Apache-2.0 Arowtech).
- Branchement IDE : `src/vs/workbench/contrib/kuundaAi/` (comme `kuundaBrand`).
- `contrib/void` : notices `Modified 2026-09-17 by Arowtech` uniquement sur les points d'accroche.

LLM : toujours via le canal electron-main Void. Pas de clé dans le dépôt. Facturation / crédits = Phase 3bis (dépôt privé).

## Hors de portée

- Agent tools / checkpoints (Phase 3)
- Ledger GeniusPay (3bis)
- Embeddings hébergés Kuunda Cloud (peut remplacer BM25 plus tard sans changer l'interface `search`)
