# 13 — Passerelle IA Kuunda (OpenRouter)

**Destinataires :** équipe Kuunda Cloud (dépôt privé `kuunda-vibe-cloud`, service de facturation + passerelle IA).
**Objectif :** servir les modèles par une clé OpenRouter détenue par Kuunda, débiter les crédits, et imposer la politique de données — **sans jamais exposer la clé dans l'IDE**.
**Doc jumeau :** [14-pricing-catalog-admin.md](14-pricing-catalog-admin.md) (ce que coûte chaque modèle et ce qui est facturé).

## 1. L'essentiel

OpenRouter est un agrégateur : **une** base URL OpenAI-compatible sert Grok, GPT, Claude, DeepSeek, GLM, Kimi. C'est ce qui remplace le multi-provider. Mais OpenRouter ne facture personne à notre place : **les crédits Kuunda ne peuvent exister que si le trafic passe par un proxy que nous contrôlons**. C'est tout l'objet de ce document.

## 2. État réel côté Kuunda Vibe (à ne pas dupliquer)

OpenRouter est **déjà** un fournisseur de première classe dans l'IDE, hérité de Void. Le mode « clé de l'utilisateur » (BYOK) fonctionne donc **sans aucun travail côté client** :

| Ce qui existe déjà | Où |
| --- | --- |
| Réglage du provider (`apiKey`) | `modelCapabilities.ts` → `defaultProviderSettings.openRouter` |
| Transport HTTP | `sendLLMMessage.impl.ts` → branche `openRouter` : `baseURL: 'https://openrouter.ai/api/v1'`, en-têtes `HTTP-Referer` / `X-Title` |
| Chat + FIM | `sendLLMMessageToProviderImplementation.openRouter` → `_sendOpenAICompatibleChat` / `_sendOpenAICompatibleFIM` |
| Raisonnement | `openRouterSettings.providerReasoningIOSettings` → `include_reasoning`, ou `reasoning: { max_tokens }` pour le budget |
| Info d'affichage + aide à la clé | `voidSettingsTypes.ts` → lien `openrouter.ai/settings/keys`, placeholder `sk-or-key...` |
| Liste de modèles proposée | `modelCapabilities.ts` → `defaultModelsOfProvider.openRouter` — **figée sur des modèles de 2025** |

Trois points à corriger côté IDE, indépendants du cloud : le `HTTP-Referer` pointe encore sur `https://voideditor.com` (résidu d'identité Void) ; la liste `defaultModelsOfProvider.openRouter` propose des modèles qui n'existent plus ; `VoidStaticModelInfo.cost` existe déjà et pourra être alimenté par le catalogue tarifaire pour l'affichage.

## 3. Deux modes, une seule décision

| | **BYOK** (aujourd'hui) | **Géré** (à construire) |
| --- | --- | --- |
| Qui paie l'inférence | l'utilisateur | Kuunda |
| Où vit la clé | réglages Void (machine) | Worker Kuunda, jamais dans l'IDE |
| Mesurable / facturable | non | oui |
| Ce que ça débloque | usage libre, hors plan | plans, crédits, marge |

**Décision du steward (24 sept. 2026) : les deux modes sont retenus, et le mode géré est le seul chemin qui rend les crédits possibles.** Un plan ne peut pas mordre sur une clé que l'utilisateur détient. Conséquence pour le client : aucun drapeau de compilation — le mode se déduit du provider actif (`openRouter` en BYOK, provider Kuunda géré sinon), de sorte que les deux cohabitent dans le même binaire. Conséquence pour Kuunda Cloud : la passerelle gérée et le débit de crédits sont obligatoires, jamais un « plus tard ».

## 4. Le contrat (ce que l'IDE appellera)

### 4.1 Le choix qui rend l'intégration triviale

La passerelle doit parler **OpenAI-compatible** sur `POST /v1/ai/chat/completions`. Motif : `_sendOpenAICompatibleChat` fait déjà tout le travail (outils, raisonnement, streaming, FIM). Côté IDE, le mode géré se réduit donc à **une entrée de provider** pointant sur la base URL du proxy — aucun changement de plomberie de chat, donc aucun risque de casser les tests existants du chat.

### 4.2 Routes

Toutes sous `/v1`, JSON, erreurs stables — même discipline que [12-org-integration.md](12-org-integration.md).

| Méthode | Route | Rôle |
| --- | --- | --- |
| `GET` | `/v1/ai/models` | Catalogue **curé** : `{ id, label, tier, contextWindow, creditsPerMillion, providers? }`. Le client n'affiche pas les 400 modèles d'OpenRouter. |
| `POST` | `/v1/ai/chat/completions` | Chat streaming (SSE). Corps OpenAI + `kuunda` (voir 4.4). |
| `POST` | `/v1/ai/completions/fim` | Complétion préfixe/suffixe pour l'autocomplete. Facultatif en premier lot : l'autocomplete peut rester sur des modèles gratuits. |
| `GET` | `/v1/ai/quote` | Devis en crédits avant un run. Facultatif si le catalogue suffit au client. |

### 4.3 En-têtes

| En-tête | Contenu |
| --- | --- |
| `Authorization` | `Bearer <jeton de session Kuunda>` — **jamais** une clé OpenRouter |
| `Idempotency-Key` | Obligatoire sur toute requête qui débitera des crédits ; un rejeu ne débite pas deux fois |
| `X-Kuunda-Request-Id` | Corrélation client ↔ journal serveur |

### 4.4 Réponse

Payload OpenAI, **plus** un bloc d'extension ignoré par tout client OpenAI standard :

```json
{
  "choices": [ ... ],
  "usage": { "prompt_tokens": 0, "completion_tokens": 0, "prompt_tokens_details": { "cached_tokens": 0 } },
  "kuunda": { "model": "…", "provider": "…", "credits": 0, "catalogVersion": 0 }
}
```

`kuunda.provider` est **obligatoire** : c'est la preuve, par requête, du provider qui a réellement servi — donc de la conformité de la politique de données (voir 5).

### 4.5 Erreurs

| Cas | Réponse |
| --- | --- |
| Session absente ou expirée | `401` + `{ "error": "invalid_session" }` |
| Crédits insuffisants | `402` + `{ "error": "payment_required", "checkoutUrl": "…" }` |
| Modèle hors du plan | `403` + `{ "error": "model_not_allowed" }` |
| Quota de plan atteint | `429` + `Retry-After` + `{ "error": "quota_exceeded" }` |
| Aucun provider conforme disponible | `503` + `{ "error": "no_compliant_provider" }` — **jamais** un repli silencieux vers un provider qui journalise |

## 5. Politique de routage : imposée par le serveur, pas par le client

L'IDE peut envoyer des préférences de routage ; **elles n'ont aucune valeur contractuelle**. Tout ce qui suit doit être imposé côté Worker, à chaque requête :

- `data_collection: "deny"` et `zdr: true` — non négociables ;
- `only: [<liste blanche de providers>]` avec `allow_fallbacks: false`, ou `allow_fallbacks: true` **à l'intérieur** de la liste blanche ;
- `require_parameters: true` : un modèle annoncé avec outils doit réellement les supporter ;
- `max_price` par modèle, pris du catalogue tarifaire (garde-fou budgétaire, en plus du plafond de crédits) ;
- journalisation par requête du provider servi, des tokens et du cache, avec `requestId` et `catalogVersion`.

Si aucun endpoint conforme n'est disponible : **échec explicite**. Une dégradation de la confidentialité pour sauver un run serait le pire compromis possible.

## 6. Débit des crédits

1. Le solde est vérifié **avant** le run (`402` si vide), jamais après coup.
2. Les crédits sont débités **après**, sur les tokens réellement renvoyés par OpenRouter — un run interrompu se paie au réel, jamais au forfait.
3. Le débit est **idempotent** : il porte la `Idempotency-Key` de la requête.
4. **Aucun temps d'attente facturé.** On facture des tokens et l'inférence ; jamais une latence, jamais un sandbox à l'heure.
5. Un **devis** en crédits est affiché avant un run coûteux (palier expert). Le devis vient du catalogue client, le montant débité vient du serveur. Une divergence supérieure à 20 % doit être **remontée en télémétrie**, pas masquée.

## 7. Catalogue de modèles

Quelques modèles curés par palier, jamais l'ensemble de la place de marché. Les identifiants OpenRouter sont la clé de jointure entre le routage et le catalogue tarifaire (doc 14) :

| Palier | Exemple d'identifiant OpenRouter | Usage |
| --- | --- | --- |
| gratuit | `poolside/laguna-xs-2.1:free`, `nvidia/nemotron-3-ultra:free` | plan gratuit, autocomplete |
| standard | `deepseek/deepseek-v4.1-flash` | défaut agent |
| standard+ | `z-ai/glm-5.3-flash` | contexte long, interface |
| expert | `moonshotai/kimi-k3`, `anthropic/claude-sonnet-5` | mode expert, sur déclencheur |

**Ces identifiants ne sont pas figés dans l'IDE** : la liste est publiée par le dashboard (doc 14) et l'IDE n'en durcit aucun. Règle d'admission d'un modèle : outils supportés, contexte ≥ 200 k, pas d'`expiration_date` sous 90 jours, au moins un endpoint acceptant `data_collection: deny`.

## 8. Ce que Kuunda Vibe fait déjà (à ne pas dupliquer)

- transport et raisonnement OpenRouter, en mode BYOK, avec streaming et outils ;
- envoi des en-têtes d'attribution (`X-Title` = Kuunda Vibe) ;
- solde et alertes (`kuundaBilling`), débit via `POST /v1/credits/consume` ;
- devis en crédits à partir du catalogue publié (`estimateCredits`) ;
- lecture et validation du catalogue tarifaire (`GET /v1/pricing/catalog`), avec conservation du dernier catalogue valide.

## 9. Critères d'acceptation

- [ ] Un run d'agent complet passe par la passerelle sans qu'aucune clé OpenRouter n'existe sur la machine cliente.
- [ ] Chaque réponse porte `kuunda.provider`, et le journal serveur permet de prouver `data_collection: deny` sur la période.
- [ ] Rejouer 5 fois la même requête avec la même `Idempotency-Key` débite une seule fois.
- [ ] Un run interrompu est facturé au token réel consommé.
- [ ] Solde à zéro → `402` + `checkoutUrl`, jamais un run gratuit.
- [ ] Aucun endpoint conforme → `503 no_compliant_provider`, jamais un repli vers un provider qui journalise.
- [ ] Le devis client et le débit serveur divergent de moins de 20 % sur un échantillon de runs réels.
- [ ] Le mode BYOK continue de fonctionner sans régression.

## 10. Hors de portée

- Toute clé OpenRouter dans le dépôt public — interdit (Phase 0.2).
- Tout tarif dans le dépôt public — interdit ; voir doc 14.
- Le choix du palier de chaque modèle : c'est une donnée du dashboard, pas du code.
- La facturation (Stripe / Genius Pay) : elle reste dans le dépôt privé.
