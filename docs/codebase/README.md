# Guide interne du codebase — Kuunda Vibe

Ce guide est mis à jour **à chaque phase**. Il n'est pas un README marketing.

## Carte des documents

| Document | Rôle |
| --- | --- |
| [00-licence-et-gouvernance.md](00-licence-et-gouvernance.md) | Phase 0 : licence, NOTICE, CLA, frontière public/privé |
| [00bis-infrastructure.md](00bis-infrastructure.md) | Phase 0bis : Workers, DNS, Kuunda Cloud, secrets |
| [01-rename.md](01-rename.md) | Phase 1 : import Void, branding Kuunda Vibe, nls EN/FR |
| [02-autocomplete-chat.md](02-autocomplete-chat.md) | Phase 2 : Tab, Ctrl+K, @Codebase, diffs streaming |
| [03-agent.md](03-agent.md) | Phase 3 : boucle agent, permissions, contexte, arrière-plan, MCP |
| [03bis-credits.md](03bis-credits.md) | Phase 3bis : crédits UI + contrats (ledger privé) |
| [04-devtools.md](04-devtools.md) | Phase 4 : terminal agent, git multi-repo, multi-root, `.projectrules` |
| [04bis-extension-api.md](04bis-extension-api.md) | Phase 4bis : API VSIX/Open VSX + permissions Kuunda |
| [05-project-type.md](05-project-type.md) | Phase 5 : sélecteur de type de projet + templates |
| [06-kuunda-cloud.md](06-kuunda-cloud.md) | Phase 6 : Kuunda Cloud par défaut |
| [07-publishing.md](07-publishing.md) | Phase 7 : publication mobile Google Play / App Store |
| [08-reliability.md](08-reliability.md) | Phase 8 : audit credentials, timeouts, confirmation shell |
| [08bis-legal.md](08bis-legal.md) | 8bis : RGPD, privacy/ToS, hors-ligne strict, agrégateurs de paiement |
| [09-packaging.md](09-packaging.md) | Phase 9 : kuunda-builder, signature, auto-update interne |
| [10-post-launch.md](10-post-launch.md) | Phase 10 : feedback opt-in, backlog, plan upstream |
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
| 2 Complétion et édition assistée | **Validée** (steward, 17 sept. 2026) |
| 3 Agent autonome | **Validée** (steward, 17 sept. 2026 — ouverture 3bis) |
| 3bis Crédits et facturation | **Validée** (steward, 17 sept. 2026 — ouverture Phase 4) |
| 4 Outils de développement | **Validée** (steward, 17 sept. 2026) |
| 4bis API d'extensions | **Validée** (steward, 17 sept. 2026) |
| 5 Type de projet | **Validée** (steward, 17 sept. 2026) |
| 6 Kuunda Cloud par défaut | **Validée** (steward, 17 sept. 2026) |
| 7 Pipeline de publication mobile | **Validée** (steward, 17 sept. 2026) |
| 8 Sécurité et fiabilité | **Validée** (steward, 17 sept. 2026) |
| 8bis Conformité et légal | **Validée** (steward, 17 sept. 2026) |
| 9 Packaging et distribution | **En cours** (implémentée, validation steward) |
| 10 Itération post-lancement | **En cours** |

Ne pas fusionner les phases. Ne pas démarrer N+1 sans validation explicite de N.

## Arbre (Phase 10)

```
src/vs/                          fork Void / Code - OSS
src/vs/workbench/contrib/void/   UI Void (à rebaser, pas reformatter)
src/vs/workbench/contrib/kuundaBrand/  identité Kuunda, nls EN/FR
resources/branding/              logos steward
src/vs/workbench/contrib/kuundaAi/      Tab / @Codebase / diffs (P2) + agent (P3)
src/vs/workbench/contrib/kuundaBilling/  solde / plans / alertes (3bis)
src/vs/workbench/contrib/kuundaExt/     API extensions VSIX (P4bis)
src/vs/workbench/contrib/kuundaProject/ type de projet + scaffold (P5)
src/vs/workbench/contrib/kuundaCloud/    provision Cloud + panel (P6)
src/vs/workbench/contrib/kuundaPublish/  publication mobile + panneau (P7)
src/vs/workbench/contrib/kuundaLegal/     privacy / hors-ligne strict (8bis)
src/vs/workbench/contrib/kuundaFeedback/  canal de retours opt-in (P10)
packages/cloud-client/           contrats HTTP publics (crédits, billing, provisioning, publishing, feedback)
src/vs/platform/update/            auto-update Ed25519 (P9)
packages/kuunda-ai/              algorithmes testables (… packaging, post-launch)
product.json                     nom Kuunda Vibe, quality=internal, updateUrl
```

## Stack figée

Voir `00-licence-et-gouvernance.md`, `00bis-infrastructure.md`, `01-rename.md`, `02-autocomplete-chat.md`, `03-agent.md`, `03bis-credits.md`, `04-devtools.md`, `04bis-extension-api.md`, `05-project-type.md`, `06-kuunda-cloud.md`, `07-publishing.md`, `08-reliability.md`, `08bis-legal.md`, `09-packaging.md`, `10-post-launch.md`.
`engines` de compilation : ceux de Void/VS Code. Tests Kuunda : `npm test` (Node 24).
