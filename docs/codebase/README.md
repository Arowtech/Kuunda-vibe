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
| [11-account.md](11-account.md) | Phase 11 : compte Studio web ↔ IDE, OAuth, crédits |
| [12-org-integration.md](12-org-integration.md) | Spec à transmettre à Kuunda Cloud : organisations, managed accounts, API de délégation |
| [13-openrouter-ai-gateway.md](13-openrouter-ai-gateway.md) | Spec à transmettre à Kuunda Cloud : passerelle IA OpenRouter, débit des crédits, politique de données |
| [14-pricing-catalog-admin.md](14-pricing-catalog-admin.md) | Spec à transmettre à Kuunda Cloud : catalogue tarifaire USD, console d'administration, garde-fous de marge |
| `LICENSE` | Apache-2.0 (texte officiel non modifié) |
| `LICENSE-VS-Code.txt` | MIT Code - OSS (Microsoft) |
| `NOTICE` | Chaîne d'attribution Microsoft → Void → Arowtech |
| `ThirdPartyNotices.txt` | Notices tierces héritées de Void / Code - OSS |
| `GOVERNANCE.md` | Steward, PR, branches |
| `CONTRIBUTING.md` | Comment contribuer |
| [i18n-en-fr.md](i18n-en-fr.md) | UI bilingue EN/FR, anglais par défaut |

## Specs à transmettre à Kuunda Cloud

Ces documents ne sont pas des phases : ce sont des **specs d'interface**, écrites ici parce que le contrat vit ici. Règle de rédaction : une spec décrit des routes que le client **appelle déjà** ou est prêt à appeler ; l'implémentation est dans le dépôt privé. Quand les routes répondent, **aucun changement de client n'est nécessaire**.

| Doc | Sujet | Appelant |
| --- | --- | --- |
| [12-org-integration.md](12-org-integration.md) | Organisations, managed accounts, projets, liaison multi-appareils | IDE |
| [13-openrouter-ai-gateway.md](13-openrouter-ai-gateway.md) | Passerelle IA (clé OpenRouter côté serveur), débit des crédits, preuve de la politique de données | IDE |
| [14-pricing-catalog-admin.md](14-pricing-catalog-admin.md) | Catalogue tarifaire USD, console d'administration, règles de refus de publication | IDE (lecture) + console |

**Discipline de synchronisation :** la forme partagée est `packages/cloud-client/src/` ; tout champ qui y change se répercute le jour même dans le doc correspondant. Les codes de refus du catalogue (`PRICING_VALIDATION_CODES`) et les tarifs modèles vivent dans le code public sous forme de **forme** seulement — jamais de valeur — et un test vérifie que la table du doc 14 et le code ne divergent pas.

**Noms des dépôts (vérifiés sur GitHub avec le compte `Arowtech`, 24 sept. 2026) :**

| Dépôt | Visibilité | Rôle |
| --- | --- | --- |
| `Arowtech/Kuunda-vibe` | public | cet IDE (Apache-2.0 + MIT héritée) |
| `Arowtech/kuunda-vibe-cloud` | privé | composants commerciaux séparables de Kuunda Vibe — ledger, tarifs, agrégateur de paiement, provisioning opérateur, custody des clés de signature. **Destinataire des specs 12/13/14.** |
| `Arowtech/kuunda-cloud` | privé | plateforme Kuunda Cloud (dashboard, services, facturation, invoices) — projet distinct, jumeau du clone local |

La frontière juridique du dépôt public est **`Arowtech/kuunda-vibe-cloud`** : c'est ce nom que portent `GOVERNANCE.md`, `NOTICE`, `docs/legal/COMPOSANTS-PROPRIETAIRES.md`, `docs/legal/CLA-*.md`, `docs/codebase/03bis-credits.md`, `docs/codebase/12-org-integration.md`, les contrats `packages/cloud-client/src/`, `legalPolicy`/`legal-policy` et `test/license-compliance.test.mjs`.

**Piège à ne pas confondre :** `Arowtech/kuunda-cloud` (le dépôt plateforme) et les domaines `*.kuunda-cloud.com` ne désignent **pas** la frontière propriétaire du dépôt public — seul `Arowtech/kuunda-vibe-cloud` la désigne. Un test verrouille cette distinction (`test/repo-names.test.mjs`).

### Dépôt privé `Arowtech/kuunda-vibe-cloud` — arbre réel et points d'atterrissage

**Source :** le README du dépôt privé, relevé le 24 sept. 2026, complété le 1er oct. 2026 (session livrée). Ce tableau est le contrat d'atterrissage des specs : quand une spec dit « à implémenter », c'est ici que ça tombe.

| Chemin | Rôle |
| --- | --- |
| `apps/api` | Worker Cloudflare (Hono 4.13.8) — `api.ide.kuunda-cloud.com`. **Reçoit les routes des docs 12, 13 et 14.** |
| `apps/updates` | Worker isolé — `updates.ide.kuunda-cloud.com` (feed de mises à jour). |
| `apps/web` | Pages — vitrine + shell du dashboard. **La console d'administration du doc 14 atterrit ici.** |
| `sql/` | `0001` ledger, `0003` mapping, `0004` jobs de publication. `0003` et `0004` **non appliqués en prod**. |
| `packages/kuunda-cloud-operator` | Allocation `proj_*` + mapping. Jamais de `service_role`. |
| `packages/update-control-plane` | Feed updates + signature en CI. Jamais de route `/sign` HTTP. |
| `packages/mobile-ci` | `resolve-runner` + publisher. Jamais de `p8` / keystore. |
| `packages/feedback-plane` | Inbox des rapports opt-in. Jamais de télémétrie silencieuse. |

Docs internes du privé — la spec qui l'instruit doit les nommer : `docs/BILLING.md` (3bis), `docs/PROVISIONING.md` (6), `docs/RELIABILITY.md` (8), `docs/LEGAL.md` (8bis), `docs/UPDATE-TRUST-CHAIN.md` (9), `docs/FEEDBACK.md` (10).

| Spec | Où elle atterrit dans le privé |
| --- | --- |
| [12-org-integration.md](12-org-integration.md) | `apps/api` (routes `/v1/orgs/…`, `/v1/accounts/…`), `sql/0003`, `docs/PROVISIONING.md` |
| [13-openrouter-ai-gateway.md](13-openrouter-ai-gateway.md) | `apps/api` (routes `/v1/ai/…`), ledger et débit de crédits — `docs/BILLING.md`, `sql/0001` |
| [14-pricing-catalog-admin.md](14-pricing-catalog-admin.md) | `apps/web` (console), `apps/api` (routes `/v1/pricing/…`, `/v1/admin/…`), `sql/0001` |

**Deux prérequis du privé au 1er oct. 2026 — chemin critique avant 12/13 :**

1. **Le secret de session doit être posé : la route, elle, est livrée.** Depuis le 25 sept. 2026, `POST /v1/auth/session` émet `{ userId, accessToken, expiresIn }` — un jeton HMAC de 30 jours — que `apps/api` accepte ensuite en `Authorization: Bearer` : c'est ce que le doc 13 exige et ce dont le doc 12 se sert pour la revendication d'un compte. Il reste une **configuration**, pas une livraison : sans `SESSION_SIGNING_SECRET` (≥ 32 caractères) dans l'environnement, la route répond `501 session_unconfigured` et n'émet aucun jeton — **la passerelle gérée doit donc rester fermée dans cet environnement**. Secret posé, une session absente ou invalide vaut `401 invalid_session`. (Sans secret, le privé retombe sur le `userId` du body, comme en 3bis/6.)
2. **`sql/0003` et `sql/0004` ne sont pas appliqués en prod.** Le mapping `platform_provisioned_projects` et les jobs de publication mobile dépendent de ces migrations ; l'IDE fonctionne aujourd'hui sur les routes legacy précisément pour cette raison.

**Les deux modes IA sont retenus (tranché, 24 sept. 2026) :** **BYOK** (clé OpenRouter de l'utilisateur dans les réglages, déjà câblée côté client) **et** **passerelle gérée** (clé OpenRouter côté serveur Kuunda Cloud, débit en crédits). Les deux coexistent sans changement de client : le mode se choisit par le provider actif, pas par une option de compilation. Doc 13 décrit les deux.

## Phases

| Phase | Statut |
| --- | --- |
| 0 Licence et gouvernance | **Validée** (steward, 16 sept. 2026) |
| 0bis Infrastructure et sécurité plateforme | **Validée** (steward, 17 sept. 2026) — SLA/restore/promotion SQL hors P1 |
| 1 Renommage éditeur | **En cours** — identité livrée ; build de validation unsigned (1.5) |
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
| 11 Compte Studio (web ↔ IDE) | **En cours** |

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
src/vs/workbench/contrib/kuundaAccount/   Studio compte web ↔ IDE (P11)
packages/cloud-client/           contrats HTTP publics (auth, crédits, billing, provisioning, publishing, feedback)
src/vs/platform/update/            auto-update Ed25519 (P9)
packages/kuunda-ai/              algorithmes testables (… packaging, post-launch)
product.json                     nom Kuunda Vibe, quality=internal, updateUrl
```

## Stack figée

Voir `00-licence-et-gouvernance.md`, `00bis-infrastructure.md`, `01-rename.md`, `02-autocomplete-chat.md`, `03-agent.md`, `03bis-credits.md`, `04-devtools.md`, `04bis-extension-api.md`, `05-project-type.md`, `06-kuunda-cloud.md`, `07-publishing.md`, `08-reliability.md`, `08bis-legal.md`, `09-packaging.md`, `10-post-launch.md`, `11-account.md`, `12-org-integration.md`, `13-openrouter-ai-gateway.md`, `14-pricing-catalog-admin.md`.
`engines` de compilation : ceux de Void/VS Code. Tests Kuunda : `npm test` (Node 24).
