# Obligations Apache License 2.0 — Kuunda Vibe

**Statut :** figé en Phase 0, avant tout code fonctionnel.
**Licence du travail original Kuunda Vibe :** Apache License, Version 2.0.
**Texte officiel :** [https://www.apache.org/licenses/LICENSE-2.0](https://www.apache.org/licenses/LICENSE-2.0)

Ce document n'est pas un avis juridique. Il consigne les obligations que le projet s'impose avant publication. Un avocat doit relire ces textes avant la première diffusion publique.

## 1. Pourquoi Apache-2.0 (et pas MIT seul, GPL, ou propriétaire)

| Option | Décision |
| --- | --- |
| Relicencier tout le fork en MIT | Rejeté. Void est Apache-2.0. Le grant de brevet Apache (§3) et l'obligation de NOTICE (§4(d)) ne peuvent pas être abandonnés pour le code Void. |
| GPL / AGPL | Rejeté. Incompatible avec l'objectif d'un IDE redistribuable et d'extensions VS Code/Open VSX. La GPL contaminerait des modules séparables. |
| Propriétaire sur tout le fork | Rejeté. Le cœur Code - OSS est MIT (redistribution libre sous conditions MIT). Void est Apache-2.0. Un fork propriétaire du code héritage violerait ces licences. |
| Apache-2.0 pour Kuunda Vibe + MIT conservé pour Code - OSS | **Retenu.** Compatible dans le sens utilisé ici : du code MIT peut être combiné dans une distribution qui respecte aussi Apache-2.0. |

Apache-2.0 est le plancher de compatibilité imposé par Void. Kuunda Vibe ne descend pas en dessous.

## 2. Chaîne de licences du dépôt public

```
Code - OSS (Microsoft)     MIT
        ↓ fork
Void (Glass Devtools, Inc.) Apache-2.0  (+ MIT conservé pour le cœur VS Code)
        ↓ fork
Kuunda Vibe (Arowtech)      Apache-2.0  (+ MIT conservé pour le cœur VS Code)
```

Chaque redistribution de Kuunda Vibe (source ou binaire) doit satisfaire **simultanément** :

1. MIT pour les portions Microsoft Code - OSS (`LICENSE-VS-Code.txt` inclus).
2. Apache-2.0 pour les portions Void et Kuunda Vibe (`LICENSE` + `NOTICE` inclus).

## 3. Obligations Apache-2.0 applicables à chaque publication

### 3.1 Fournir une copie de la licence — §4(a)

Toute copie source ou binaire (installateur Windows/macOS, archive Git, image CI) doit inclure `LICENSE`.

### 3.2 Notice de modification — §4(b)

Tout fichier modifié par rapport à Void / Code - OSS doit porter une notice visible. Convention du projet :

```
// SPDX-FileCopyrightText: Copyright (c) Microsoft Corporation. All rights reserved.
// SPDX-FileCopyrightText: Copyright 2025 Glass Devtools, Inc.
// SPDX-FileCopyrightText: Copyright 2026 Arowtech
// SPDX-License-Identifier: MIT AND Apache-2.0
// Modified for Kuunda Vibe. See NOTICE.
```

Pour un fichier **nouveau** et uniquement Arowtech :

```
// SPDX-FileCopyrightText: Copyright 2026 Arowtech
// SPDX-License-Identifier: Apache-2.0
```

Ne pas inventer de SPDX pour du code encore sous MIT seul (fichiers VS Code non touchés) : conserver le header Microsoft d'origine.

### 3.3 Conserver les notices d'origine — §4(c)

Interdit de supprimer les copyrights Microsoft, Glass Devtools, ou les notices de brevets/marques présentes dans les sources importées. Le nettoyage de branding Void (Phase 1) concerne les **marques et assets visuels** utilisés comme identité produit, pas les notices légales.

### 3.4 Redistribuer NOTICE — §4(d)

Le fichier `NOTICE` (et, dès l'import Void, `ThirdPartyNotices.txt`) doit voyager avec :

- le dépôt source ;
- la documentation livrée ;
- l'écran « À propos » de l'IDE, dès qu'il existe.

Le contenu de NOTICE n'altère pas la licence.

### 3.5 Absence de garantie — §7

Le logiciel est fourni « AS IS », sans garantie de titre, d'absence de contrefaçon, de qualité marchande ou d'adéquation à un usage particulier. Les communications marketing ne doivent pas contredire cette clause.

### 3.6 Limitation de responsabilité — §8

Sauf faute lourde ou obligation légale contraire, les contributeurs ne sont pas responsables des dommages indirects, perte d'exploitation, etc.

### 3.7 Marques — §6

Apache-2.0 **n'accorde aucun droit** d'utiliser les marques Kuunda, Kuunda Vibe, Kuunda Cloud, Void, Visual Studio Code, VS Code, Microsoft. L'usage autorisé se limite à décrire l'origine du code et à reproduire NOTICE.

### 3.8 Contributions — §5 + CLA

Sans CLA, une contribution volontaire au dépôt public est Apache-2.0. Le CLA du projet (voir `docs/legal/CLA-INDIVIDUAL.md` et `docs/legal/CLA-CORPORATE.md`) s'ajoute et prévaut en cas de conflit, conformément à la dernière phrase du §5.

## 4. Ce qu'Apache-2.0 n'oblige PAS

- Divulguer la logique commerciale hébergée dans un dépôt privé, si elle reste un travail **séparable** qui se contente de lier (par nom) aux interfaces publiques. Voir `docs/legal/COMPOSANTS-PROPRIETAIRES.md`.
- Accorder l'usage des marques.
- Fournir une garantie ou un support.

## 5. Interdits hérités de Microsoft / VS Code

Le dépôt ne doit jamais embarquer :

- la licence produit propriétaire de Visual Studio Code ;
- les binaires, icônes, noms, ou galerie d'extensions Microsoft non couverts par le MIT de Code - OSS ;
- les clés, certificats, ou identifiants développeur Microsoft.

C'est la même discipline que VSCodium et Void.

## 6. Checklist avant toute publication (source ou binaire)

- [ ] `LICENSE` (Apache-2.0 intégral, texte officiel non modifié) présent
- [ ] `LICENSE-VS-Code.txt` (MIT Microsoft) présent
- [ ] `NOTICE` présent et à jour
- [ ] `ThirdPartyNotices.txt` présent dès que le source Void/VS Code est importé
- [ ] Notices de modification sur les fichiers changés
- [ ] Aucun secret, clé API, ou identifiant store dans le dépôt
- [ ] Écran « À propos » (quand il existera) cite Microsoft, Void/Glass Devtools, Arowtech
- [ ] Installateurs incluent les fichiers de licence

Cette checklist est exécutée automatiquement par `npm test` (module `license-compliance`).
