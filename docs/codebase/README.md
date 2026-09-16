# Guide interne du codebase — Kuunda Vibe

Ce guide est mis à jour **à chaque phase**. Il n'est pas un README marketing.

## Carte des documents

| Document | Rôle |
| --- | --- |
| [00-licence-et-gouvernance.md](00-licence-et-gouvernance.md) | Phase 0 : licence, NOTICE, CLA, frontière public/privé |
| [00bis-infrastructure.md](00bis-infrastructure.md) | Phase 0bis : Workers, DNS, Kuunda Cloud, secrets |
| `LICENSE` | Apache-2.0 (texte officiel non modifié) |
| `LICENSE-VS-Code.txt` | MIT Code - OSS (Microsoft) |
| `NOTICE` | Chaîne d'attribution Microsoft → Void → Arowtech |
| `GOVERNANCE.md` | Steward, PR, branches |
| `CONTRIBUTING.md` | Comment contribuer |
| [i18n-en-fr.md](i18n-en-fr.md) | UI bilingue EN/FR, anglais par défaut |

## Phases

| Phase | Statut |
| --- | --- |
| 0 Licence et gouvernance | **Validée** (steward, 16 sept. 2026) |
| 0bis Infrastructure et sécurité plateforme | **Implémentée — en attente de validation steward** |
| 1 Renommage éditeur | Non commencée |
| 2–10 | Non commencées |

Ne pas fusionner les phases. Ne pas démarrer N+1 sans validation explicite de N.

## Arbre actuel (Phases 0–0bis)

Le fork Void / `src/vs/` n'est **pas** encore importé. C'est volontaire (Phase 1).

```
packages/cloud-client/   contrats + client HTTP sans secret
docs/codebase/00bis-infrastructure.md
.github/dependabot.yml
```

## Stack figée

Voir `00-licence-et-gouvernance.md` et `00bis-infrastructure.md`.
