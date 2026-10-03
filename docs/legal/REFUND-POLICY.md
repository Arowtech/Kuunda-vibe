# Credit refund policy — Kuunda Vibe

**Status:** Draft aligned with a generic payment-aggregator contract. Counsel + current PSP (Genius Pay today) must confirm before live charges.  
English original; French follows.

## English

1. **Unused purchased credits** — You may request a refund of credits bought and not consumed. Arowtech asks the **current payment aggregator** to reverse the Mobile Money (or card) payment under that aggregator’s refund window and rules.
2. **Consumed credits** — Credits already used for agent / LLM calls are **not refundable**.
3. **Failed or duplicate charges** — A failed checkout that did not credit the ledger is not billed. Idempotent webhooks prevent double credit; a proven double charge is reversed in full.
4. **Store in-app purchase** — Kuunda desktop credits are **not** sold through Google Play or the App Store today. If that channel is added, **the store’s refund rules** apply to that purchase, not this policy.
5. **Apps you publish** — If an end-user app generated from Kuunda sells its own digital goods, that app must follow Play / App Store IAP refund rules. Kuunda credits for the IDE are a separate product.
6. **How to request** — Use https://ide.kuunda-cloud.com/legal with the credits account id (never a payment secret). Target response: 15 business days.
7. **Retention** — Transaction journals (amount, status, delivery id) are kept **1825 days** then deleted or anonymised.

The IDE never stores PAN / MSISDN. Refunds cannot be processed from a secret pasted into chat.

## Français

1. **Crédits achetés non consommés** — Remboursable via l’agrégateur de paiement (reversement Mobile Money selon ses délais).
2. **Crédits consommés** — Non remboursables.
3. **Échec / doublon** — Pas de facturation si le ledger n’a pas été crédité ; un double prélèvement prouvé est intégralement reversé.
4. **Achat intégré store** — Les crédits desktop ne passent pas par Play / App Store aujourd’hui. Si ce canal existe un jour, les règles de remboursement du store s’appliquent.
5. **Apps publiées par l’utilisateur** — Si l’app vend ses propres biens numériques, ce sont les règles IAP du store, pas cette politique IDE.
6. **Demande** — https://ide.kuunda-cloud.com/legal + identifiant de compte crédits. Délai cible : 15 jours ouvrés.
7. **Conservation** — Journaux 1825 jours.
