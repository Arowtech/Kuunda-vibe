# 04 — Outils de développement intégrés

**Phase :** 4
**Validation steward :** validée le 17 sept. 2026
**Prérequis :** Phase 3bis validée (17 sept. 2026)

Void / Code - OSS fournissent déjà le terminal intégré, SCM Git et les workspaces multi-root. Cette phase **ne réécrit pas** ces surfaces : elle ajoute la politique Kuunda (cwd agent, git multi-repo dans le prompt, `.projectrules`).

## Livrables

| Id | Comportement | Où |
| --- | --- | --- |
| 4.1 Terminal + accès agent | Cwd borné (canonicalise `../` ; `api` vise le dossier `api`) ; refus **avant** la confirmation F1 ; terminaux persistants `Kuunda Agent` (id 2+ restaurés) ; `kuunda.terminal.setAccess` (confirm par défaut) | `terminal-access` + `chatThreadService` + `terminalToolService` |
| 4.2 Git complet | Branche / stat / log / porcelain untracked par racine SCM + dossiers ; ignore la ligne `##` du `-b` ; F1 `kuunda.git.showStatus` | `git-snapshot` + `IVoidSCMService.gitStatus` |
| 4.3 Multi-root | Plus d'un dossier listé ; cwd/path vers le dossier le plus spécifique | `workspace-roots` |
| 4.4 `.projectrules` | `.projectrules`, `.kuunda/rules`, `.voidrules` (disque + éditeur ouvert) ; `rulesReady` invalidé dès qu'un modèle change | `project-rules` + `IKuundaWorkspaceService` |

## Isolation

- Algorithmes : `packages/kuunda-ai` (JS ESM).
- Branchement : `src/vs/workbench/contrib/kuundaAi/` (`kuundaWorkspaceService`).
- Accroches Void (notice Arowtech) : `chatThreadService`, `convertToLLMMessageService`, `terminalToolService`, `voidSCMMainService`, `prompts.ts`.

## Hors de portée

- API d'extensions propriétaire (Phase 4bis)
- `cd` / redirection dans le shell d'un terminal déjà ouvert (Phase 8 affine 3.3)
- Auth session / ledger SQL (ouverts depuis 0bis / 3bis)
