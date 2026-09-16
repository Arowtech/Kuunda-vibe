# Guide interne du codebase — Kuunda Vibe

Ce guide est mis à jour **à chaque phase**. Il n'est pas un README marketing.

## Carte des documents

| Document | Rôle |
| --- | --- |
| [00-licence-et-gouvernance.md](00-licence-et-gouvernance.md) | Phase 0 : licence, NOTICE, CLA, frontière public/privé |
| `LICENSE` | Apache-2.0 (texte officiel non modifié) |
| `LICENSE-VS-Code.txt` | MIT Code - OSS (Microsoft) |
| `NOTICE` | Chaîne d'attribution Microsoft → Void → Arowtech |
| `GOVERNANCE.md` | Steward, PR, branches |
| `CONTRIBUTING.md` | Comment contribuer |
| `docs/legal/` | Obligations Apache, CLA, isolation propriétaire |

## Phases

| Phase | Statut |
| --- | --- |
| 0 Licence et gouvernance | **Implémentée — en attente de validation steward** |
| 0bis Infrastructure et sécurité plateforme | Non commencée |
| 1 Renommage éditeur | Non commencée |
| 2–10 | Non commencées |

Ne pas fusionner les phases. Ne pas démarrer N+1 sans validation explicite de N.

## Arbre actuel (Phase 0 uniquement)

Le fork Void / `src/vs/` n'est **pas** encore importé. C'est volontaire (Phase 1).

```
LICENSE
LICENSE-VS-Code.txt
NOTICE
CONTRIBUTING.md
GOVERNANCE.md
CODE_OF_CONDUCT.md
package.json
test/license-compliance.test.mjs
docs/legal/
docs/codebase/
.github/PULL_REQUEST_TEMPLATE.md
```

## Stack figée pour la Phase 0

Voir `00-licence-et-gouvernance.md` § Choix techniques.
