# RGPD et équivalents locaux (avant publication)

**Statut :** analyse interne, pas un avis d’avocat. À faire viser avant stores et paiements live.  
**Bloque :** Phase 9 packaging / distribution publique.

## Rôles

| Acteur | Rôle | Données |
| --- | --- | --- |
| Arowtech (IDE + plateforme Kuunda Cloud) | Responsable de traitement pour le compte crédits, journaux, provisioning | userId, solde, métadonnées projet |
| Fournisseur IA BYOK choisi par l’utilisateur | Responsable (ou sous-traitant selon contrat BYOK) | prompts, extraits de code |
| Agrégateur de paiement (Genius Pay aujourd’hui, d’autres possibles) | Prestataire de paiement agréé ; responsable KYC/LCB-FT | instrument de paiement, MSISDN — **jamais dans l’IDE** |
| Google / Apple | Responsables pour les comptes développeur de l’utilisateur | hors IDE ; fichiers locaux gitignorés |

## Bases juridiques visées (RGPD)

- Exécution du contrat (agent, cloud, crédits).
- Obligation légale pour les journaux de paiement (durée 1825 jours, à confirmer vs droit OHADA / droit fiscal local).
- Intérêt légitime limité : sécurité, anti-fraude agrégateur (payloads minimaux).

## Équivalents locaux (UEMOA / Mobile Money)

- **Côte d’Ivoire / UEMOA :** traitement de données (loi locale / ARTCI selon le pays d’établissement d’Arowtech) ; paiements : **BCEAO** — l’intermédiaire en opérations de paiement est l’agrégateur agréé, pas Kuunda.
- **KYC :** seuils et pièces = conditions d’usage **marchand** de l’agrégateur. Kuunda n’implémente pas un KYC parallèle dans l’IDE.
- **LCB-FT :** obligations pesant sur le PSP ; l’intégration ne doit pas contourner ses webhooks, son idempotence, ni stocker de copies de pièces d’identité.
- Ne pas se présenter comme établissement de monnaie électronique.

## Mesures techniques déjà dans le produit

- Isolation public/privé (Phase 0.2).
- Pas de secret de paiement dans le dépôt public.
- Timeout réseau, gitignore credentials (Phase 8).
- Mode hors ligne strict (8bis) = base pour le refus de traitement non nécessaire (chat, Tab, Ctrl+K, MCP, Cloud, publish, crédits).
- Divulgation dans l’IDE (panneau F1) + notice au premier lancement.

## Trous à fermer avant lancement public

1. Canal DSR réel (accès / effacement) — le kernel et le panneau documentent l’obligation, l’API n’existe pas encore.
2. DPA signé avec chaque agrégateur et chaque hébergeur.
3. Mention d’information à la première ouverture : notification IDE en place ; un écran de consentement RGPD n’est pas implémenté — le counsel confirme s’il est exigé au-delà de l’usage contractuel.
4. Analyse d’impact si profilage étendu (non prévu).
5. Raison sociale, siège, délégué à la protection des données : à figer par le steward (point ouvert Phase 0).
