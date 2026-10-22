# 05 — Sélecteur de type de projet

**Phase :** 5
**Validation steward :** validée le 17 sept. 2026
**Prérequis :** Phase 4bis validée (17 sept. 2026)

Fonctionnalité propriétaire : un **nouveau projet** n'est créé qu'après un type obligatoire. Le provisioning Kuunda Cloud (Phase 6) est branché après la création. Pas de publication store (Phase 7).

## Choix techniques

| Choix | Pourquoi |
| --- | --- |
| Quick Pick + dialogue dossier VS Code | Déjà dans l'IDE ; pas de wizard React/npm supplémentaire (rebase) |
| Templates vanilla (HTML / `node:http`) | Aucune dépendance runtime dans le scaffold ; pas de CLI React Native en v1 |
| Manifeste `.kuunda/project.json` | Fichier projet isolé, lu par l'agent et plus tard par les Phases 6/7 |
| Contrib `kuundaProject/` | Isolé du cœur VS Code/Void |

## Livrables

| Id | Comportement | Où |
| --- | --- | --- |
| 5.1 Type obligatoire | Site web / Application web / Application mobile / Autre ; annulation = aucun fichier | Quick Pick `kuunda.project.create` + fenêtre vide |
| 5.2 Template | Fichiers adaptés au type + `.projectrules` + README ; n'écrase pas un fichier déjà présent ; manifeste **écrit en dernier** ; refuse un dossier déjà Kuunda **ou** un `project.json` corrompu | `scaffoldProjectFiles` + `IKuundaProjectService.create` |
| 5.3 Mobile | Sous-écran Google Play / App Store / les deux / aucune ; `publishTargets` dans le manifeste ; dossiers `store/play` ou `store/appstore` seulement si choisi | `normalizePublishTargets` |

## Manifeste

```json
{
  "version": 1,
  "type": "mobile",
  "name": "shop",
  "publishTargets": ["google_play", "app_store"]
}
```

F1 : `kuunda.project.create`, `kuunda.project.showType`. Menu Fichier : **New Project**.

Fenêtre vide : dialogue Créer / Ouvrir un dossier / Plus tard. Ouvrir un dossier existant **ne** passe **pas** par le wizard.

## Isolation

- Algorithmes : `packages/kuunda-ai/src/project-type.js`
- Branchement : `src/vs/workbench/contrib/kuundaProject/`
- Accroche Void (notice Arowtech) : `convertToLLMMessageService` injecte le type dans le prompt agent

## Hors de portée

- Builds AAB/IPA, identifiants Play/App Store (Phase 7)
- Écraser un projet Kuunda existant
