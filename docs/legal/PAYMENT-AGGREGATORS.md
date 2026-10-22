# Agrégateurs de paiement (pluggables)

**Décision :** Genius Pay est l’**adaptateur actuel**, pas un verrou produit. D’autres API (autre PSP Mobile Money, carte, etc.) peuvent être ajoutées dans le dépôt privé sans republier la logique tarifaire dans l’IDE public.

## Public (Apache-2.0)

- L’IDE parle d’« agrégateur de paiement » / `payment_aggregator`.
- `packages/kuunda-ai` : liste d’ids connus, défaut `genius-pay`, `resolvePaymentAggregator` refuse de figer l’UI sur un seul nom.
- Aucune clé, aucun tarif, aucun MSISDN.

## Privé (propriétaire)

- Un registre `payment-aggregators` : id, chemin de webhook, parseur, vérif de signature.
- L’adaptateur Genius Pay reste le premier (`/v1/webhooks/genius-pay`).
- Un nouvel agrégateur = nouveau module de vérif + entrée de registre + secret wrangler. Le ledger (`provider` + `delivery_id`) reste générique.

## Obligations marchand (inchangées quel que soit le PSP)

Kuunda n’est pas établissement de paiement. Chaque agrégateur impose :

- contrat marchand + KYC de Arowtech ;
- conservation des journaux côté plateforme (1825 jours visés) ;
- remboursement selon **ses** délais ;
- interdiction de stocker l’instrument de paiement dans l’IDE.

Changer d’agrégateur ne change pas cette frontière.
