# Exigences Google Play et App Store (apps générées + IDE)

**Statut :** veille interne, règles stores changeantes. Revérifier au moment du dépôt.  
**Bloque :** publication d’apps utilisateurs et, plus tard, d’un listing Kuunda Vibe lui-même.

## A. Applications que l’utilisateur publie depuis Kuunda

Ces apps ne sont **pas** Kuunda Vibe. L’utilisateur est l’éditeur.

### Contenu généré par IA

- **Play** : déclarer le contenu généré par IA dans le formulaire Data safety / déclarations applicables ; ne pas se présenter comme app humaine exclusive si le contenu l’est.
- **App Store** : guidelines sur le contenu généré (spam 4.3, originalité) ; divulguer l’usage d’IA si Apple l’exige au moment du dépôt.

### SDK tiers Kuunda Cloud

Si l’app embarque le client Kuunda Cloud :

- Fiche **Data safety** (Play) / **Privacy Nutrition Labels** (Apple) : données réseau, identifiants compte, éventuellement crash logs.
- Politique de confidentialité **de l’app** (URL obligatoire) distincte de celle de l’IDE.
- Consentement / ATT si tracking Apple.

### Paiement / crédits dans l’app publiée

Règle critique : **si l’app vend des biens numériques ou des crédits consommés dans l’app**, Google Play Payments / App Store Guideline **3.1.1** imposent en général l’achat intégré du store, pas un checkout Mobile Money parallèle.

| Cas | Canal autorisé (typique) |
| --- | --- |
| Biens physiques, services hors app | Paiement externe possible (sous conditions) |
| Crédits / fonctionnalités numériques **dans** l’app iOS/Android | IAP store, sauf exemptions écrites |
| Crédits **Kuunda Vibe desktop** | Hors stores mobiles — agrégateur (Genius Pay ou autre) |

Le pipeline Kuunda **n’injecte pas** un système de crédits Genius Pay dans l’app générée. Si un template le faisait un jour, ce serait un changement de politique store.

## B. Kuunda Vibe (l’IDE) sur d’éventuels stores desktop

Hors Phase 9. Quand un listing existera : politique de confidentialité, licence Apache/MIT + notice propriétaires, pas de télémétrie Microsoft.

## C. Checklist avant bouton Publier (produit)

L’UI de publication rappelle déjà que les secrets restent locaux. Avant go-live :

1. L’utilisateur a une privacy policy d’app.
2. Data safety / nutrition labels remplis.
3. Pas de paiement in-app numérique hors IAP.
4. Divulgation IA si le store le demande.
