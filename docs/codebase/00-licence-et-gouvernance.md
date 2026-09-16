# 00 — Licence et gouvernance

**Phase :** 0
**Validation steward :** en attente
**Tests :** `npm test` → `test/license-compliance.test.mjs`

## Objectif

Figer, avant tout code d'éditeur :

1. la licence du dépôt public ;
2. la frontière avec les composants propriétaires ;
3. `LICENSE`, `LICENSE-VS-Code.txt`, `NOTICE` ;
4. CLA, règles de PR, gouvernance.

## Choix techniques (Phase 0)

Aucun runtime d'IDE, aucune extension VS Code/Open VSX, aucun framework UI.

| Outil | Version visée au moment de l'implémentation | Justification |
| --- | --- | --- |
| Langage des tests | JavaScript ESM (pas TypeScript) | Zéro compilateur avant l'import Void. Le runner Node exécute les fichiers directement. |
| Runtime | **Node.js 24.x Active LTS (Krypton)**, constaté **24.21.0** (8 sept. 2026) | LTS supportée jusqu'au 30 avril 2028. Node 26 est Current, pas encore LTS. Les tests de cette phase ont été exécutés avec succès sur **Node 22.12.0** (Maintenance LTS présent sur la machine de dev) ; `node:test` n'exige pas 24. |
| npm | **11.19.0** (bundlé avec Node 24.21.0) | Pas d'installation globale séparée. |
| Framework de test | **`node:test` + `node:assert/strict`** (stdlib) | Pas de Mocha/Jest/Vitest en Phase 0 : moins de surface CVE, pas de `node_modules` pour valider des fichiers légaux. |
| Dépendances npm | **aucune** | La conformité licence ne doit pas dépendre d'un paquet tiers. |
| Extensions Open VSX | aucune | Pas d'éditeur encore. |

Ces versions seront réévaluées en Phase 1 quand le `package.json` de Void/VS Code imposera éventuellement une autre ligne Node (historiquement Node 20+ pour VS Code). En cas de conflit, **le `engines` du fork Void prime** pour compiler l'IDE ; les tests de licence resteront compatibles Node 18+ (`node:test`).

## Décisions

### 0.1 Licence

**Apache License 2.0** pour les contributions Arowtech et le travail dérivé de Void.

Le cœur Code - OSS reste **MIT** (Microsoft). Les deux textes voyagent ensemble.

Obligations Apache vérifiées et documentées dans `docs/legal/OBLIGATIONS-APACHE-2.0.md` :

- copie de la licence (§4(a)) ;
- notice de modification (§4(b)) ;
- conservation des notices d'origine (§4(c)) ;
- redistribution de `NOTICE` (§4(d)) ;
- pas de garantie (§7) ;
- limitation de responsabilité (§8) ;
- pas de licence de marque (§6).

### 0.2 Composants propriétaires

**Dépôt privé séparé.** Pas de logique billing / Genius Pay / opérateur Kuunda Cloud / custody des clés de signature dans `Arowtech/Kuunda-vibe`.

Détail : `docs/legal/COMPOSANTS-PROPRIETAIRES.md`.

### 0.3 Fichiers de licence

| Fichier | Contenu |
| --- | --- |
| `LICENSE` | Apache-2.0 officiel, texte intégral non modifié (copyrights dans NOTICE) |
| `LICENSE-VS-Code.txt` | MIT Microsoft + clarification Void / Kuunda Vibe |
| `NOTICE` | Attribution Microsoft → Glass Devtools/Void → Arowtech, liste des modules exclus, politique ThirdPartyNotices |

### 0.4 Contributions

- CLA individuel + CLA corporate (`docs/legal/CLA-*.md`).
- Gouvernance steward Arowtech (`GOVERNANCE.md`).
- PR template.
- Code of conduct (Contributor Covenant 2.1).

Le CLA existe **en plus** d'Apache §5 : il autorise Arowtech à réutiliser une contribution dans les composants propriétaires séparables, et confirme le grant de brevet.

## Point ouvert à confirmer par le steward

La raison sociale exacte du titulaire (« Arowtech ») et la juridiction doivent être confirmées **avant la première publication GitHub publique**. Les fichiers utilisent « Arowtech », aligné sur `https://github.com/Arowtech/Kuunda-vibe.git`. Si la société s'appelle autrement (ex. dénomination au registre du commerce), il faudra un commit isolé de correction sur `NOTICE`, CLA et ce guide — toujours en Phase 0, pas plus tard « en passant ». Le fichier `LICENSE` reste le texte Apache officiel non modifié.

## Hors périmètre (volontaire)

- Pas d'import du source Void.
- Pas de Cloudflare, pas de DNS, pas de Dependabot (Phase 0bis).
- Pas de `src/vs/`.
- Pas de commit / push (le steward le demandera explicitement).
