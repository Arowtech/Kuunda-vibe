# Kuunda Vibe

IDE desktop open source, fork de [Void](https://github.com/voideditor/void) (lui-même fork de [Code - OSS](https://github.com/microsoft/vscode)).

**Steward :** Arowtech
**Dépôt public :** https://github.com/Arowtech/Kuunda-vibe.git
**Licence du travail Arowtech et du dérivé Void :** [Apache License 2.0](LICENSE)
**Cœur éditeur Microsoft Code - OSS :** [MIT](LICENSE-VS-Code.txt)
**Attribution :** [NOTICE](NOTICE) · [ThirdPartyNotices.txt](ThirdPartyNotices.txt)

Ce logiciel est fourni « AS IS », sans garantie. Les marques Kuunda, Kuunda Vibe, Void, Visual Studio Code et Microsoft ne sont pas concédées par ces licences.

## État du dépôt

Phase 10 (feedback opt-in, plan upstream) en cours. Politiques : [docs/legal/PRIVACY-POLICY.md](docs/legal/PRIVACY-POLICY.md), [conditions](docs/legal/TERMS-OF-USE.md), [remboursements](docs/legal/REFUND-POLICY.md).

- Contribuer : [CONTRIBUTING.md](CONTRIBUTING.md)
- Gouvernance : [GOVERNANCE.md](GOVERNANCE.md)
- Guide interne : [docs/codebase/README.md](docs/codebase/README.md)
- Frontière public / privé : [docs/legal/COMPOSANTS-PROPRIETAIRES.md](docs/legal/COMPOSANTS-PROPRIETAIRES.md)
- Agrégateurs de paiement (pluggables) : [docs/legal/PAYMENT-AGGREGATORS.md](docs/legal/PAYMENT-AGGREGATORS.md)

## Tests Kuunda

Cible : Node.js 24 LTS.

```bash
npm test
```

La compilation Electron (scripts Void/VS Code) est séparée : `npm run test-vscode` n'est qu'un rappel vers `scripts/`.
