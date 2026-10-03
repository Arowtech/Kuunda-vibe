# 08bis — Conformité et légal (avant Phase 9)

**Phase :** 8bis  
**Validation steward :** validée (steward, 17 sept. 2026)  
**Prérequis :** Phase 8 (sécurité / fiabilité) implémentée. A **levé** le packaging interne (Phase 9). Paiements live et dépôts stores restent bloqués.

Ce n’est pas du packaging. C’est la porte légale : RGPD / équivalents, politiques utilisateur, stores, hors-ligne strict, agrégateurs de paiement remplaçables, frontière licence.

## Livrables

| Id | Comportement | Où |
| --- | --- | --- |
| C1 RGPD / local | Analyse rôles, bases, KYC PSP | `docs/legal/GDPR-AND-LOCAL.md` |
| C2 Privacy + ToS | Politiques IDE + paiements | `PRIVACY-POLICY.md`, `TERMS-OF-USE.md` |
| C3 Stores | Play / App Store IA, SDK, IAP | `STORE-REQUIREMENTS.md` |
| C4 Divulgation UI | Panneau local vs tiers | `kuundaLegal` F1 `showPanel` |
| C5 Hors ligne strict | Coupe crédits, cloud, publish, LLM cloud (chat **et** Tab / Ctrl+K / commit), MCP ; Ollama OK | `decideExternalSend` + `sendLLMMessage` + `mcpService` |
| C6 Paiement / KYC | Marchand vs PSP agréé | `PAYMENT-AGGREGATORS.md` + privé |
| C7 Remboursements | Unused vs consumed vs IAP store | `REFUND-POLICY.md` |
| C8 Licence mixte | Apache/MIT public ≠ billing privé | `NOTICE`, `COMPOSANTS-PROPRIETAIRES.md` |

## Isolation

- Algorithmes : `packages/kuunda-ai/src/legal-policy.js`
- Branchement : `src/vs/workbench/contrib/kuundaLegal/`
- Accroche Void (notices Arowtech) :
  - `sendLLMMessageService` — point unique pour chat, Tab, Ctrl+K, message de commit
  - `mcpService` — schémas et `callTool` coupés hors-ligne
  - `chatThreadService` — agent + permissions MCP
- Lectures HTTP coupées : `fetchTables` (Cloud), `refreshJobLogs` (publish)
- Notice premier lancement : `kuunda.legal.firstRun`
- Genius Pay n’est **pas** le seul agrégateur possible

## Hors de portée

- Phase 9
- API DSR (accès/effacement) réelle — documentée comme trou avant lancement ; le panneau affiche le contact
- `wrangler deploy` / paiements live
- Avis d’avocat signé (le steward le mandate)
- Tuer les processus MCP déjà lancés au bascule hors-ligne (schémas et appels d’outils sont coupés)
- Télémétrie diagnostic VS Code/Void (réglage séparé, pas un gate Kuunda)
