# 01 — Renommage éditeur (Kuunda Vibe)

**Phase :** 1
**Validation steward :** identité validée le 17 sept. 2026. Build de validation unsigned (Phase 1.5) via `kuunda-builder`.
**Point de départ :** Void `main` (commit shallow import, dépôt archivé https://github.com/voideditor/void), version produit Void 1.4.9 / Code - OSS 1.99.3.

Cette phase **importe** le fork Void, remplace l'identité produit, et produit un binaire interne non signé. Elle ne fusionne pas avec la Phase 2 (autocomplete / chat).

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

## Build de validation (Phase 1.5)

Pipeline GitHub Actions `kuunda-builder`, adapté de [void-builder](https://github.com/voideditor/void-builder) :

- Windows x64 : gulp `vscode-win32-x64-min-ci` + `vscode-win32-x64-user-setup` → `.exe` Inno (unsigned)
- macOS arm64 : gulp `vscode-darwin-arm64-min-ci` + `hdiutil` → `.dmg` (unsigned)
- Canal `internal` uniquement ; pas de signature Authenticode / Apple ; pas de `wrangler deploy`

Déclenchement : Actions → `kuunda-builder` → `win32-and-darwin`. Artefacts : `kuunda-vibe-win32-x64-unsigned` et `kuunda-vibe-darwin-arm64-unsigned`.

Node de compilation Electron : **20.18.2** (`.nvmrc`, imposé par Void/VS Code). Les tests Kuunda restent Node 24.

## Hors de portée

- Chat / inline / agent (Phases 2–3)
- Ledger / GeniusPay (3bis)
- Packaging installateurs **signés** et canal `stable` (Phase 9)
