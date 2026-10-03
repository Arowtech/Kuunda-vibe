import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
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
		assert.match(http, /\/v1\/billing\/transactions/);
		assert.match(http, /fetchWithTimeout/);
		assert.doesNotMatch(http, /sk_|whsec_|BEGIN /);
		const contracts = read('packages/cloud-client/src/contracts.js');
		assert.match(contracts, /classifyPaymentFailure/);
		assert.match(contracts, /creditAlertLevel/);
	});

	it('l’IDE appelle checkout, plans et transactions (pas seulement le contrat)', () => {
		const service = read('src/vs/workbench/contrib/kuundaBilling/common/kuundaBillingService.ts');
		assert.match(service, /startCheckout/);
		assert.match(service, /listPlans/);
		assert.match(service, /listTransactions/);
		assert.match(service, /\/v1\/billing\/checkout/);
		assert.match(service, /paymentFailureMessage/);
		assert.match(service, /notifyAlertOnce/);
		const contrib = read('src/vs/workbench/contrib/kuundaBilling/browser/kuundaBilling.contribution.ts');
		assert.match(contrib, /kuunda\.billing\.checkout/);
		assert.match(contrib, /startCheckout/);
		assert.match(contrib, /listPlans/);
		const nls = read('src/vs/workbench/contrib/kuundaBilling/common/kuundaBillingNls.ts');
		assert.match(nls, /paymentFailureMessage/);
		assert.match(nls, /classifyPaymentFailure/);
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

	it('le catalogue tarifaire USD est publié par le dashboard, jamais figé dans l’IDE', () => {
		const ts = read('src/vs/workbench/contrib/kuundaBilling/common/pricingCatalog.ts');
		const js = read('packages/cloud-client/src/pricing-catalog.js');
		for (const fn of [
			'perTokenToPerMillion',
			'fromOpenRouterPricing',
			'resolveModelPricing',
			'blendedCostUsdPerMillion',
			'creditsPerMillionFromCost',
			'realCostUsd',
			'creditsForUsage',
			'planCreditsFromPrice',
			'estimateCredits',
			'validatePricingCatalog',
		]) {
			assert.ok(ts.includes(`function ${fn}`), `${fn} absent du miroir TypeScript`);
			assert.ok(js.includes(`function ${fn}`), `${fn} absent du module public`);
		}
		assert.match(js, /PRICING_CATALOG_CURRENCY = 'USD'/);
		assert.match(ts, /currency: PricingCurrency/);
		assert.doesNotMatch(js, /priceUsd: \d/);
		assert.doesNotMatch(js, /includedCredits: \d/);
	});

	it('l’IDE consomme le catalogue publié et garde le dernier valide', () => {
		const service = read('src/vs/workbench/contrib/kuundaBilling/common/kuundaBillingService.ts');
		assert.match(service, /PRICING_CATALOG_PATH/);
		assert.match(service, /getPricingCatalog/);
		assert.match(service, /lastPricingCatalog/);
		assert.match(service, /validatePricingCatalog/);
		assert.match(service, /estimateCreditsFromCatalog/);
		const http = read('packages/cloud-client/src/http-client.js');
		assert.match(http, /getPricingCatalog/);
		const contracts = read('packages/cloud-client/src/contracts.js');
		assert.match(contracts, /IPricingCatalogClient/);
	});

	it('aucun tarif XOF n’est figé dans le dépôt public', () => {
		const billing = read('src/vs/workbench/contrib/kuundaBilling/common/creditPolicy.ts');
		assert.doesNotMatch(billing, /XOF|5000|15000/);
		const contrib = read('src/vs/workbench/contrib/kuundaBilling/browser/kuundaBilling.contribution.ts');
		assert.doesNotMatch(contrib, /geniuspay\.ci\/checkout\?/);
	});
});

describe('Phase 3bis — specs cloud synchronisées avec le code', () => {
	it('la table des codes de refus du doc 14 est exactement celle du code', () => {
		const js = read('packages/cloud-client/src/pricing-catalog.js');
		const doc = read('docs/codebase/14-pricing-catalog-admin.md');
		const block = /PRICING_VALIDATION_CODES = Object\.freeze\(\[([\s\S]*?)\]\)/.exec(js);
		assert.ok(block, 'PRICING_VALIDATION_CODES absent du module public');
		const declared = [...block[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
		assert.ok(declared.length >= 20, `seulement ${declared.length} codes déclarés`);

		const emitted = new Set();
		for (const m of js.matchAll(/push\(\s*['"`]([a-z_]+)/g)) {
			emitted.add(m[1]);
		}
		for (const m of js.matchAll(/errors:\s*\[([^\]]*)\]/g)) {
			for (const q of m[1].matchAll(/'([^']+)'/g)) {
				emitted.add(q[1]);
			}
		}

		for (const code of declared) {
			assert.ok(emitted.has(code), `${code} déclaré mais jamais émis`);
			assert.ok(doc.includes(`\`${code}\``), `${code} absent du doc 14`);
		}
		for (const code of emitted) {
			assert.ok(declared.includes(code), `${code} émis mais non déclaré ni documenté`);
		}
	});

	it('le doc 14 ne fige aucun tarif et rappelle la frontière', () => {
		const doc = read('docs/codebase/14-pricing-catalog-admin.md');
		assert.match(doc, /aucun tarif/i);
		assert.match(doc, /00-licence-et-gouvernance\.md/);
		assert.match(doc, /13-openrouter-ai-gateway\.md/);
		assert.match(doc, /\/v1\/pricing\/catalog/);
		assert.doesNotMatch(doc, /\$\d/);
	});

	it('le doc 13 ne laisse aucune clé dans l’IDE', () => {
		const doc = read('docs/codebase/13-openrouter-ai-gateway.md');
		assert.match(doc, /\/v1\/ai\/chat\/completions/);
		assert.match(doc, /data_collection/);
		assert.match(doc, /Idempotency-Key/);
		assert.match(doc, /12-org-integration\.md/);
		assert.doesNotMatch(doc, /sk-or-v1-[A-Za-z0-9]/);
	});

	it('chaque doc du guide est listé dans la carte du README', () => {
		const readme = read('docs/codebase/README.md');
		const docs = readdirSync(join(root, 'docs/codebase')).filter((file) => file.endsWith('.md') && file !== 'README.md');
		assert.ok(docs.length >= 19, `seulement ${docs.length} docs dans le guide`);
		for (const file of docs) {
			assert.ok(readme.includes(`(${file})`), `${file} absent de la carte du README`);
		}
	});
});
