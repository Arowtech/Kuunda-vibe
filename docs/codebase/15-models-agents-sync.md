# 15 — Synchronisation des modèles et profils d'agent (Web ↔ Windows ↔ macOS)

**Destinataires :** équipe IDE (dépôt public `Arowtech/Kuunda-vibe`) et équipe Kuunda Cloud (dépôt privé `kuunda-vibe-cloud`).
**Objectif :** figer le contrat d'échange qui permet à un profil d'agent (et aux préférences) modifié côté Web d'atteindre le desktop sans redémarrage, et à un même compte d'être partagé entre Web, Windows et macOS.
**Docs jumeaux :** [13 — Passerelle IA Kuunda](13-openrouter-ai-gateway.md) (qui sert les modèles et débite les crédits) · [14 — Catalogue tarifaire et console](14-pricing-catalog-admin.md) (ce que coûte chaque modèle).
**Point d'atterrissage :** routes `/v1/ai/…` du Worker `apps/api` (Hono, `api.ide.kuunda-cloud.com`) et console `apps/web`. Le client IDE **compose** et **consomme** ; il n'exécute aucune écriture serveur.
**Statut :** contrat retenu et console livrée ; **synchronisation durable et identité inter-appareils non activées**. Ne rien annoncer de « synchronisé » avant les prérequis du §6.

> Cette page décrit un contrat, pas un état de production. Le store métier de l'API est encore volatile (mémoire d'isolate), la persistance n'est pas branchée et le client desktop n'implémente pas encore les transports. Le mode BYOK de l'IDE est décrit avec la passerelle ([13](13-openrouter-ai-gateway.md)).

## 1. L'essentiel

| Sujet | Décision |
| --- | --- |
| Streaming d'une réponse IA | **SSE** serveur → client, token par token, via la passerelle gérée. Le contenu de la réponse est privé à la requête, **jamais rediffusé** aux autres appareils du compte. |
| État d'agent et workspace | **WebSocket** bidirectionnel persistant via Durable Object par compte ; événements bornés/sanitisés, reprise par séquence, repli HTTP/SSE. Le terminal ne transmet ni commande ni sortie. |
| Écritures et resynchronisation | **HTTP** avec `If-Match`, `Idempotency-Key`, lecture des documents et endpoint `/changes`. SSE/WS ne transportent que des signaux ; le client **relit par HTTP**. |
| Prompt système Kuunda | Global, versionné et servi par l'API. Les blocs fixes forment le préfixe stable pour le cache. |
| Règles de projet | `KUUNDA.md`, `ARCHITECTURE.md`, `.kuunda/rules/*.md` restent **dans le projet local**. Fichiers et contenus du workspace ne sont jamais envoyés à l'API dans cette version. |
| Préférences développeur | 4e bloc synchronisé au compte, distinct du prompt système et des règles projet (ex. `~/.kuunda/config.md`). |
| Profils d'équipe | Le serveur peut publier des profils `team`/`enforced`, en lecture seule côté utilisateur ; aucun gestionnaire d'organisation n'est livré. |
| Appareil | UUID aléatoire **stable**, généré et stocké localement par le client — pas une empreinte matérielle. Liste d'appareils et présence sont des métadonnées. |
| BYOK | Le **slug de modèle** peut être synchronisé ; la clé reste dans le **coffre OS local**. Endpoints locaux, secrets MCP, fichiers, historiques et sorties terminal ne quittent pas l'appareil. |
| Mode géré | OpenRouter uniquement, via la passerelle Kuunda et le catalogue/palier ([13](13-openrouter-ai-gateway.md), [14](14-pricing-catalog-admin.md)). |

**Ordre des blocs de prompt :** `[SYSTEM — KUUNDA]`, `[PROJECT RULES]`, `[USER CONFIG]`, `[PROJECT CONTEXT]`, `[USER]`. Les blocs stables précèdent les blocs variables pour favoriser le cache. Le point de composition **serveur** ne reçoit jamais de règles ni de contexte projet : c'est le client desktop qui les compose localement avec le prompt système versionné et les instructions compte.

## 2. Contrat profils / préférences

`AgentProfile` porte un UUID, un nom, un mode BYOK/géré, un fournisseur, un slug de modèle et des paramètres bornés d'autonomie/étapes/contexte. **Aucun** champ de clé, d'endpoint, d'URL locale, d'en-tête ou de configuration MCP n'est autorisé. La suppression crée une **tombstone** non réutilisable. Un profil d'équipe/imposé est servi en lecture seule.

`AiPreferences` porte `activeProfileId`, les profils par fonctionnalité (`agent`, `tab`, `inlineEdit`), une préférence de palier et `userInstructions: { enabled, body }`. Les références vers des profils supprimés ou inconnus sont neutralisées. **Toute écriture exige** un UUID d'appareil, un `If-Match` et une clé d'idempotence.

**All allowlist :** tout champ inconnu d'un profil/préférence est écarté, jamais propagé. Toute chaîne ressemblant à une clé fait échouer l'écriture (`secret_in_payload`).

Fusion déterministe (donc identique sur Windows, macOS et le Web) : par profil, on retient le `updatedAt` le plus récent, puis, à horodatage égal, le JSON canonique lexicographiquement le plus petit. Un assouplissement d'autonomie distant reste **en attente de confirmation locale** avant de s'appliquer.

## 3. Routes du contrat

Toutes les routes de compte exigent une session Bearer lorsqu'un secret de session est configuré. Les GET catalogue et prompt système sont publics.

| Méthode | Route | Fonction |
| --- | --- | --- |
| `GET` | `/v1/ai/models` | Catalogue versionné et disponibilité selon palier |
| `GET` | `/v1/ai/prompt/system` | Prompt global versionné, empreinte et ordre des blocs |
| `POST` | `/v1/ai/prompt/assemble` | Composition limitée à la demande et aux instructions compte ; refus du contexte/règles projet montants |
| `GET/PUT` | `/v1/ai/profiles` | Lecture complète et remplacement idempotent avec révision |
| `PUT` | `/v1/ai/profiles/:id` | Écriture d'une ligne (l'API n'expose pas de GET par id) |
| `DELETE` | `/v1/ai/profiles/:id` | Tombstone, références de préférences nettoyées |
| `POST` | `/v1/ai/profiles/:id/confirm-autonomy` | Confirmer l'assouplissement en attente |
| `GET/PUT` | `/v1/ai/preferences` | Préférences compte et 4e bloc |
| `GET` | `/v1/ai/changes` | Repli HTTP par révisions de documents/catalogue/runs |
| `GET` | `/v1/ai/stream` | SSE, reprise `Last-Event-ID`, événements compte via hub DO |
| `GET` | `/v1/ai/events` | WebSocket authentifié pour événements agent/workspace et présence |
| `GET` | `/v1/ai/devices` | Liste d'appareils vus lors des écritures |
| `GET/POST` | `/v1/ai/agent/runs` | Liste / démarrage d'un run d'agent |
| `GET/POST` | `/v1/ai/agent/runs/:runId[/events|/finish]` | Détail, progression, attente et fin |
| `POST` | `/v1/ai/gateway/chat` | Passerelle OpenRouter gérée, streaming SSE **privé à la requête** |

En-têtes d'écriture : `If-Match: "<révision>"` (version optimiste), `Idempotency-Key` (rejeu sûr), `X-Kuunda-Device` (appareil à l'origine de l'écriture, obligatoire côté appareil appairé). En réponse : `ETag`, `X-Kuunda-Revision`, `Idempotent-Replay`.

Le WebSocket transporte des événements agent/workspace **très bornés** (libellés relatifs et noms d'outils uniquement). Le **HTTP reste l'autorité** : après un trou de séquence ou une reconnexion, le client se resynchronise par `/v1/ai/changes`.

## 4. Prompt et cache

| Bloc | Origine | Envoyé au serveur ? |
| --- | --- | --- |
| `[SYSTEM — KUUNDA]` | API (`/v1/ai/prompt/system`) | oui (lecture) |
| `[PROJECT RULES]` | projet local | **non** |
| `[USER CONFIG]` | API (`/v1/ai/preferences`, 4e bloc) | oui (lecture/écriture) |
| `[PROJECT CONTEXT]` | workspace local | **non** |
| `[USER]` | demande de l'utilisateur | oui (au sein de la requête) |

L'ordre est immuable : c'est le préfixe stable qui rend le cache efficace. Le prompt système est **versionné** et porte une empreinte, pour qu'un client sache quand invalider son cache.

## 5. Identité et appareils

Un `deviceId` est un UUID aléatoire stable, **jamais** une empreinte matérielle. Pour partager réellement un compte entre appareils, un **appairage** relie un poste à la session déjà ouverte dans la console : code court éphémère côté desktop, revue et approbation explicites côté console, puis jeton **scellé au `deviceId`** (à présenter avec l'en-tête `X-Kuunda-Device`, sinon `device_binding_mismatch`). Un appareil révoqué est refusé (`device_revoked`).

Limite à connaître : l'appairage relie à la **session interne** de la console, **pas** à une identité OAuth/email. Deux appareils ne partagent une identité garantie que s'ils sont appairés à la même session, et il n'existe **pas** de récupération de compte.

## 6. Prérequis avant d'annoncer « synchronisé »

- [ ] Identité authentifiée et appairage Web ↔ Windows ↔ macOS partagés (appairage serveur livré ; OAuth/email et client desktop restent à faire).
- [ ] Persistance durable des documents, révisions, tombstones, appareils, audit, idempotence et état de run.
- [ ] Consommateur desktop implémenté/testé : SSE pour les changements, WS pour l'agent, HTTP pour la reprise.
- [ ] Coffre OS BYOK vérifié sur les plateformes ciblées ; aucun secret envoyé.
- [ ] Débit géré par réservation/règlement idempotent et persistant.
- [ ] Tests d'intégration multi-appareil validés.

## 7. Politique de données et sécurité

Une clé ne monte **jamais** depuis le client. Les payloads de profil/préférence/run sont filtrés/rejetés si un secret est détecté. Aucun contenu de fichier, chemin absolu, commande ou sortie de terminal n'est inclus dans l'état de run ; les libellés de workspace acceptés sont des chemins **relatifs** uniquement. Les flux sont cloisonnés **par compte** dans le Durable Object ; une identité de compte réelle est requise avant tout usage multi-appareils.

## 8. Ce que l'IDE doit retenir

- Écrire un profil = `If-Match` + `Idempotency-Key` + `X-Kuunda-Device`.
- Ne jamais envoyer règles projet ni contexte workspace à l'API.
- Traiter SSE/WS comme des **signaux**, et `/changes` (ou une relecture HTTP) comme la **vérité**.
- Composer le prompt localement dans l'ordre fixé ; ne synchroniser que le slug de modèle, jamais la clé.
