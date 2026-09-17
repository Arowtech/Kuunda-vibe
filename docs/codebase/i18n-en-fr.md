# Interface bilingue EN/FR (anglais par défaut)

**Décision steward :** 16 sept. 2026. S'applique dès le code UI de l'IDE (Phase 1+), pas à la Phase 0bis infra.

## Règle

| Surface | Langue |
| --- | --- |
| UI visible (menus, commandes, wizard, erreurs, À propos) | `en` + `fr`, locale par défaut `en` |
| Identifiants de code, APIs, commentaires `src/` | anglais |
| Docs gouvernance / légal interne | français |
| CLA | anglais qui fait foi |

## Mise en œuvre (Phase 1)

Réutiliser le mécanisme VS Code / Void déjà présent, plus un helper isolé :

- `src/vs/workbench/contrib/kuundaBrand/common/kuundaNls.ts` lit `getNLSLanguage()` : `en` par défaut, `fr` / `fr-*` pour le français ;
- catalogue bilingue dans `common/strings.json` (source de test) aligné sur `KUUNDA_STRINGS` ;
- ne pas dupliquer un second framework i18n (i18next, etc.) par-dessus VS Code.

- `src/vs/workbench/contrib/kuundaAi/` : mêmes règles pour les chaînes Phase 2 et Phase 3 (`kuunda.ai.*`, `kuunda.agent.*`).
- `src/vs/workbench/contrib/kuundaBilling/` : chaînes 3bis (`kuunda.billing.*`).
- `src/vs/workbench/contrib/kuundaExt/` : chaînes 4bis (`kuunda.ext.*`, `kuunda.api.*`).
- `src/vs/workbench/contrib/kuundaProject/` : chaînes Phase 5 (`kuunda.project.*`).
- `src/vs/workbench/contrib/kuundaCloud/` : chaînes Phase 6 (`kuunda.cloud.*`).
- `src/vs/workbench/contrib/kuundaPublish/` : chaînes Phase 7 (`kuunda.publish.*`).

Le français n'est jamais la seule langue d'une chaîne : l'anglais est le repli si `fr` manque.
