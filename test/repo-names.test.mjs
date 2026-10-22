import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

// Les trois dépôts, vérifiés sur GitHub avec le compte `Arowtech` (24 sept. 2026).
const PUBLIC_REPO = 'Arowtech/Kuunda-vibe'; // public, Apache-2.0
const PRIVATE_REPO = 'Arowtech/kuunda-vibe-cloud'; // privé : composants commerciaux séparables
const PLATFORM_REPO = 'Arowtech/kuunda-cloud'; // privé : plateforme Kuunda Cloud (dashboard, facturation)

// Seul endroit autorisé à nommer le dépôt plateforme, avec sa mise en garde.
const DOC_HUB = 'docs/codebase/README.md';

// Ce fichier de garde contient forcément les trois littéraux (il les définit) :
// il est le seul à pouvoir les citer hors du hub, et uniquement pour les tester.
const GUARD = 'test/repo-names.test.mjs';

function read(relPath) {
	return readFileSync(join(root, relPath), 'utf8');
}

// `src` est parcouru séparément et de façon ciblée (contributions Kuunda uniquement) :
// VS Code entier est trop volumineux pour un scan texte global.
const SKIP_DIRS = new Set(['.git', 'node_modules', 'src', 'build', 'cli', 'out', '.build', 'extensions', 'resources']);

function walk(dir, acc = []) {
	for (const entry of readdirSync(dir)) {
		if (SKIP_DIRS.has(entry)) {
			continue;
		}
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			walk(full, acc);
		} else {
			acc.push(full);
		}
	}
	return acc;
}

function kuundaSourceFiles() {
	const contrib = join(root, 'src', 'vs', 'workbench', 'contrib');
	const acc = [];
	for (const entry of readdirSync(contrib)) {
		if (entry.startsWith('kuunda')) {
			walk(join(contrib, entry), acc);
		}
	}
	return acc;
}

function scanText(files) {
	return files.map((file) => ({
		file: relative(root, file).split('\\').join('/'),
		text: readFileSync(file, 'utf8')
	}));
}

function proprietaryRepo(text) {
	const match = text.match(/proprietaryRepo:\s*'([^']+)'/);
	return match ? match[1] : undefined;
}

const scanned = scanText([...walk(root), ...kuundaSourceFiles()]);

describe('Frontière des dépôts — noms verrouillés (Phase 0.2)', () => {
	it('les trois noms sont distincts et sans ambiguïté de graphie', () => {
		assert.notEqual(PUBLIC_REPO, PRIVATE_REPO);
		assert.notEqual(PRIVATE_REPO, PLATFORM_REPO);
		assert.notEqual(PUBLIC_REPO, PLATFORM_REPO);
		// `kuunda-cloud` ne doit pas être un fragment de `kuunda-vibe-cloud` :
		// c'est ce qui permet de refuser la graphie nue sans faux positif.
		assert.equal(PLATFORM_REPO.includes(PRIVATE_REPO), false);
		assert.equal(
			PRIVATE_REPO.includes('kuunda-cloud'),
			false,
			'un renommage qui rendrait les deux noms embriqués rendrait la confusion indétectable'
		);
	});

	it('le dépôt public est Arowtech/Kuunda-vibe partout où il est identifié', () => {
		const manifest = JSON.parse(read('docs/legal/license-manifest.json'));
		assert.equal(manifest.publicRepository, `https://github.com/${PUBLIC_REPO}.git`);

		const product = JSON.parse(read('product.json'));
		assert.ok(product.licenseUrl.includes(PUBLIC_REPO), 'product.json licenseUrl');

		const notice = read('NOTICE');
		assert.ok(notice.includes(`https://github.com/${PUBLIC_REPO}`), 'NOTICE source du travail original');

		for (const file of ['docs/legal/CLA-INDIVIDUAL.md', 'docs/legal/CLA-CORPORATE.md']) {
			assert.ok(read(file).includes(`public repository \`${PUBLIC_REPO}\``), `${file} — dépôt public`);
		}

		assert.ok(read('docs/legal/COMPOSANTS-PROPRIETAIRES.md').includes(PUBLIC_REPO), 'COMPOSANTS — dépôt public');
		assert.ok(read('.github/workflows/cla.yml').includes(PUBLIC_REPO), 'workflow CLA — lien vers le dépôt public');
	});

	it('la frontière propriétaire du dépôt public est Arowtech/kuunda-vibe-cloud', () => {
		for (const file of [
			'GOVERNANCE.md',
			'NOTICE',
			'docs/legal/CLA-INDIVIDUAL.md',
			'docs/legal/CLA-CORPORATE.md',
			'docs/legal/COMPOSANTS-PROPRIETAIRES.md',
			'docs/codebase/03bis-credits.md',
			'packages/cloud-client/src/contracts.js',
			'packages/cloud-client/src/pricing-catalog.js',
			'packages/kuunda-ai/src/cloud-provision.js',
			'packages/kuunda-ai/src/publish-policy.js'
		]) {
			assert.ok(read(file).includes('kuunda-vibe-cloud'), `${file} doit nommer la frontière propriétaire`);
		}
	});

	it('legalPolicy TS et JS désignent le même dépôt propriétaire', () => {
		const js = proprietaryRepo(read('packages/kuunda-ai/src/legal-policy.js'));
		const ts = proprietaryRepo(read('src/vs/workbench/contrib/kuundaLegal/common/legalPolicy.ts'));
		assert.equal(js, PRIVATE_REPO, 'legal-policy.js — proprietaryRepo');
		assert.equal(ts, PRIVATE_REPO, 'legalPolicy.ts — proprietaryRepo');
		assert.equal(ts, js, 'le miroir TS doit rester aligné sur le JS');
	});

	it('le dépôt plateforme n’est nommé que dans le hub, jamais comme frontière du public', () => {
		const hits = scanned
			.filter(({ text }) => text.includes(PLATFORM_REPO))
			.map((hit) => hit.file)
			.sort();
		assert.deepEqual(
			hits,
			[DOC_HUB, GUARD].sort(),
			`seuls ${DOC_HUB} et son test de garde peuvent nommer ${PLATFORM_REPO} ; la frontière propriétaire du dépôt public est ${PRIVATE_REPO}. ` +
				'Ajouter le dépôt plateforme ailleurs exige de le justifier ici, pas de contourner.'
		);

		const hub = read(DOC_HUB);
		assert.ok(hub.includes('ne désignent **pas** la frontière propriétaire'), 'le hub doit porter la mise en garde');
		assert.ok(hub.includes(`\`${PRIVATE_REPO}\``), 'le hub doit nommer la frontière réelle');
		assert.ok(hub.includes('Destinataire des specs 12/13/14'), 'le hub doit dire où vont les specs');
	});

	it('aucun fichier ne nomme la frontière avec la graphie nue `kuunda-cloud`', () => {
		const bare = /`kuunda-cloud`/;
		// `GUARD` cite la graphie interdite dans son propre message d'erreur : il est exclu par construction.
		const offenders = scanned
			.filter(({ file }) => file !== GUARD)
			.filter(({ text }) => bare.test(text))
			.map(({ file }) => file);
		assert.deepEqual(
			offenders,
			[],
			'un nom de dépôt écrit sans son propriétaire prête à confusion : écrire ' +
				`\`${PRIVATE_REPO}\` pour la frontière, \`${PLATFORM_REPO}\` pour la plateforme`
		);
	});

	it('le hub du codebase décrit les trois dépôts', () => {
		const hub = read(DOC_HUB);
		for (const repo of [PUBLIC_REPO, PRIVATE_REPO, PLATFORM_REPO]) {
			assert.ok(hub.includes(repo), `${DOC_HUB} doit décrire ${repo}`);
		}
	});

	it('les specs 12, 13 et 14 nomment le dépôt privé, jamais le dépôt plateforme', () => {
		for (const file of [
			'docs/codebase/12-org-integration.md',
			'docs/codebase/13-openrouter-ai-gateway.md',
			'docs/codebase/14-pricing-catalog-admin.md'
		]) {
			const doc = read(file);
			assert.ok(doc.includes('kuunda-vibe-cloud'), `${file} doit nommer le dépôt privé`);
			assert.equal(doc.includes(PLATFORM_REPO), false, `${file} ne doit pas viser le dépôt plateforme`);
		}
	});

	it('le test de conformité licence verrouille le même nom', () => {
		const compliance = read('test/license-compliance.test.mjs');
		assert.ok(/Arowtech\\\/kuunda-vibe-cloud/.test(compliance), 'le test de conformité doit verrouiller kuunda-vibe-cloud');
		assert.equal(compliance.includes(PLATFORM_REPO), false, 'le test de conformité ne doit pas nommer le dépôt plateforme');
	});
});
