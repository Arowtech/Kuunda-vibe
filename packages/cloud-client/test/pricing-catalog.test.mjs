import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	PRICING_CATALOG_CURRENCY,
	PRICING_CATALOG_PATH,
	blendedCostUsdPerMillion,
	creditsForUsage,
	creditsPerMillionFromCost,
	estimateCredits,
	fromOpenRouterPricing,
	perTokenToPerMillion,
	planCreditsFromPrice,
	realCostUsd,
	resolveModelPricing,
	validatePricingCatalog,
} from '../src/pricing-catalog.js';

/** Payload shapes taken from GET /api/v1/model/{author}/{slug} (September 2026). */
const LUNA_RAW = {
	pricing: {
		prompt: '0.0000002',
		completion: '0.0000012',
		input_cache_read: '0.00000002',
		input_cache_write: '0.00000025',
		overrides: [
			{
				min_prompt_tokens: 272000,
				prompt: '0.0000004',
				completion: '0.0000018',
				input_cache_read: '0.00000004',
				input_cache_write: '0.0000005',
			},
		],
	},
};

const DEEPSEEK_RAW = {
	pricing: {
		prompt: '0.00000014',
		completion: '0.00000042',
		input_cache_read: '0.0000000042',
	},
};

function buildCatalog(overrides = {}) {
	return {
		version: 1,
		currency: PRICING_CATALOG_CURRENCY,
		creditUnitUsd: 0.01,
		targetCostRatio: 0.3,
		plans: [
			{ id: 'pro', name: 'Pro', kind: 'subscription', priceUsd: 19, includedCredits: 1900, sandboxHoursIncluded: 50 },
			{ id: 'topup', name: 'Top up', kind: 'topup', priceUsd: 10, includedCredits: 1000 },
		],
		models: [
			{ id: 'deepseek/deepseek-v4.1-flash', label: 'DeepSeek V4.1 Flash', tier: 'standard', creditsPerMillion: 61 },
		],
		...overrides,
	};
}

describe('catalogue tarifaire USD', () => {
	it('expose le chemin publié par le dashboard admin', () => {
		assert.equal(PRICING_CATALOG_PATH, '/v1/pricing/catalog');
		assert.equal(PRICING_CATALOG_CURRENCY, 'USD');
	});

	it('convertit un prix OpenRouter par token en prix par million', () => {
		assert.equal(perTokenToPerMillion('0.0000002'), 0.2);
		assert.equal(perTokenToPerMillion(undefined), 0);
	});

	it('normalise les paliers conditionnels au lieu de retenir le moins cher', () => {
		const pricing = fromOpenRouterPricing(LUNA_RAW);
		assert.equal(pricing.inputPerMillionUsd, 0.2);
		assert.equal(pricing.outputPerMillionUsd, 1.2);
		assert.equal(pricing.cachedInputPerMillionUsd, 0.02);
		assert.equal(pricing.overrides?.length, 1);
		assert.equal(pricing.overrides[0].minPromptTokens, 272000);

		const short = resolveModelPricing(pricing, 100_000);
		assert.equal(short.inputPerMillionUsd, 0.2);
		const long = resolveModelPricing(pricing, 400_000);
		assert.equal(long.inputPerMillionUsd, 0.4);
		assert.equal(long.outputPerMillionUsd, 1.8);
		assert.equal(long.cachedInputPerMillionUsd, 0.04);
	});

	it('calcule le coût de référence d’une charge agent', () => {
		const deepseek = fromOpenRouterPricing(DEEPSEEK_RAW);
		assert.equal(Number(blendedCostUsdPerMillion(deepseek).toFixed(6)), 0.182);
		assert.equal(Number(creditsPerMillionFromCost({ costPerMillionUsd: 0.182, creditUnitUsd: 0.01, targetCostRatio: 0.3 })), 61);
	});

	it('refuse un coût de crédit inexploitable', () => {
		assert.throws(() => creditsPerMillionFromCost({ costPerMillionUsd: 1, creditUnitUsd: 0, targetCostRatio: 0.3 }), /creditUnitUsd/);
		assert.throws(() => creditsPerMillionFromCost({ costPerMillionUsd: 1, creditUnitUsd: 0.01, targetCostRatio: 1.5 }), /targetCostRatio/);
		assert.throws(() => creditsPerMillionFromCost({ costPerMillionUsd: -1, creditUnitUsd: 0.01, targetCostRatio: 0.3 }), /costPerMillionUsd/);
	});

	it('compte le coût réel avec les lectures de cache', () => {
		const deepseek = fromOpenRouterPricing(DEEPSEEK_RAW);
		const usage = { inputTokens: 374_000, cachedInputTokens: 224_400, outputTokens: 66_000 };
		assert.equal(Number(realCostUsd(usage, deepseek).toFixed(6)), 0.049606);
		const noCache = realCostUsd({ ...usage, cachedInputTokens: 0 }, deepseek);
		assert.ok(noCache > realCostUsd(usage, deepseek));
	});

	it('facture un tarif unique par modèle, le cache restant en marge', () => {
		const usage = { inputTokens: 374_000, cachedInputTokens: 224_400, outputTokens: 66_000 };
		assert.equal(creditsForUsage(usage, 61), 27);
		assert.equal(creditsForUsage({ inputTokens: 0, outputTokens: 0 }, 61), 0);
	});

	it('dérive les crédits inclus d’un prix en dollars', () => {
		assert.equal(planCreditsFromPrice(19, { creditsPerUsd: 100 }), 1900);
		assert.equal(planCreditsFromPrice(19, { creditsPerUsd: 100, bonusPercent: 10 }), 2090);
		assert.equal(planCreditsFromPrice(0, { creditsPerUsd: 100 }), 0);
	});

	it('estime un devis avant exécution sans inventer de prix', () => {
		const catalog = buildCatalog();
		const usage = { inputTokens: 374_000, outputTokens: 66_000 };
		assert.deepEqual(estimateCredits(catalog, 'deepseek/deepseek-v4.1-flash', usage), { modelId: 'deepseek/deepseek-v4.1-flash', credits: 27 });
		assert.equal(estimateCredits(catalog, 'moonshotai/kimi-k3', usage), undefined);
	});
});

describe('garde-fous du dashboard admin', () => {
	it('publie un catalogue sain', () => {
		const result = validatePricingCatalog(buildCatalog(), { 'deepseek/deepseek-v4.1-flash': fromOpenRouterPricing(DEEPSEEK_RAW) });
		assert.deepEqual(result, { ok: true, errors: [], warnings: [] });
	});

	it('impose la devise dollar', () => {
		const result = validatePricingCatalog(buildCatalog({ currency: 'XOF' }));
		assert.equal(result.ok, false);
		assert.ok(result.errors.includes('currency_not_usd'));
	});

	it('refuse un plan qui vend plus de crédits qu’il ne peut payer', () => {
		const catalog = buildCatalog({
			plans: [{ id: 'pro', name: 'Pro', kind: 'subscription', priceUsd: 19, includedCredits: 15_000 }],
		});
		const result = validatePricingCatalog(catalog);
		assert.equal(result.ok, false);
		assert.ok(result.errors.includes('plan_margin_below_target:pro'));
	});

	it('refuse un tarif modèle sous le plancher de marge', () => {
		const catalog = buildCatalog({
			models: [{ id: 'deepseek/deepseek-v4.1-flash', label: 'DeepSeek V4.1 Flash', tier: 'standard', creditsPerMillion: 59 }],
		});
		const result = validatePricingCatalog(catalog, { 'deepseek/deepseek-v4.1-flash': fromOpenRouterPricing(DEEPSEEK_RAW) });
		assert.equal(result.ok, false);
		assert.ok(result.errors.includes('model_margin_below_target:deepseek/deepseek-v4.1-flash'));
	});

	it('refuse un modèle payant marqué gratuit', () => {
		const catalog = buildCatalog({
			models: [{ id: 'moonshotai/kimi-k3', label: 'Kimi K3', tier: 'premium', creditsPerMillion: 0 }],
		});
		const result = validatePricingCatalog(catalog, { 'moonshotai/kimi-k3': { inputPerMillionUsd: 3, outputPerMillionUsd: 15 } });
		assert.equal(result.ok, false);
		assert.ok(result.errors.includes('model_free_but_paid:moonshotai/kimi-k3'));
	});

	it('avertit sans bloquer quand le coût n’est pas vérifiable', () => {
		const catalog = buildCatalog({
			models: [{ id: 'x-ai/grok-9', label: 'Grok 9', tier: 'expert', creditsPerMillion: 1200 }],
		});
		const result = validatePricingCatalog(catalog);
		assert.equal(result.ok, true);
		assert.ok(result.warnings.includes('model_cost_unverified:x-ai/grok-9'));
	});

	it('avertit sur un plan gratuit subventionné et un modèle qui expire', () => {
		const catalog = buildCatalog({
			plans: [{ id: 'free', name: 'Free', kind: 'subscription', priceUsd: 0, includedCredits: 150 }],
			models: [
				{ id: 'nvidia/nemotron-3-ultra', label: 'Nemotron 3 Ultra', tier: 'free', creditsPerMillion: 0 },
				{ id: 'z-ai/glm-5.3-flash', label: 'GLM 5.3 Flash', tier: 'standard', creditsPerMillion: 68, expirationDate: '2026-10-01' },
			],
		});
		const result = validatePricingCatalog(catalog, { 'z-ai/glm-5.3-flash': { inputPerMillionUsd: 0.15, outputPerMillionUsd: 0.5 } }, new Date('2026-09-24'));
		assert.equal(result.ok, true);
		assert.ok(result.warnings.includes('plan_subsidised:free'));
		assert.ok(result.warnings.includes('model_expiring_soon:z-ai/glm-5.3-flash'));
	});

	it('rejette un catalogue absent ou d’une autre devise sans jeter', () => {
		assert.deepEqual(validatePricingCatalog(undefined), { ok: false, errors: ['catalog_missing'], warnings: [] });
		assert.equal(validatePricingCatalog(buildCatalog({ version: 0 })).ok, false);
	});
});
