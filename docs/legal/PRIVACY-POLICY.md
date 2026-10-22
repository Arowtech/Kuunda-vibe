# Privacy Policy — Kuunda Vibe

**Steward:** Arowtech  
**Status:** Draft for counsel review. Must be signed off before public store submission or live payments.  
**Controller:** Arowtech (Kuunda Vibe desktop IDE)

English is the original. French follows.

## English

### 1. What this policy covers

This policy applies to the **Kuunda Vibe IDE** (this computer application). It does **not** automatically apply to mobile apps you later publish to Google Play or the App Store; those apps need their own privacy labels.

### 2. Data that stays on your machine

- Workspace source files, `@Codebase` index, project rules, git status, diffs.
- Store developer credentials (Play service-account JSON, App Store `.p8`, Android keystore) — gitignored, never uploaded by the IDE.
- Prompts sent to a **local** Ollama model.
- The IDE **never** stores payment card numbers, Mobile Money MSISDN, or payment-aggregator secrets.

### 3. Data sent to third parties (only if Strict Offline Mode is off)

| Data | Recipient | Purpose | Legal basis (GDPR Art. 6) |
| --- | --- | --- | --- |
| Prompts, code excerpts, chat, Tab completion, Ctrl+K, commit messages | Your BYOK AI provider (Anthropic, OpenAI, or Gemini) | Agent / completion | Contract (use of the feature) + your provider’s terms |
| MCP tool names, args and results | MCP servers you configured | Agent tools | Contract |
| Project metadata, seed table names | Kuunda Cloud (`api.ide.kuunda-cloud.com`) | Default backend for your project | Contract |
| Credits account id, plan, amount | Payment aggregator currently adapted as Genius Pay (other aggregators may be added) | Checkout for credits | Contract + Art. 6(1)(c) where payment records are required |
| Transaction journals (amount, status, delivery id — **no** PAN/MSISDN) | Kuunda Cloud platform | Accounting, disputes, AML cooperation with the PSP | Art. 6(1)(c) / 6(1)(f) |
| Opt-in feedback (title, category, severity, IDE version — **no** workspace files) | Kuunda Cloud (`api.ide.kuunda-cloud.com`) | Structured product feedback | Consent (you send it via F1) |

There is **no silent usage telemetry**. VS Code/Void diagnostic telemetry is a separate Settings toggle.

Retention of transaction journals: **1825 days** (5 years), then deletion or anonymisation, unless a longer statutory period applies.

### 4. Strict offline mode

F1 **Kuunda Vibe: Strict Offline Mode** stops all of the sends in §3. That **disables online credits and billing**, Kuunda Cloud provisioning, store publishing, the feedback channel, MCP tools, and cloud LLMs (including Tab and Ctrl+K). Local Ollama still works. VS Code/Void diagnostic telemetry is separate — disable it in Settings.

### 5. Your rights (GDPR / equivalent)

Access, rectification, erasure, restriction, portability, objection. Contact: https://ide.kuunda-cloud.com/legal  
A working data-subject request channel is required **before public launch**.

### 6. Transfers

BYOK AI providers may process data outside the African Economic and Monetary Union. You choose the provider and accept its transfer tools (e.g. SCCs). Kuunda Cloud aims to keep platform logs in the region documented in the private operations guide.

### 7. Children

The IDE is not directed at children under 16.

---

## Français

### 1. Périmètre

Cette politique couvre l’**IDE Kuunda Vibe**. Elle ne remplace pas la fiche confidentialité des applications mobiles que vous publiez.

### 2. Données locales

Fichiers du workspace, index, règles, diffs, identifiants développeur stores (gitignorés), prompts Ollama local. Aucun PAN / MSISDN / secret de paiement dans l’IDE.

### 3. Données envoyées (mode hors ligne strict désactivé)

Prompts, complétion Tab, Ctrl+K, messages de commit → fournisseur IA BYOK ; outils MCP → serveurs MCP configurés ; métadonnées projet → Kuunda Cloud ; identifiant crédits / montant → agrégateur de paiement (adaptateur actuel Genius Pay, d’autres pourront être ajoutés) ; journaux de transaction sans instrument de paiement, conservés 1825 jours ; rapport de feedback **opt-in** (titre, catégorie, version IDE — pas de fichiers workspace). Pas de télémétrie d’usage silencieuse.

### 4. Mode hors ligne strict

F1 **Kuunda Vibe : mode hors ligne strict** : aucun envoi externe. Cela **désactive crédits/facturation en ligne**, Kuunda Cloud, publication, canal de retours, MCP, LLM cloud (y compris Tab et Ctrl+K). Ollama local reste possible. La télémétrie VS Code/Void se désactive à part dans les paramètres.

### 5. Droits

Accès, rectification, effacement, limitation, portabilité, opposition. Contact : https://ide.kuunda-cloud.com/legal

### 6. Transferts et mineurs

Les fournisseurs BYOK peuvent traiter hors UEMOA. L’IDE n’est pas destiné aux moins de 16 ans.
