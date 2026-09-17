# Guide interne du codebase — Kuunda Vibe

Ce guide est mis à jour **à chaque phase**. Il n'est pas un README marketing.

## Carte des documents

| Document | Rôle |
| --- | --- |
| [00-licence-et-gouvernance.md](00-licence-et-gouvernance.md) | Phase 0 : licence, NOTICE, CLA, frontière public/privé |
| [00bis-infrastructure.md](00bis-infrastructure.md) | Phase 0bis : Workers, DNS, Kuunda Cloud, secrets |
| [01-rename.md](01-rename.md) | Phase 1 : import Void, branding Kuunda Vibe, nls EN/FR |
| [02-autocomplete-chat.md](02-autocomplete-chat.md) | Phase 2 : Tab, Ctrl+K, @Codebase, diffs streaming |
| `LICENSE` | Apache-2.0 (texte officiel non modifié) |
| `LICENSE-VS-Code.txt` | MIT Code - OSS (Microsoft) |
| `NOTICE` | Chaîne d'attribution Microsoft → Void → Arowtech |
| `ThirdPartyNotices.txt` | Notices tierces héritées de Void / Code - OSS |
| `GOVERNANCE.md` | Steward, PR, branches |
| `CONTRIBUTING.md` | Comment contribuer |
| [i18n-en-fr.md](i18n-en-fr.md) | UI bilingue EN/FR, anglais par défaut |

## Phases

| Phase | Statut |
| --- | --- |
| 0 Licence et gouvernance | **Validée** (steward, 16 sept. 2026) |
| 0bis Infrastructure et sécurité plateforme | **Validée** (steward, 17 sept. 2026) — SLA/restore/promotion SQL hors P1 |
| 1 Renommage éditeur | **Validée** (steward, 17 sept. 2026) |
| 2 Complétion et édition assistée | **En cours** |
| 3–10 | Non commencées |

Ne pas fusionner les phases. Ne pas démarrer N+1 sans validation explicite de N.

## Arbre (Phase 2)

```
src/vs/                          fork Void / Code - OSS
src/vs/workbench/contrib/void/   UI Void (à rebaser, pas reformatter)
src/vs/workbench/contrib/kuundaBrand/  identité Kuunda, nls EN/FR
resources/branding/              logos steward
src/vs/workbench/contrib/kuundaAi/      Tab / @Codebase / diffs (Phase 2)
packages/kuunda-ai/              algorithmes testables (BM25, hunks, Tab)
packages/cloud-client/           contrats HTTP publics
product.json                     nom Kuunda Vibe
```

## Stack figée

Voir `00-licence-et-gouvernance.md`, `00bis-infrastructure.md`, `01-rename.md`, `02-autocomplete-chat.md`.
`engines` de compilation : ceux de Void/VS Code. Tests Kuunda : `npm test` (Node 24).
