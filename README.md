# Kuunda Vibe

IDE desktop open source, fork de [Void](https://github.com/voideditor/void) (lui-même fork de [Code - OSS](https://github.com/microsoft/vscode)).

**Steward :** Arowtech
**Dépôt public :** https://github.com/Arowtech/Kuunda-vibe.git
**Licence du travail Arowtech et du dérivé Void :** [Apache License 2.0](LICENSE)
**Cœur éditeur Microsoft Code - OSS :** [MIT](LICENSE-VS-Code.txt)
**Attribution :** [NOTICE](NOTICE)

Ce logiciel est fourni « AS IS », sans garantie. Les marques Kuunda, Kuunda Vibe, Void, Visual Studio Code et Microsoft ne sont pas concédées par ces licences.

## État du dépôt

Phase 0 (licence et gouvernance) est en place. Le source Void / VS Code n'est pas encore importé.

- Contribuer : [CONTRIBUTING.md](CONTRIBUTING.md)
- Gouvernance : [GOVERNANCE.md](GOVERNANCE.md)
- Guide interne : [docs/codebase/README.md](docs/codebase/README.md)
- Frontière public / privé : [docs/legal/COMPOSANTS-PROPRIETAIRES.md](docs/legal/COMPOSANTS-PROPRIETAIRES.md)

## Tests

Cible : Node.js 24 LTS. Les tests de licence s'exécutent aussi sur Node.js 22 (Maintenance LTS).

```bash
npm test
```
