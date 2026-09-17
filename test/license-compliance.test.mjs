import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(relPath) {
	return readFileSync(join(root, relPath), 'utf8');
}

const SKIP_DIRS = new Set([
	'.git',
	'node_modules',
	'src',
	'extensions',
	'build',
	'cli',
	'out',
	'resources',
	'.build'
]);

function walkFiles(dir, acc = []) {
	for (const entry of readdirSync(dir)) {
		if (SKIP_DIRS.has(entry)) {
			continue;
		}
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			walkFiles(full, acc);
		} else {
			acc.push(full);
		}
	}
	return acc;
}

describe('Phase 0 — fichiers de gouvernance', () => {
	const manifest = JSON.parse(read('docs/legal/license-manifest.json'));

	it('le manifeste licence est cohérent', () => {
		assert.equal(manifest.projectLicense, 'Apache-2.0');
		assert.equal(manifest.steward, 'Arowtech');
		assert.equal(manifest.originalWork.copyrightHolder, 'Arowtech');
		assert.ok(manifest.phase === 0 || manifest.phase === 1 || manifest.phase === 2 || manifest.phase === 3 || manifest.phase === '3bis');
		assert.ok(manifest.upstream.some((u) => u.copyrightHolder === 'Microsoft Corporation' && u.license === 'MIT'));
		assert.ok(manifest.upstream.some((u) => u.copyrightHolder === 'Glass Devtools, Inc.' && u.license === 'Apache-2.0'));
	});

	it('tous les fichiers racine obligatoires existent et sont non vides', () => {
		for (const file of manifest.requiredRootFiles) {
			const content = read(file);
			assert.ok(content.trim().length > 0, `${file} est vide`);
		}
	});

	it('LICENSE est le texte Apache License 2.0 officiel non modifié', () => {
		const license = read('LICENSE');
		assert.match(license, /Apache License/);
		assert.match(license, /Version 2\.0, January 2004/);
		assert.match(license, /http:\/\/www\.apache\.org\/licenses\//);
		assert.match(license, /4\. Redistribution/);
		assert.match(license, /5\. Submission of Contributions/);
		assert.match(license, /6\. Trademarks/);
		assert.match(license, /7\. Disclaimer of Warranty/);
		assert.match(license, /8\. Limitation of Liability/);
		assert.match(license, /AS IS/);
		assert.match(license, /WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND/);
		assert.match(license, /Copyright \[yyyy\] \[name of copyright owner\]/);
		assert.doesNotMatch(license, /Copyright 2026 Arowtech/);
		assert.doesNotMatch(license, /Glass Devtools/);
		assert.doesNotMatch(license, /LICENSE-VS-Code/);
	});

	it('LICENSE-VS-Code.txt conserve le MIT Microsoft', () => {
		const mit = read('LICENSE-VS-Code.txt');
		assert.match(mit, /MIT License/);
		assert.match(mit, /Copyright \(c\) 2015 - present Microsoft Corporation/);
		assert.match(mit, /Permission is hereby granted, free of charge/);
		assert.match(mit, /THE SOFTWARE IS PROVIDED "AS IS"/);
		assert.match(mit, /Void/);
		assert.match(mit, /Kuunda Vibe/);
		assert.doesNotMatch(mit, /Visual Studio Code product license does apply to this repository/);
	});

	it('NOTICE conserve la chaîne Microsoft → Void → Arowtech', () => {
		const notice = read('NOTICE');
		const microsoft = notice.indexOf('Copyright (c) 2015 - present Microsoft Corporation');
		const voidNotice = notice.indexOf('Copyright 2025 Glass Devtools, Inc.');
		const arowtech = notice.lastIndexOf('Copyright 2026 Arowtech');
		assert.ok(microsoft >= 0, 'copyright Microsoft absent');
		assert.ok(voidNotice >= 0, 'copyright Void/Glass Devtools absent');
		assert.ok(arowtech >= 0, 'copyright Arowtech absent');
		assert.ok(microsoft < voidNotice, 'Microsoft doit précéder Void');
		assert.ok(voidNotice < arowtech, 'Void doit précéder Arowtech');
		assert.match(notice, /MIT License/);
		assert.match(notice, /Apache License, Version 2\.0/);
		assert.match(notice, /AS IS/);
		assert.match(notice, /does not grant permission to use the trade\s+names/);
		assert.match(notice, /Limitation of Liability \(Apache License 2\.0 §8\)/);
		assert.match(notice, /ThirdPartyNotices\.txt/);
		assert.match(notice, /Void \(https:\/\/github.com\/voideditor\/void\) does not ship a NOTICE file/);
	});

	it('NOTICE et le manifeste listent les mêmes modules propriétaires exclus', () => {
		const notice = read('NOTICE');
		const policy = read('docs/legal/COMPOSANTS-PROPRIETAIRES.md');
		for (const name of manifest.proprietaryExcluded) {
			assert.ok(policy.includes(name), `politique propriétaire sans ${name}`);
		}
		assert.match(notice, /Billing \/ credits ledger/);
		assert.match(notice, /Genius Pay/);
		assert.match(notice, /Kuunda Cloud platform provisioning/);
		assert.match(notice, /IDE update signing-key custody/);
		assert.match(policy, /Arowtech\/kuunda-vibe-cloud/);
		assert.match(policy, /ne vivent pas/);
	});
});

describe('Phase 0 — obligations Apache-2.0 documentées', () => {
	it('le guide d’obligations couvre §4(a)(b)(c)(d), §6, §7, §8', () => {
		const doc = read('docs/legal/OBLIGATIONS-APACHE-2.0.md');
		assert.match(doc, /§4\(a\)/);
		assert.match(doc, /§4\(b\)/);
		assert.match(doc, /§4\(c\)/);
		assert.match(doc, /§4\(d\)/);
		assert.match(doc, /§6/);
		assert.match(doc, /§7/);
		assert.match(doc, /§8/);
		assert.match(doc, /notice de modification/i);
		assert.match(doc, /sans garantie/i);
	});
});

describe('Phase 0 — contribution et CLA', () => {
	it('CONTRIBUTING et GOVERNANCE imposent le CLA et les règles de PR', () => {
		const contributing = read('CONTRIBUTING.md');
		const governance = read('GOVERNANCE.md');
		assert.match(contributing, /CLA-INDIVIDUAL\.md/);
		assert.match(contributing, /CLA-CORPORATE\.md/);
		assert.match(governance, /CLA obligatoire/);
		assert.match(governance, /Revue obligatoire/);
		assert.match(governance, /CI verte obligatoire/);
		assert.match(governance, /Aucun secret/);
		assert.match(read('.github/PULL_REQUEST_TEMPLATE.md'), /Individual CLA/);
	});

	it('les CLA accordent copyright et brevet à Arowtech et justifient le §5', () => {
		for (const file of ['docs/legal/CLA-INDIVIDUAL.md', 'docs/legal/CLA-CORPORATE.md']) {
			const cla = read(file);
			assert.match(cla, /Grant of Copyright License/);
			assert.match(cla, /Grant of Patent License/);
			assert.match(cla, /Arowtech/);
			assert.match(cla, /Apache License, Version 2\.0/);
			assert.match(cla, /AS IS/);
			assert.match(cla, /English text below prevails/);
			assert.match(cla, /Why this CLA exists \(Apache License 2\.0 §5\)/);
			assert.match(cla, /Arowtech\/kuunda-vibe-cloud/);
			assert.match(cla, /separate license agreement/);
		}
	});
});

describe('Phase 0 — CI secret scan', () => {
	it('le workflow Gitleaks CLI est présent et ne dépend pas de GITLEAKS_LICENSE', () => {
		const workflow = read('.github/workflows/secret-scan.yml');
		assert.match(workflow, /name: gitleaks/);
		assert.match(workflow, /GITLEAKS_VERSION: "8\.30\.1"/);
		assert.match(workflow, /gitleaks detect/);
		assert.match(workflow, /--exit-code 1/);
		assert.match(workflow, /--config \.gitleaks\.toml/);
		assert.doesNotMatch(workflow, /uses:\s*gitleaks\/gitleaks-action/);
		assert.equal(existsSync(join(root, '.gitleaks.toml')), true);
		assert.doesNotMatch(workflow, /secrets\.GITLEAKS_LICENSE/);
		const gitleaksConfig = read('.gitleaks.toml');
		assert.match(gitleaksConfig, /useDefault\s*=\s*true/);
		assert.match(gitleaksConfig, /"aiKey"/);
		assert.match(gitleaksConfig, /uri\.test\.ts/);
	});
});

describe('Phase 0 — absence de secrets versionnés', () => {
	const suspicious =
		/(sk-[A-Za-z0-9]{10,}|ghp_[A-Za-z0-9]{20,}|AKIA[0-9A-Z]{16}|BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY)/;

	it('aucun fichier suivi ne contient de motif de secret', () => {
		const files = walkFiles(root);
		const offenders = [];
		for (const file of files) {
			if (file.endsWith('.test.mjs')) {
				continue;
			}
			const text = readFileSync(file, 'utf8');
			if (suspicious.test(text)) {
				offenders.push(relative(root, file));
			}
		}
		assert.deepEqual(offenders, []);
	});

	it('le manifeste ne contient pas de credential', () => {
		const manifest = read('docs/legal/license-manifest.json');
		assert.doesNotMatch(manifest, /api[_-]?key/i);
		assert.doesNotMatch(manifest, /secret/i);
		assert.doesNotMatch(manifest, /password/i);
	});
});

describe('Phase 0 — package public', () => {
	it('package.json reste Apache-2.0 et les tests Kuunda restent le script test', () => {
		const pkg = JSON.parse(read('package.json'));
		assert.equal(pkg.license, 'Apache-2.0');
		assert.equal(pkg.private, true);
		assert.equal(pkg.author.name, 'Arowtech');
		assert.match(pkg.scripts.test, /test\/license-compliance\.test\.mjs/);
		assert.match(pkg.scripts.test, /packages\/cloud-client\/test\/cloud-client\.test\.mjs/);
		assert.match(pkg.scripts.test, /test\/branding\.test\.mjs/);
		assert.match(pkg.scripts.test, /packages\/kuunda-ai\/test\/kuunda-ai\.test\.mjs/);
		assert.match(pkg.scripts.test, /test\/kuunda-ai-wiring\.test\.mjs/);
		assert.match(pkg.scripts.test, /test\/kuunda-agent-wiring\.test\.mjs/);
		assert.match(pkg.scripts.test, /test\/kuunda-billing-wiring\.test\.mjs/);
		assert.equal(existsSync(join(root, 'test/license-compliance.test.mjs')), true);
		assert.equal(existsSync(join(root, 'ThirdPartyNotices.txt')), true);
	});
});
