# 00bis — Infrastructure et sécurité de plateforme

**Phase :** 0bis
**Validation steward :** en attente
**Contrainte transverse :** IDE bilingue EN/FR, anglais par défaut (`i18n-en-fr.md`) — UI IDE en Phase 1. Le shell Pages (vitrine/dashboard) est déjà EN par défaut + FR.

Cette phase **précède** tout développement fonctionnel d'éditeur. Elle ne fusionne pas avec la Phase 1.

## Choix techniques

| Sujet | Choix | Version au 16 sept. 2026 | Justification |
| --- | --- | --- | --- |
| API | Cloudflare Workers + **Hono 4.13.8** | Wrangler **4.133.0** | Cahier des charges. Hono est le framework Workers le plus léger, zero-dep, Web Crypto natif. |
| Frontend | Cloudflare Pages (statique) | même Wrangler | Vitrine `ide.` + dashboard `app.` sans secret. |
| Updates | Worker **séparé** `apps/updates` | même Wrangler | Isole la surface si l'API est compromise. |
| Client public | `packages/cloud-client` (JS ESM) | Node ≥ 22.12 / cible 24 LTS | Linking par nom, zéro dépendance npm. |
| Signature updates | Ed25519 sur SHA-256 du binaire | Web Crypto | Vérif côté IDE jamais désactivée. Clé privée hors git. |
| GeniusPay | HMAC-SHA256 `timestamp + "." + rawBody` | docs geniuspay.ci | Vérif **avant** tout crédit. Réponse générique `{ok:false}`. |
| Builds mobiles | GitHub Actions, abstraction `resolveGitHubRunner` | ubuntu-latest / macos-latest | Pas de AAB/IPA en 0bis. |
| Base | Kuunda Cloud = PostgreSQL **16.15** | isolation `read committed` | Voir due diligence. |
| Scan deps | Dependabot v2 + Snyk CI si `SNYK_TOKEN` | Gitleaks CLI 8.30.1 | Snyk ignoré tant que le jeton steward n'existe pas. |

Aucune extension Open VSX (pas d'éditeur).

## DNS (0bis.1)

| Hôte | Rôle |
| --- | --- |
| `ide.kuunda-cloud.com` | vitrine Pages |
| `app.ide.kuunda-cloud.com` | dashboard Pages |
| `api.ide.kuunda-cloud.com` | Worker API |
| `updates.ide.kuunda-cloud.com` | Worker updates isolé |

**Non déployé** : compte Cloudflare / jetons absents. Détail dans le dépôt privé `docs/DNS.md`.

## Due diligence Kuunda Cloud (0bis.5)

Mesures sandbox `proj_75ff301f30844160a4390ff024ec940csbx` le 16 sept. 2026 :

| Critère | Nativement | Compensation |
| --- | --- | --- |
| ACID | Oui, une transaction SQL. `fsync=on`. Isolation `read committed`. | Ledger + événement GeniusPay dans la même transaction. |
| Sauvegarde | `archive_mode=off`. Pas de PITR observé. | Journal `platform_audit.payment_events` + export hors site + **test de restore**. |
| Conformité financière | Pas de PCI/ISO publié. | Aucun PAN. GeniusPay = proxy. |
| SLA | Non documenté en self-serve. | Facturation prod **non fiable** tant qu'un contrat SLA n'est pas signé. |
| Isolation | Schémas `proj_<id>` / `proj_<id>sbx` par projet. | Ledger dans un **projet plateforme dédié**, jamais dans `proj_*` utilisateur. |

SQL proposé (non appliqué) : dépôt privé `sql/0001_platform_schema.sql`.

## 0bis.6 GitHub

Déjà livré en Phase 0 sur le public. Dependabot ajouté. Même Gitleaks + tests sur le privé.

## 0bis.8–0bis.12

Secrets : `wrangler secret` uniquement (`docs/SECRETS.md` privé).
Updates : `docs/UPDATE-TRUST-CHAIN.md`.
Webhooks : `apps/api/src/lib/genius-pay-webhook.js`.
Env : `env-guard.js` refuse sandbox en production et live en staging/dev.
WAF : `docs/WAF.md` — à cocher dans le dashboard Cloudflare au premier deploy.

## Hors de portée

- Import Void (Phase 1)
- Ledger crédits réel, UI agent, publishing stores (Phases 3bis–7)
- `wrangler deploy` sans jeton Cloudflare
