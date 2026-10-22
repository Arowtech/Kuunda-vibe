# Isolation des composants propriétaires

**Décision Phase 0.2 — figée jusqu'à validation explicite, puis jusqu'à révocation écrite.**

## Décision

Les composants commerciaux listés ci-dessous **ne vivent pas** dans le dépôt public Apache-2.0 `Arowtech/Kuunda-vibe`.

Ils sont isolés dans un **dépôt privé distinct**, sous licence propriétaire Arowtech, et ne communiquent avec l'IDE open source que via des **interfaces stables publiées** dans le dépôt public.

| Élément | Dépôt | Licence |
| --- | --- | --- |
| Éditeur (fork Void / Code - OSS), UI, agent-core open, interfaces | `Arowtech/Kuunda-vibe` (public) | Apache-2.0 + MIT héritée |
| Facturation, crédits, agrégateurs de paiement (Genius Pay aujourd’hui, d’autres possibles), provisioning opérateur Kuunda Cloud, custody des clés de signature des mises à jour, runners de publication mobile | `Arowtech/kuunda-vibe-cloud` (privé) | Propriétaire Arowtech |

Le nom exact du dépôt privé peut être ajusté en Phase 0bis ; le principe d'isolation ne l'est pas.

## Justification

1. **Apache-2.0 §4, dernier alinéa** permet des termes différents pour *ses propres* modifications, à condition de rester conforme pour le Work d'origine. Si la logique crédits / agrégateur de paiement est commitée dans le même arbre sous `LICENSE` Apache-2.0, elle devient redistribuable sous Apache-2.0.
2. **Définition Apache de « Derivative Works »** : un travail qui reste séparable, ou qui se contente de lier (par nom) aux interfaces du Work, n'est pas un derivative work. C'est le levier juridique de l'isolation.
3. **Risque de fuite** : un monorepo public + modules « private » mal gitignorés est la cause classique de divulgation de webhooks, secrets, et règles anti-fraude.
4. **Rebase VS Code** : moins de code commercial collé dans `src/vs/` = moins de conflits lors des rebases microsoft/vscode (règle d'isolation des modules).

## Ce qui reste public (interfaces uniquement)

Le dépôt public peut contenir, et doit contenir dès les phases concernées :

- les **contrats TypeScript** (`ICreditsClient`, `IBillingClient`, `IKuundaProvisioningClient`, `IPublishClient`, `IUpdateIntegrityVerifier`, etc.) ;
- un **client HTTP** sans secret, qui parle à `api.ide.kuunda-cloud.com` ;
- l'UI de solde / plans si elle n'embarque aucune règle tarifaire confidentielle ni aucune clé ;
- la documentation des permissions demandées à l'utilisateur.

Ces artefacts sont Apache-2.0. Ils ne révèlent pas la logique anti-fraude, les webhooks d’agrégateur de paiement, ni les credentials opérateur.

## Ce qui reste privé

| Module (nom cible) | Raison de la fermeture |
| --- | --- |
| `billing` | Tarifs, quotas, ledger de crédits, idempotence des paiements |
| `genius-pay` | Adaptateur actuel d’agrégateur (HMAC webhooks, rapprochement Mobile Money). D’autres PSP peuvent s’ajouter à côté. |
| `kuunda-cloud-operator` | Provisioning avec credentials **plateforme** (distincts des credentials projet utilisateur) |
| `credits-ledger` | Source de vérité financière |
| `update-control-plane` | Custody de la clé de signature des binaires IDE, politique de révocation |
| `mobile-ci` | Abstraction runners GitHub, jobs de publication, secrets store / dispatch CI |
| `feedback-plane` | File d’attente des rapports opt-in, priorisation interne (pas de télémétrie silencieuse) |

Aucun de ces modules n'est cloné, copié, ni « temporairement » collé dans le dépôt public, y compris pour un prototype.

## Règle anti-fuite

- Aucune clé API, identifiant Google Play / Apple, credential Kuunda Cloud, secret d’agrégateur de paiement, ou donnée de paiement en clair dans un fichier versionné, **y compris en local si ce fichier peut être commité**.
- Les exemples utilisent exclusivement des placeholders du type `<SET VIA SECRET STORE>`, jamais de valeurs fictives ressemblant à de vrais tokens.
- Un fichier qui mélange interface publique et implémentation privée est considéré comme une violation de cette décision, pas comme un détail de refactoring.

## Conséquence pour les phases suivantes

- Phase 3bis (crédits) : UI + interface dans le dépôt public ; ledger et agrégateur de paiement dans le dépôt privé.
- Politiques utilisateur (privacy, ToS, refunds) : `docs/legal/` public, sans tarifs.
- Phase 6 (Kuunda Cloud) : injection des credentials **projet** générés pour l'utilisateur = public si le secret projet n'est pas le secret opérateur. Le provisioner opérateur = privé.
- Phase 7 (publishing) : UI et orchestration dans le public ; secrets store développeur et runners signés = privés / secrets CI.
- Phase 9 (updates) : `updateUrl` public ; clé privée de signature = hors dépôt, control plane privé.
- Phase 10 (feedback) : UI + contrats publics ; inbox / priorisation interne = `feedback-plane` privé.

Cette décision ne s'exécute pas en Phase 0 (pas de création du dépôt privé ici). Elle **interdit** d'écrire cette logique dans `Kuunda-vibe` à partir de maintenant.
