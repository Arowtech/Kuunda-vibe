# 03 — Agent autonome (parité Cursor niveau 2)

**Phase :** 3
**Validation steward :** validée le 17 sept. 2026 (ouverture 3bis).
**Prérequis :** Phase 2 validée (17 sept. 2026)

Void fournit déjà la boucle tool-use, l'édition multi-fichiers via `EditCodeService` / `VoidModelService`, les providers BYOK, et MCP. Cette phase **ne réécrit pas** `contrib/void` : elle ajoute la politique Kuunda (permissions, compactage, jobs d'arrière-plan) dans un module isolé.

## Livrables

| Id | Comportement | Où |
| --- | --- | --- |
| 3.1 Boucle outil → observation → action | `planAgentTurn` / `planAfterTool` **pilote** `_runChatAgent` | `packages/kuunda-ai` + `chatThreadService` |
| 3.2 Multi-fichiers, multi-étapes | Outils Void `edit_file` / `rewrite_file` / create ; plafond `MAX_AGENT_STEPS` (48) | `agent-loop` + accroche Void |
| 3.3 Permissions à 4 niveaux | `allow` / `confirm` / `review` / `refuse`. Delete = review. Terminal = confirm. MCP = confirm. Overrides persistés ; commande F1 `kuunda.agent.setPermission` | `permissionPolicy` → `_runToolCall` + `IKuundaAgentService` |
| 3.4 Contexte long | Compactage avec `contextBudgetChars` (fenêtre modèle) **avant** le trim Void | `compactChatContext` → `convertToLLMMessageService` |
| 3.5 Multi-provider BYOK | Anthropic, OpenAI, Gemini + Ollama exposés via `supportedProviders` (clés dans les settings Void) | `agentProviders` + `kuundaAgentService` |
| 3.6 Agent arrière-plan | F1 `kuunda.agent.runBackground` : nouveau fil, retour au fil courant. Permission → notif sticky. Fin = `needs_review` + F1 `kuunda.agent.reviewJobs` | `kuundaAgentService` |
| 3.7 MCP | Conservé (Void `mcpService` + onglet Settings). Permission MCP = confirm sauf autoApprove | wiring tests |

## Isolation

- Algorithmes testables : `packages/kuunda-ai` (JS ESM, 0 dépendance, Apache-2.0 Arowtech).
- Branchement IDE : `src/vs/workbench/contrib/kuundaAi/` (même contrib que la Phase 2).
- `contrib/void` : notices `Modified 2026-09-17 by Arowtech` uniquement sur `chatThreadService` et `convertToLLMMessageService`.

LLM : toujours via le canal electron-main Void. Pas de clé dans le dépôt.

## Hors de portée

- Crédits / Genius Pay / ledger (Phase 3bis, dépôt privé)
- Terminal « accès agent » étendu et `.projectrules` (Phase 4)
- Confirmation shell renforcée production-adjacent (Phase 8 affine 3.3 ; le défaut terminal n'est **pas** auto-approve)
