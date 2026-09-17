# 04bis — API et format d'extension

**Phase :** 4bis
**Validation steward :** validée le 17 sept. 2026
**Prérequis :** Phase 4 validée (17 sept. 2026)

Kuunda Vibe **reste un hôte d'extensions VS Code**. Le format d'installation est le **VSIX** Open VSX / VS Code. Il n'y a pas de format `.kuunda-ext` en v1.

## Livrables

| Id | Comportement | Où |
| --- | --- | --- |
| 4bis.1 Format standard | Gallery **Open VSX** ; paquet `.vsix` uniquement | `product.json` + `isSupportedExtensionFormat` |
| 4bis.2 API versionnée `1.0.0` | Commandes `kuunda.api.version` / `kuunda.api.invoke` ; méthodes `agent.*`, `credits.balance`, `cloud.status` | `packages/kuunda-ai` + `kuundaExt` |
| 4bis.3 Permissions + sandbox | Point d'extension `contributes.kuunda` ; grant **uniquement** sur les permissions déclarées ; VSIX sideload = confirmation renforcée ; extension désactivée refusée ; `credits.balance` lit le cache (pas d'appel billing) | `kuundaExtPoint` + `IKuundaExtService` |
| 4bis.4 Revue marketplace | Open VSX = galerie v1. Un marketplace Kuunda futur exige `reviewStatus: approved` | `decideMarketplaceInstall` |

## API (`kuunda.api.invoke`)

```json
{
  "extensionId": "publisher.name",
  "apiVersion": "1.0.0",
  "method": "credits.balance"
}
```

Déclaration dans le `package.json` de l'extension :

```json
{
  "contributes": {
    "kuunda": {
      "apiVersion": "1.0.0",
      "permissions": ["agent", "credits"]
    }
  }
}
```

| Méthode | Permission | Résultat |
| --- | --- | --- |
| `api.version` | (aucune) | `{ version, format: "vsix", marketplace: "openvsx", methods }` |
| `agent.capabilities` | `agent` | `{ maxSteps, providers }` — pas de clés |
| `agent.getPolicy` | `agent` | `{ tools }` niveaux effectifs (`allow`/`confirm`/…) — pas de clés |
| `credits.balance` | `credits` | `{ remaining }` — pas d'id compte, pas de paiement |
| `cloud.status` | `kuundaCloud` | `{ available: false, phase: 6 }` jusqu'à la Phase 6 |

F1 : `kuunda.ext.grantAccess`, `kuunda.ext.revokeAccess`, `kuunda.ext.showApi`.

## Isolation

- Algorithmes : `packages/kuunda-ai/src/extension-api.js`
- Branchement : `src/vs/workbench/contrib/kuundaExt/` (point d'extension enregistré au chargement du workbench, pas de customer extHost)
- Un VSIX installé hors galerie (`source: vsix`) est traité en **sideload**, pas comme Open VSX.
- L'identité de l'appelant n'est pas fournie par le protocol extHost : l'`extensionId` doit correspondre à une extension **installée et activée** qui déclare `contributes.kuunda`, plus un grant. Les payloads sont rédigés.

## Hors de portée

- Marketplace propriétaire hébergé (revue `approved` prévue, pas d'hébergeur en v1)
- `vscode.kuunda` proposed API / extHost (rebase)
- Sélecteur de type de projet (Phase 5)
- Provisioning Kuunda Cloud (Phase 6)
