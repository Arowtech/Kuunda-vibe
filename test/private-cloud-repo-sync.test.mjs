import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Les docs mélangent les deux apostrophes ; on n'en fait pas un critère.
const LANDING = /point(s)? d[\u2019']atterrissage/i;

const HUB = 'docs/codebase/README.md';
const SPECS = {
	12: 'docs/codebase/12-org-integration.md',
	13: 'docs/codebase/13-openrouter-ai-gateway.md',
	14: 'docs/codebase/14-pricing-catalog-admin.md'
};

function read(relPath) {
	return readFileSync(join(root, relPath), 'utf8');
}

// Ce qui est vérifié ici ne vient pas du dépôt public : c'est l'état relevé du dépôt privé
// `kuunda-vibe-cloud` (son README, 24 sept. 2026) et son report dans le hub et les specs.
const PRIVATE_TREE = [
	'apps/api',
	'apps/updates',
	'apps/web',
	'packages/kuunda-cloud-operator',
	'packages/update-control-plane',
	'packages/mobile-ci',
	'packages/feedback-plane',
	'sql/'
];

const PRIVATE_DOCS = [
	'BILLING.md',
	'PROVISIONING.md',
	'RELIABILITY.md',
	'LEGAL.md',
	'UPDATE-TRUST-CHAIN.md',
	'FEEDBACK.md'
];

describe('Synchronisation avec le dépôt privé kuunda-vibe-cloud', () => {
	it("le hub décrit l'arbre réel du dépôt privé", () => {
		const hub = read(HUB);
		for (const path of PRIVATE_TREE) {
			assert.ok(hub.includes(`\`${path}\``), `${HUB} doit décrire \`${path}\` du dépôt privé`);
		}
	});

	it("le hub nomme les docs internes du privé où chaque spec doit être reçue", () => {
		const hub = read(HUB);
		for (const doc of PRIVATE_DOCS) {
			assert.ok(hub.includes(`docs/${doc}`), `${HUB} doit nommer docs/${doc} du dépôt privé`);
		}
	});

	it('le hub donne le point d’atterrissage de chaque spec', () => {
		const hub = read(HUB);
		for (const spec of Object.values(SPECS)) {
			const name = spec.split('/').pop();
			assert.ok(hub.includes(`](${name})`), `${HUB} doit lier ${name} dans la table d'atterrissage`);
		}
		assert.ok(LANDING.test(hub), 'le hub doit annoncer la section d’atterrissage');
	});

	it('le hub déclare les deux prérequis non satisfaits du privé', () => {
		const hub = read(HUB);
		assert.ok(hub.includes('`501`'), "le hub doit signaler que l'authentification de session répond 501");
		assert.ok(/0003.*0004|0004.*0003/s.test(hub), 'le hub doit signaler les migrations 0003 / 0004 non appliquées');
		assert.ok(/non appliqués en prod/i.test(hub), 'le hub doit dire que les migrations ne sont pas appliquées en prod');
	});

	it('chaque spec nomme son point d’atterrissage dans apps/api', () => {
		for (const [id, spec] of Object.entries(SPECS)) {
			const doc = read(spec);
			assert.ok(doc.includes('apps/api'), `doc ${id} doit nommer apps/api comme point d'atterrissage`);
			assert.ok(LANDING.test(doc), `doc ${id} doit porter la ligne « Point d'atterrissage »`);
		}
	});

	it('le doc 13 traite la session 501 comme un prérequis bloquant, pas comme un détail', () => {
		const doc = read(SPECS[13]);
		assert.ok(doc.includes('501'), 'doc 13 doit nommer le 501 de la session');
		assert.ok(/prérequis bloquant/i.test(doc), 'doc 13 doit qualifier la session de prérequis bloquant');
		assert.ok(/avant le routage/i.test(doc), 'doc 13 doit ordonner session → ledger → passerelle');
	});

	it('le doc 12 distingue la délégation par clé (indépendante de la session) de la revendication', () => {
		const doc = read(SPECS[12]);
		assert.ok(doc.includes('501'), 'doc 12 doit nommer le 501 de la session');
		assert.ok(/n'en dépendent \*\*pas\*\*/.test(doc), 'doc 12 doit dire que la délégation par accountId ne dépend pas de la session');
	});

	it('le doc 14 situe la console, les routes et le ledger', () => {
		const doc = read(SPECS[14]);
		assert.ok(doc.includes('apps/web'), 'doc 14 doit situer la console dans apps/web');
		assert.ok(doc.includes('sql/0001'), 'doc 14 doit rattacher la version publiée au ledger sql/0001');
	});

	it('le job de relecture des prix reste un job, jamais une publication automatique', () => {
		const doc = read(SPECS[14]);
		assert.ok(/job du Worker `apps\/api`/.test(doc), 'doc 14 doit dire où tourne le job de relecture');
		assert.ok(/jamais une publication automatique/.test(doc), 'doc 14 doit interdire la republication automatique');
	});
});
