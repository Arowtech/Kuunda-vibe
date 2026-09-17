# Terms of Use — Kuunda Vibe

**Steward:** Arowtech  
**Status:** Draft for counsel review before public distribution.  
English original; French follows.

## English

### 1. The product

Kuunda Vibe is a desktop IDE. The **public source** is Apache-2.0 (editor core MIT). **Billing, payment aggregation, operator provisioning, update-signing custody and mobile CI** live in a separate proprietary repository and are **not** licensed Apache-2.0. See `NOTICE` and `docs/legal/COMPOSANTS-PROPRIETAIRES.md`.

### 2. Accounts and credits

Online agent features may consume **credits**. Credits are a contractual usage unit, not e-money issued by Arowtech. Checkout is performed by a **payment aggregator** (currently Genius Pay; other aggregators may be integrated later). The IDE never stores payment credentials.

### 3. Payments

You pay the aggregator under **its** merchant / end-user terms. Arowtech is the merchant of record for Kuunda credits, not a Mobile Money issuer. KYC/AML thresholds are applied by the licensed PSP. You must complete any KYC the aggregator requires.

### 4. Strict offline mode

You may refuse all external sends. That disables online credits, billing, Kuunda Cloud, publishing, MCP tools, and cloud AI (including Tab and Ctrl+K). Local tools (editor, Ollama) remain available.

### 5. AI output

AI-generated code and apps are your responsibility. Before publishing to Google Play or the App Store you must meet those stores’ rules (AI disclosure, privacy labels, in-app purchase rules if **your** app sells digital goods). Kuunda Cloud in a generated app is a third-party SDK you must declare.

### 6. Prohibited use

No abuse of the agent, no uploading others’ secrets, no use that violates applicable law (including payment and export rules).

### 7. Warranty and liability

Software is provided **AS IS** (Apache §7 / MIT). Liability is limited as in Apache §8 and LICENSE-VS-Code.txt.

### 8. Changes

Arowtech may update these terms. Material payment or privacy changes will be shown in the IDE data-disclosure panel.

---

## Français

### 1. Produit

IDE desktop. Source publique Apache-2.0 (cœur MIT). Facturation, agrégation de paiement, provisioning opérateur, custody des signatures et CI mobile : dépôt **propriétaire** séparé.

### 2. Crédits

Les crédits sont des unités d’usage, pas de la monnaie électronique émise par Arowtech. Le paiement passe par un **agrégateur** (Genius Pay aujourd’hui ; d’autres pourront suivre). L’IDE ne stocke aucun secret de paiement.

### 3. Paiements

Vous acceptez les conditions de l’agrégateur. Arowtech est marchand des crédits Kuunda, pas émetteur Mobile Money. Le KYC/LCB-FT relève du prestataire agréé.

### 4. Hors ligne strict

Refuse tout envoi externe et **désactive** crédits en ligne, Cloud, publication, MCP, IA cloud (y compris Tab et Ctrl+K).

### 5. Sortie IA et stores

Le code et les apps générés sont sous votre responsabilité. Respectez Play / App Store (divulgation IA, fiches privacy, achats intégrés si **votre** app vend des biens numériques).

### 6. Garantie

Logiciel « AS IS ». Voir LICENSE et NOTICE.
