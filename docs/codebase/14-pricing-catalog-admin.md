# 14 — Catalogue tarifaire et console d'administration

**Destinataires :** équipe Kuunda Cloud (dépôt privé `kuunda-vibe-cloud` : console `apps/web`, routes `apps/api`, ledger `sql/0001`).
**Objectif :** permettre de changer les plans, les crédits inclus, la valeur d'un crédit et le tarif de chaque modèle **depuis une console**, sans publier une nouvelle version de l'IDE, et sans jamais laisser une erreur de saisie faire perdre de l'argent.
**Doc jumeau :** [13-openrouter-ai-gateway.md](13-openrouter-ai-gateway.md) (qui sert les modèles et comment les crédits sont débités).
**Point d'atterrissage :** console dans `apps/web` (Pages, shell du dashboard) ; routes `/v1/pricing/…` et `/v1/admin/pricing/…` dans `apps/api` ; version publiée et audit adossés au ledger `sql/0001`. Le job de relecture hebdomadaire (§7) est un job du Worker `apps/api`, jamais une publication automatique.

## 1. L'essentiel

Le dépôt public est Apache-2.0 : **aucun tarif n'y est figé**, c'est une frontière de la Phase 0.2 ([00-licence-et-gouvernance.md](00-licence-et-gouvernance.md)). L'IDE ne connaît donc qu'**une forme** (le schéma ci-dessous) et **zéro prix**. Tout le reste — plans, crédits inclus, valeur du crédit, tarif par modèle — est une **donnée publiée par la console**.

Conséquence directe : un changement de prix est une opération de console, pas une livraison de client. Et une erreur de saisie ne doit pas pouvoir passer.

## 2. Règle d'unité

- **Devise : USD**, partout. `currency` est un champ du catalogue et vaut `USD` ; toute autre valeur est refusée (`currency_not_usd`). Ce n'est pas cosmétique : le coût des modèles est exprimé en dollars par l'agrégateur, et un catalogue en deux devises rend la marge incalculable.
- **Unité publique : le crédit.** L'utilisateur ne voit jamais un prix de modèle, il voit des crédits.
- **`creditUnitUsd`** : la valeur en dollars d'un crédit au prix catalogue. C'est le seul bouton qui relie l'argent au crédit, et il est dans la console.
- **`targetCostRatio`** : la part de la valeur catalogue qui part réellement en coût d'inférence. C'est le garde-fou de marge : `1 − targetCostRatio` est ce qui reste pour les frais de paiement, l'infrastructure, le support, la subvention du plan gratuit et la marge.
- **On tarife au prix plein, jamais au prix promotionnel.** Les remises affichées par l'agrégateur sont temporaires ; répercutées dans le tarif, elles font s'effondrer la marge le jour où elles s'arrêtent. Une remise en cours est de la marge en plus, pas une réduction du client.
- **Aucune facturation à l'heure.** Pas de ligne horaire, pas de temps d'attente facturé : le sandbox est un quota inclus (`sandboxHoursIncluded`, plafonné, non facturé) et les crédits ne paient que des tokens.

## 3. Schéma du catalogue

Forme **gelée** dans le code public — `src/vs/workbench/contrib/kuundaBilling/common/pricingCatalog.ts` et son miroir `packages/cloud-client/src/pricing-catalog.js`. Un champ ajouté ici doit être ajouté là-bas ; c'est la seule surface partagée.

### `PricingCatalog`

| Champ | Type | Rôle |
| --- | --- | --- |
| `version` | entier ≥ 1 | Identifiant de publication. Le client le renvoie dans ses journaux ; un débit est toujours rattachable à une version. |
| `currency` | `'USD'` | Devise unique. |
| `creditUnitUsd` | nombre > 0 | Valeur en dollars d'un crédit. |
| `targetCostRatio` | nombre dans `(0, 1]` | Part du catalogue qui part en coût réel. |
| `publishedAt` | ISO 8601 (optionnel) | Date de publication effective. |
| `plans` | `CatalogPlan[]` | Voir ci-dessous. |
| `models` | `CatalogModel[]` | Voir ci-dessous. |

### `CatalogPlan`

| Champ | Type | Rôle |
| --- | --- | --- |
| `id` | chaîne | Identifiant stable ; sert aussi d'identifiant de checkout. |
| `name` | chaîne | Libellé affiché. |
| `kind` | `'subscription'` \| `'topup'` | Abonnement ou recharge. |
| `priceUsd` | nombre ≥ 0 | Prix en dollars. `0` pour le plan gratuit. |
| `includedCredits` | entier ≥ 0 | Crédits inclus par période. |
| `bonusPercent` | nombre (optionnel) | Bonus de recharge. |
| `minSeats` | entier ≥ 1 (optionnel) | Sièges minimum (offres d'équipe). |
| `sandboxHoursIncluded` | nombre ≥ 0 (optionnel) | **Quota**, jamais facturé à l'heure. |
| `visible` | booléen (optionnel) | Masquer sans supprimer historique et abonnés. |

### `CatalogModel`

| Champ | Type | Rôle |
| --- | --- | --- |
| `id` | chaîne | Identifiant OpenRouter ; **clé de jointure** avec le routage (doc 13). |
| `label` | chaîne | Libellé affiché. |
| `tier` | `'free'` \| `'eco'` \| `'standard'` \| `'premium'` \| `'expert'` | Palier de routage et d'accès par plan. |
| `creditsPerMillion` | entier ≥ 0 | Tarif publié, en crédits par million de tokens. Un seul tarif par modèle : le cache abaisse le coût réel sans baisser le devis, donc c'est de la marge et non une remise. |
| `expirationDate` | ISO (optionnel) | Fin de vie annoncée par l'agrégateur. |
| `enabled` | booléen (optionnel) | Retrait immédiat sans perdre la ligne. |
| `providerAllowlist` | chaîne[] (optionnel) | Providers autorisés pour ce modèle. |

### Formules (identiques dans le code public)

```
coût de référence   = 0,85 × entrée + 0,15 × sortie          (mélange agent de référence)
tarif plancher      = ⌈coût de référence / (targetCostRatio × creditUnitUsd)⌉
crédits facturés    = ⌈(tokens_entrée + tokens_sortie) / 10^6 × creditsPerMillion⌉
crédits inclus      = ⌊priceUsd × creditsPerUsd × (1 + bonusPercent / 100)⌋
invariant de plan   = includedCredits × creditUnitUsd × targetCostRatio ≤ priceUsd
```

Deux pièges que le code public traite déjà, et que la console doit hériter :

1. **Paliers conditionnels.** Un modèle peut changer de tarif selon la taille du prompt (seuil de tokens) ou selon l'heure. Le validateur retire le palier **le plus cher** applicable : un tarif bâti sur le palier de base sous-facture toutes les tâches longues.
2. **Prix par token en chaîne décimale.** L'agrégateur renvoie `pricing.prompt` sous forme de chaîne par token ; l'adaptateur `fromOpenRouterPricing` normalise en dollars par million et absorbe les paliers. À utiliser tel quel : ne pas réimplémenter la conversion à la main.

## 4. Ce que la console édite

| Famille | Champs | Effet |
| --- | --- | --- |
| Devise et unité | `currency`, `creditUnitUsd` | Requote tout le catalogue d'un coup — opération sensible |
| Marge cible | `targetCostRatio` | Déplace le plancher de tous les modèles |
| Plans | `priceUsd`, `includedCredits`, `bonusPercent`, `minSeats`, `sandboxHoursIncluded`, `visible` | Offre commerciale |
| Modèles | `creditsPerMillion`, `tier`, `enabled`, `providerAllowlist` | Tarif, palier, disponibilité |
| Routage | modèle par défaut et modèle d'escalade par palier | Politique servie par la passerelle (doc 13) |
| Recharges | `priceUsd`, `includedCredits`, `bonusPercent` | Boutique |

## 5. Publication versionnée et audit

1. **Brouillon → publication.** Aucune modification n'est visible des clients avant publication. Un brouillon peut être testé (une prévisualisation du catalogue est calculée avec les mêmes règles de refus).
2. **`effectiveAt`.** Une publication peut être programmée. Une date d'effet ne peut pas être antidatée.
3. **Version incrémentale et immuable.** Une version publiée ne se modifie jamais : on en publie une nouvelle. L'IDE peut donc mettre en cache et renvoyer `version` en toute confiance.
4. **Audit obligatoire.** Qui, quand, quelle version, et **avant → après** champ par champ. Un changement de `creditUnitUsd` ou de `targetCostRatio` doit être distingué d'un changement de libellé dans le journal.
5. **Jamais de republication automatique d'un tarif.** Un changement de prix détecté par le job (section 7) crée un **brouillon proposé**, jamais une publication.
6. **Une publication invalide n'atteint aucun client.** L'IDE revérifie localement et conserve son dernier catalogue valide ; côté serveur, une version qui échoue aux règles de la section 6 ne peut pas être publiée.

## 6. Règles de refus

Codes émis par le validateur, identiques dans le code public (`PRICING_VALIDATION_CODES`). Les codes suffixés portent l'identifiant fautif, par exemple `plan_margin_below_target:pro`. Un test du dépôt public vérifie que **cette table et le code ne divergent jamais**.

### Erreurs — bloquent la publication

| Code | Déclencheur |
| --- | --- |
| `catalog_missing` | Catalogue absent ou de forme invalide. |
| `currency_not_usd` | Devise autre que USD. |
| `credit_unit_invalid` | `creditUnitUsd` non positif. |
| `target_cost_ratio_invalid` | `targetCostRatio` hors de `(0, 1]`. |
| `version_invalid` | `version` non entier ou < 1. |
| `plan_id_invalid` | `plan.id` absent ou dupliqué. |
| `plan_kind_invalid` | `kind` hors `subscription` / `topup`. |
| `plan_price_invalid` | `priceUsd` non renseigné ou négatif. |
| `plan_credits_invalid` | `includedCredits` non entier ou négatif. |
| `plan_seats_invalid` | `minSeats` non entier ou < 1. |
| `plan_sandbox_invalid` | `sandboxHoursIncluded` négatif. |
| `plan_margin_below_target` | Le plan vend plus de crédits que son prix ne peut en payer. |
| `model_id_invalid` | `model.id` absent ou dupliqué. |
| `model_tier_invalid` | `tier` hors des cinq paliers. |
| `model_rate_invalid` | `creditsPerMillion` non entier ou négatif. |
| `model_free_but_paid` | Un modèle annoncé gratuit a un coût réel non nul. |
| `model_margin_below_target` | Tarif sous le plancher de marge calculé sur le coût réel. |

### Avertissements — demandent une décision humaine, ne bloquent pas

| Code | Déclencheur |
| --- | --- |
| `plan_subsidised` | Plan gratuit avec des crédits inclus : subvention assumée, à tracer. |
| `model_cost_unverified` | Modèle tarifé dont le coût réel n'a pas pu être vérifié. |
| `model_expiring_soon` | Fin de vie annoncée sous 90 jours. |
| `no_plans` | Catalogue publié sans aucun plan. |
| `no_models` | Catalogue publié sans aucun modèle. |

## 7. Job de relecture des prix

Rythme hebdomadaire, sans intervention humaine pour la lecture, **avec** décision humaine pour l'effet :

1. lire les modèles du catalogue courant depuis l'agrégateur ;
2. normaliser chaque tarif par `fromOpenRouterPricing` (dollars par million + paliers conditionnels) ;
3. comparer au tarif publié et calculer le plancher de marge ;
4. **dérive > 20 %**, ou `expiration_date` sous 90 jours, ou endpoint non conforme (`data_collection`) → créer un **brouillon proposé** et notifier l'administrateur ;
5. ne jamais publier automatiquement, ne jamais modifier un plan.

Une hausse de coût se rattrape en changeant **une ligne de la table des modèles**, pas le prix des plans. C'est la règle qui protège les abonnés et rend la marge prévisible.

## 8. Routes

| Méthode | Route | Appelant | Rôle |
| --- | --- | --- | --- |
| `GET` | `/v1/pricing/catalog` | **IDE** | Catalogue publié. L'IDE valide la réponse et `lastPricingCatalog()` conserve le dernier valide. |
| `GET` | `/v1/billing/plans` | **IDE** | Vue achat / checkout. **Doit être dérivée de la version publiée du catalogue**, jamais maintenue en parallèle : deux sources de plans divergeraient. |
| `POST` | `/v1/admin/pricing/draft` | console | Crée un brouillon, renvoie les codes de refus. |
| `POST` | `/v1/admin/pricing/publish` | console | Publie un brouillon validé, avec `effectiveAt` optionnel. |
| `GET` | `/v1/admin/pricing/versions` | console | Historique des versions publiées. |
| `GET` | `/v1/admin/pricing/audit` | console | Journal qui / quand / avant → après. |

Les routes `/v1/admin/*` ne sont **jamais** appelées par l'IDE : ce sont des routes de console, derrière l'authentification administrateur, et elles ne doivent pas être joignables avec un jeton de session utilisateur.

## 9. Ce que Kuunda Vibe fait déjà (à ne pas dupliquer)

- lecture de `GET /v1/pricing/catalog`, avec validation locale et conservation du dernier catalogue valide (`getPricingCatalog`, `lastPricingCatalog`) ;
- devis en crédits avant un run (`estimateCredits`) — c'est de l'affichage, **jamais** ce qui est débité ;
- maths de crédits et adaptateur OpenRouter (`fromOpenRouterPricing`, `resolveModelPricing`, `realCostUsd`, `creditsPerMillionFromCost`, `planCreditsFromPrice`) ;
- validateur de marge côté client, **miroir de courtoisie** : il sert à quoter et à rendre les règles visibles. **L'autorité reste le serveur** ; ne pas faire confiance à la validation cliente pour éditer un tarif.

## 10. Critères d'acceptation

- [ ] Un administrateur change le prix d'un plan ; l'IDE l'affiche au prochain rafraîchissement **sans mise à jour client**.
- [ ] Une publication invalide est refusée avec les codes de la section 6, et **aucun client ne la reçoit**.
- [ ] Chaque débit journalisé est rattaché à une `version` de catalogue.
- [ ] Rejouer la publication 5 fois avec la même clé d'idempotence produit une seule version.
- [ ] Un catalogue invalide poussé de force ne casse pas l'IDE : le dernier catalogue valide continue de servir les devis.
- [ ] La dérive de prix hebdomadaire crée un brouillon, jamais une publication.
- [ ] `/v1/billing/plans` et `/v1/pricing/catalog` décrivent **la même** offre au même instant.
- [ ] Aucun tarif, aucune valeur de `creditUnitUsd` n'apparaît dans le dépôt public.

## 11. Hors de portée

- Le ledger et l'agrégateur de paiement : dépôt privé (Phase 3bis).
- La répartition exacte des coûts entre les postes de marge : décision interne, pas dans le contrat.
- Le chiffrage de l'offre : il vit dans la console, pas dans ce document.
