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

Réutiliser le mécanisme VS Code / Void déjà présent :

- clés nls dans `src/vs/workbench/contrib/kuundaBrand/` (`nls.localize('kuunda.xxx', 'English default')`) ;
- équivalent français dans `common/strings.json` pour chaque clé Kuunda nouvelle ;
- ne pas dupliquer un second framework i18n (i18next, etc.) par-dessus VS Code.

Le français n'est jamais la seule langue d'une chaîne : l'anglais est le repli si `fr` manque.
