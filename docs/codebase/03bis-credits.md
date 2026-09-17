# 03bis — Crédits et facturation (propriétaire)

**Phase :** 3bis
**Validation steward :** validée le 17 sept. 2026 (ouverture Phase 4).
**Prérequis :** Phase 3 commencée puis ouverte explicitement vers 3bis (17 sept. 2026)

Frontière figée (Phase 0.2) : **UI + contrats** dans ce dépôt public ; **ledger, tarifs, agrégateur de paiement** dans `Arowtech/kuunda-vibe-cloud`. Genius Pay est l’adaptateur actuel, pas un verrou.

## Livrables

| Id | Comportement | Public | Privé |
| --- | --- | --- | --- |
| 3bis.1 Freemium | Quota à l'inscription, sans carte | `signup` / `getBalance` | grant `free` |
| 3bis.2 Plans | Free / Plus / Pro / top-up | `listPlans()` affiche le JSON API | `packages/billing/src/plans.js` |
| 3bis.3 Checkout | Mobile Money via agrégateur (adaptateur actuel Genius Pay), isolé du module agent | `startCheckout` URL uniquement | HMAC webhook puis crédit |
| 3bis.4 Solde temps réel | Status bar + F1 refresh | `kuundaBilling` | `GET /v1/credits/:id` |
| 3bis.5 Alerte quota | `low` (20 %) / `empty` | nls + notification | `alert` dans le JSON |
| 3bis.6 Transactions | Pas d'identifiant de paiement dans l'IDE | client HTTP bearer runtime | journal `platform_payment_events` |
| 3bis.7 Échecs | Messages EN/FR | `classifyPaymentFailure` | codes `insufficient_funds` / `timeout` / `declined` |

## Isolation

- `packages/cloud-client` : contrats + HTTP zéro secret.
- `src/vs/workbench/contrib/kuundaBilling/` : UI nls EN/FR, status bar, commandes F1 (`setUser`, `refresh`, `openPlans`, `checkout`).
- Accroche Void : `ensureCanRunAgent` / `recordUsage` dans `chatThreadService` (notice Arowtech).
- Aucun tarif XOF, HMAC, ou MSISDN dans ce dépôt.

## Hors de portée

- Auth session réelle (reste 501 côté API)
- Persist ledger SQL (`sql/0002` privé, Worker isolate mémoire jusqu'au deploy + adaptateur)
- Session Genius Pay live (`wrangler secret` + API fournisseur — le checkout IDE ouvre l'URL hébergée)
- SLA / restore SQL (ouverts depuis 0bis)
- Terminal agent / `.projectrules` (Phase 4)
