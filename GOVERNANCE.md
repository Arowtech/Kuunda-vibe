# Gouvernance — Kuunda Vibe

**Statut :** Phase 4bis validée, dépôt public `https://github.com/Arowtech/Kuunda-vibe.git`
**Steward :** Arowtech
**Licence du dépôt public :** Apache-2.0 (cœur Code - OSS : MIT)

## 1. Modèle

Kuunda Vibe n'est pas une fondation indépendante. C'est un **projet d'entreprise à source ouverte** :

- Arowtech décide de la feuille de route, des releases, et de l'acceptation des contributions.
- Le code éditeur public reste Apache-2.0 / MIT héritée.
- Les composants commerciaux restent hors de ce dépôt (voir `docs/legal/COMPOSANTS-PROPRIETAIRES.md`).

Ce modèle est volontairement proche de VSCodium / Void (fork ouvert, steward identifié), pas d'une gouvernance communautaire à vote.

## 2. Rôles

| Rôle | Pouvoir |
| --- | --- |
| Steward (Arowtech) | Licence, CLA, branches protégées, secrets, signatures, publications |
| Mainteneurs | Revue de PR, merge après CI verte, triage des issues |
| Contributeurs externes | Issues et PR après CLA ; aucun droit de merge |

Tant que la liste des mainteneurs n'est pas publiée ailleurs, le steward assume le rôle de mainteneur unique.

## 3. Règles de pull request

1. **CLA obligatoire** pour tout contributeur externe (individuel ou corporate). Les commits Arowtech internes n'ont pas besoin d'un CLA séparé.
2. **Une préoccupation par PR.** Pas de mélange « rebase Void + billing + rename ».
3. **Revue obligatoire** d'au moins un mainteneur qui n'est pas le seul auteur (dès qu'il existe deux mainteneurs ; en phase solo, auto-revue documentée dans la PR).
4. **CI verte obligatoire** avant merge : job `gitleaks` (Gitleaks CLI 8.30.1) et job `license-compliance`. Un finding Gitleaks bloque le merge.
5. **Aucun secret** dans la PR (clés, `.env`, identifiants stores, dumps de facturation). Le scan Gitleaks s'ajoute à cette règle, il ne la remplace pas.
6. **Tests** pour tout module nouveau ou modifié. Les tests Kuunda (`npm test`) couvrent licence, cloud-client et branding. Les tests VS Code se lancent via les scripts du dossier `scripts/`.
7. **Licence** : fichiers nouveaux Arowtech en Apache-2.0 ; fichiers hérités : conserver les headers ; fichiers modifiés : notice de changement (§4(b)).
8. **Pas de reformatage massif** du code VS Code / Void hors besoin fonctionnel — cela casse les rebases.
9. Toute action destructive (force-push sur `main`, suppression de tags de release, rotation d'une clé de signature) exige une confirmation écrite du steward.

La protection de branche GitHub sur `main` (revue + statut CI `gitleaks` obligatoire) est un livrable de la Phase 0. Le steward admin peut contourner l'exigence de *revue* (compte unique), pas l'exigence du scan de secrets.

Le CLA existe **en plus** d'Apache §5 : §5 licence les PR du dépôt public en Apache-2.0, mais ne donne pas à Arowtech le droit clair de réutiliser une contribution dans `Arowtech/kuunda-vibe-cloud`. Voir `docs/legal/CLA-INDIVIDUAL.md`.

## 4. Branches

| Branche | Rôle |
| --- | --- |
| `main` | Source de vérité publique ; protégée |
| `phase/N-*` | Travail d'une phase, merge seulement après validation explicite du steward |
| `hotfix/*` | Correctifs de production, ensuite rebasés sur `main` |

Pas de commits directs sur `main` une fois la protection activée.

## 5. Langues

- **Interface utilisateur de l'IDE :** bilingue **anglais + français**, **anglais par défaut**. Toute chaîne visible (menus, commandes, écran d'accueil, paramètres, messages d'erreur) passe par le système de nls/i18n de VS Code (`nls.localize` / packs `vscode-nls`), avec `en` comme locale de repli et `fr` fourni dès l'introduction de la chaîne. Ne jamais coder une chaîne UI en dur dans une seule langue.
- **Code et commentaires dans `src/` hérités de VS Code / Void :** anglais, pour rester rebase-able.
- **Modules Kuunda isolés** (`src/vs/workbench/contrib/kuunda-*/` une fois créés) : identifiants, APIs et commentaires en anglais ; libellés utilisateur via nls EN/FR.
- **Documentation interne / gouvernance :** français.
- **CLA :** anglais (texte qui fait foi), résumé français non contraignant.
- Issues et PR : français ou anglais.

## 6. Sécurité des contributions

- Ne jamais demander à un contributeur externe d'ajouter des secrets « pour tester ».
- Les rapports de vulnérabilité se font en privé (advisory GitHub, dès que le dépôt existe), pas en issue publique.
- Un agent IA (humain ou automatisé) qui propose une action irréversible doit obtenir une confirmation explicite du steward avant exécution.

## 7. Marques et forks

Un fork public de Kuunda Vibe peut utiliser le code Apache-2.0 / MIT. Il **ne peut pas** se présenter comme « Kuunda Vibe », ni utiliser les logos fournis, sans permission écrite (Apache §6).

## 8. Évolution de cette gouvernance

Toute modification de licence, de CLA, ou de la frontière public/privé est un changement de Phase 0. Elle exige une validation explicite du steward, un commit isolé, et une mise à jour de `NOTICE` si l'attribution change.
