import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(relPath) {
	return readFileSync(join(root, relPath), 'utf8');
}

describe('Phase 3bis — branchement crédits IDE', () => {
	it('workbench charge kuundaBilling isolé', () => {
		const main = read('src/vs/workbench/workbench.common.main.ts');
		assert.match(main, /contrib\/kuundaBilling\/browser\/kuundaBilling\.contribution\.js/);
	});

	it('l’agent consulte le solde puis enregistre la conso', () => {
		const chat = read('src/vs/workbench/contrib/void/browser/chatThreadService.ts');
		assert.match(chat, /IKuundaBillingService/);
		assert.match(chat, /ensureCanRunAgent/);
		assert.match(chat, /recordUsage/);
	});

	it('le client public a signup / consume / checkout sans secret', () => {
		const http = read('packages/cloud-client/src/http-client.js');
		assert.match(http, /\/v1\/credits\/signup/);
		assert.match(http, /\/v1\/credits\/consume/);
		assert.match(http, /\/v1\/billing\/checkout/);
		assert.doesNotMatch(http, /sk_|whsec_|BEGIN /);
		const contracts = read('packages/cloud-client/src/contracts.js');
		assert.match(contracts, /classifyPaymentFailure/);
		assert.match(contracts, /creditAlertLevel/);
	});

	it('chaque clé nls kuundaBilling a en et fr distincts', () => {
		const strings = JSON.parse(read('src/vs/workbench/contrib/kuundaBilling/common/strings.json'));
		const nlsSrc = read('src/vs/workbench/contrib/kuundaBilling/common/kuundaBillingNls.ts');
		for (const [key, value] of Object.entries(strings)) {
			assert.match(key, /^kuunda\.billing\./);
			assert.ok(value.en && value.fr);
			assert.notEqual(value.en, value.fr);
			assert.ok(nlsSrc.includes(value.en), `${key} en manquant`);
			assert.ok(nlsSrc.includes(value.fr), `${key} fr manquant`);
		}
	});

	it('aucun tarif XOF n’est figé dans le dépôt public', () => {
		const billing = read('src/vs/workbench/contrib/kuundaBilling/common/creditPolicy.ts');
		assert.doesNotMatch(billing, /XOF|5000|15000/);
		const contrib = read('src/vs/workbench/contrib/kuundaBilling/browser/kuundaBilling.contribution.ts');
		assert.doesNotMatch(contrib, /geniuspay\.ci\/checkout\?/);
	});
});
