# Contribuer à Kuunda Vibe

Merci. Lisez d'abord `GOVERNANCE.md`, `NOTICE`, `LICENSE` et `docs/legal/COMPOSANTS-PROPRIETAIRES.md`.

## Avant d'écrire du code

1. Vérifiez que le sujet n'appartient pas à un module **privé** (facturation, agrégateur de paiement, provisioning opérateur Kuunda Cloud, custody des clés de mise à jour). Ces sujets ne sont pas acceptés dans ce dépôt. L'adaptateur Genius Pay actuel n'est pas le seul PSP possible ; le code public doit rester agnostique.
2. Signez le CLA :
   - personne physique : `docs/legal/CLA-INDIVIDUAL.md`
   - entité : `docs/legal/CLA-CORPORATE.md`
3. Sur votre première PR, collez : `I have read and agree to the Kuunda Vibe Individual CLA.` (ou l'équivalent corporate). Le job CI `cla` bloque le merge tant que la phrase est absente.

Les employés Arowtech (association GitHub `OWNER` / `MEMBER`) n'ont pas à signer le CLA externe.

## Environnement de test (Phase 0)

Choix technique : **Node.js 24.x LTS (Krypton)** et le test runner **natif** `node:test`, sans dépendance npm. Justification : Phase 0 ne doit pas tirer Electron, VS Code ni un framework de test avant l'import du fork Void. Node 24 est l'Active LTS au moment de cette phase (dernière version stable constatée : 24.21.0, npm 11.19.0 bundlé).

```bash
node --version   # >= 24
npm test
```

Aucune extension VS Code / Open VSX n'est requise en Phase 0.

## Règles de PR (résumé)

- Une préoccupation par PR.
- Tests verts.
- Aucun secret.
- Notice de modification sur les fichiers hérités changés.
- Pas de reformatage gratuit de `src/vs/`.
- Description en français ou en anglais : problème, approche, risques licence.

Le modèle GitHub est dans `.github/PULL_REQUEST_TEMPLATE.md`.

## Signaler une faille

N'ouvrez pas d'issue publique. Utilisez les GitHub Security Advisories du dépôt, ou un canal privé indiqué par Arowtech. N'incluez pas de secrets dans le rapport au-delà du minimum nécessaire à la reproduction.

## Code of conduct

Voir `CODE_OF_CONDUCT.md`.
