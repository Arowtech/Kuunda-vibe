import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(relPath) {
	return readFileSync(join(root, relPath), 'utf8');
}

describe('Phase 4bis — branchement API d’extension', () => {
	it('workbench charge kuundaExt isolé et garde le format VSIX', () => {
		const main = read('src/vs/workbench/workbench.common.main.ts');
		assert.match(main, /contrib\/kuundaExt\/browser\/kuundaExt\.contribution\.js/);
		assert.match(main, /contrib\/void\/browser\/void\.contribution\.js/);
		const product = JSON.parse(read('product.json'));
		assert.match(product.extensionsGallery.serviceUrl, /open-vsx\.org/);
		assert.doesNotMatch(product.extensionsGallery.serviceUrl, /marketplace\.visualstudio\.com/);
		assert.ok(product.linkProtectionTrustedDomains.includes('https://open-vsx.org'));
	});

	it('l’API versionnée exige un grant avant agent/crédits/cloud', () => {
		const service = read('src/vs/workbench/contrib/kuundaExt/common/kuundaExtService.ts');
		assert.match(service, /decideKuundaApiAccess/);
		assert.match(service, /parseKuundaContribution/);
		assert.match(service, /redactApiPayload/);
		assert.match(service, /credits\.balance/);
		assert.match(service, /lastBalance/);
		assert.doesNotMatch(service, /getBalance\(/);
		assert.match(service, /getPolicyOverrides/);
		assert.match(service, /marketplaceSourceFromInstall/);
		assert.match(service, /canGrantPermission/);
		assert.match(service, /disabled/);
		const contrib = read('src/vs/workbench/contrib/kuundaExt/browser/kuundaExt.contribution.ts');
		assert.match(contrib, /kuunda\.api\.invoke/);
		assert.match(contrib, /kuunda\.ext\.grantAccess/);
		assert.match(contrib, /dialog\.confirm/);
		assert.match(contrib, /declaredPermissions/);
		assert.match(contrib, /kuundaExtPoint/);
		const point = read('src/vs/workbench/contrib/kuundaExt/common/kuundaExtPoint.ts');
		assert.match(point, /registerExtensionPoint/);
		assert.match(point, /extensionPoint: 'kuunda'/);
	});

	it('chaque clé nls Phase 4bis a en et fr distincts', () => {
		const strings = JSON.parse(read('src/vs/workbench/contrib/kuundaExt/common/strings.json'));
		const nlsSrc = read('src/vs/workbench/contrib/kuundaExt/common/kuundaExtNls.ts');
		for (const [key, value] of Object.entries(strings)) {
			assert.match(key, /^kuunda\.(ext|api)\./);
			assert.ok(value.en && value.fr);
			assert.notEqual(value.en, value.fr);
			assert.ok(nlsSrc.includes(value.en), `${key} en manquant`);
			assert.ok(nlsSrc.includes(value.fr), `${key} fr manquant`);
		}
	});
});
