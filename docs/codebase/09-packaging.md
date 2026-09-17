# 09 — Packaging et distribution

**Phase :** 9  
**Validation steward :** en cours  
**Prérequis :** Phase 8bis validée (17 sept. 2026)

Pipeline d’installateurs Windows / macOS, signature de code, auto-update signé. **Pas** de compilation Electron dans cette livraison. **Pas** de `wrangler deploy`. **Pas** de release publique.

## Livrables

| Id | Comportement | Où |
| --- | --- | --- |
| 9.1 Builder | `void-builder` → **kuunda-builder** ; gulp dossier + `*-user-setup` Win | `scripts/kuunda-builder/`, `.github/workflows/kuunda-builder.yml` |
| 9.2 Signature | Unsigned OK en `internal` ; cert obligatoire hors interne | `decideCodeSign` — secrets `WINDOWS_CERT_*` / `APPLE_*` hors git ; CI n’injecte que des booléens `HAS_*` |
| 9.3 Auto-update | `updateUrl` = updates.ide.kuunda-cloud.com ; Ed25519 **jamais** désactivée ; binaire vérifié avant install Win/macOS | `assertKuundaSignedFile` (pas Squirrel) ; URL HTTPS hôte updates uniquement |
| 9.4 Interne | Canal `internal` uniquement ; `stable` bloqué | `decideRelease` + `publishSignedArtifact` |

## Isolation

- Algorithmes : `packages/kuunda-ai/src/packaging-policy.js`
- Vérif binaire : `src/vs/platform/update/electron-main/kuundaUpdateIntegrity.ts`
- Accroches Void (notices Arowtech) : `updateService.win32.ts`, `darwin.ts`, `linux.ts`
- Clé privée de signature : dépôt privé / secret CI — jamais le Worker HTTP (`/sign` = 404)
- Publication de manifeste : `POST /api/artifacts` avec `UPDATE_PUBLISH_TOKEN` (jamais Wrangler `/sign`)

## Hors de portée / restes

- Phase 10
- Produire un `.exe` / `.dmg` réel (gulp compile Electron)
- `wrangler deploy`
- Diffusion publique / stores
- Certificats Authenticode / Apple Developer (secrets steward)
- Injecter `kuundaUpdatePublicKey` dans `product.json` au build (fail-closed tant qu’absente)
- Store durable des artefacts (mémoire Worker ; POST authentifié pour les tests internes)
- Linux : hors 9.1 ; ouverture du paquet seulement si l’URL est sur l’hôte updates
