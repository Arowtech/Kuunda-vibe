# 01 — Renommage éditeur (Kuunda Vibe)

**Phase :** 1
**Validation steward :** validée le 17 sept. 2026. Compilation Electron hors scope.
**Point de départ :** Void `main` (commit shallow import, dépôt archivé https://github.com/voideditor/void), version produit Void 1.4.9 / Code - OSS 1.99.3.

Cette phase **importe** le fork Void et remplace l'identité produit. Elle ne fusionne pas avec la Phase 2 (autocomplete / chat).

## Identité

| Champ `product.json` | Valeur |
| --- | --- |
| `nameShort` / `nameLong` | Kuunda Vibe |
| `applicationName` | `kuunda-vibe` |
| `dataFolderName` | `.kuunda-vibe` |
| `urlProtocol` | `kuunda-vibe` |
| `darwinBundleIdentifier` | `com.arowtech.kuundavibe` |

Les champs `voidVersion` / `voidRelease` restent : le code `contrib/void` les lit. On ne les renomme pas (rebase).

## Logos

Sources steward (17 sept. 2026) :

- `resources/branding/icon.png` — picto (carré orange, curseur + point blanc)
- `resources/branding/wordmark.png` — picto + mot « VIBE »

Dérivés build VS Code (chemins hérités, **non** renommés pour rester rebase-able) :

- `resources/linux/code.png`
- `resources/win32/code.ico`
- `resources/darwin/code.icns`

Les notices Microsoft / Glass Devtools dans les sources **ne sont pas** remplacées par ces logos (Apache §4(c) / §6).

## i18n

Mécanisme VS Code `nls.localize` pour le cœur éditeur. Chaînes Kuunda nouvelles : `kuundaLocalize` dans `src/vs/workbench/contrib/kuundaBrand/` (anglais par défaut, français si locale `fr`). Catalogue `common/strings.json`.

## Gitleaks

Les `aiKey` Application Insights des `extensions/*/package.json` et le `token=` de la fixture `src/vs/base/test/common/uri.test.ts` sont des faux positifs Code - OSS. Allowlist dans `.gitleaks.toml` (`[extend] useDefault = true`). Ne pas supprimer ces clés : la télémétrie vscode les lit.

Les fixtures de `packages/kuunda-ai/test/kuunda-ai.test.mjs` (PKCS8 Play / App Store, et `sk_live_*` pour `looksLikeSecret`) sont des faux positifs `private-key` et `stripe-access-token` : matériel de test, pas des secrets réels. Allowlist ciblée sur ce fichier, car `gitleaks detect` scanne l’historique.

## Hors de portée

- Chat / inline / agent (Phases 2–3)
- Ledger / GeniusPay (3bis)
- Packaging installateurs signés (Phase 9)
- `npm install` / compilation Electron : environnement local lourd, pas un livrable de ce premier import
