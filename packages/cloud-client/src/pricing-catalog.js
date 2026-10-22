/**
 * Pricing catalog contracts (USD) for Kuunda Vibe <-> kuunda-vibe-cloud.
 *
 * The admin dashboard is the single source of truth for plan prices, included
 * credits and the value of one credit. The IDE never freezes a tariff: it
 * renders the published catalog and quotes credits before a run. Consumption
 * stays authoritative server-side — a quote is UX, never a charge.
 *
 * No tariff value is compiled into this module: every price comes in as an
 * argument so the public repository stays free of commercial figures.
 *
 * @typedef {'USD'} PricingCurrency
 *
 * @typedef {object} PricingTierUsd
 * @property {number} inputPerMillionUsd
 * @property {number} outputPerMillionUsd
 * @property {number} [cachedInputPerMillionUsd]
 * @property {number} [minPromptTokens] Applies only when prompt tokens are strictly greater.
 *
 * @typedef {object} ModelPricingUsd
 * @property {number} inputPerMillionUsd
 * @property {number} outputPerMillionUsd
 * @property {number} [cachedInputPerMillionUsd]
 * @property {PricingTierUsd[]} [overrides] Conditional tiers, ascending by minPromptTokens.
 *
 * @typedef {object} CatalogModel
 * @property {string} id OpenRouter slug, e.g. 'deepseek/deepseek-v4.1-flash'.
 * @property {string} label
 * @property {'free' | 'eco' | 'standard' | 'premium' | 'expert'} tier
 * @property {number} creditsPerMillion
 * @property {string} [expirationDate] ISO date reported by OpenRouter.
 * @property {boolean} [enabled]
 * @property {string[]} [providerAllowlist] Provider slugs allowed for this model.
 *
 * @typedef {object} CatalogPlan
 * @property {string} id
 * @property {string} name
 * @property {'subscription' | 'topup'} kind
 * @property {number} priceUsd 0 for the free plan.
 * @property {number} includedCredits
 * @property {number} [bonusPercent]
 * @property {number} [minSeats]
 * @property {number} [sandboxHoursIncluded] Quota only, never billed hourly.
 * @property {boolean} [visible]
 *
 * @typedef {object} PricingCatalog
 * @property {number} version
 * @property {PricingCurrency} currency
 * @property {number} creditUnitUsd Value in USD of one credit at catalog price.
 * @property {number} targetCostRatio Real provider cost divided by the credits charged.
 * @property {string} [publishedAt]
 * @property {CatalogPlan[]} plans
 * @property {CatalogModel[]} models
 *
 * @typedef {object} UsageTokens
 * @property {number} inputTokens
 * @property {number} outputTokens
 * @property {number} [cachedInputTokens] Included in inputTokens when present.
 */

export const PRICING_CATALOG_CURRENCY = 'USD';
export const PRICING_CATALOG_PATH = '/v1/pricing/catalog';

/**
 * Every code `validatePricingCatalog` can emit, errors and warnings alike.
 * Documented in docs/codebase/14-pricing-catalog-admin.md; a test keeps the two
 * in sync, so a new guardrail can never ship undocumented.
 */
export const PRICING_VALIDATION_CODES = Object.freeze([
	'catalog_missing',
	'currency_not_usd',
	'credit_unit_invalid',
	'target_cost_ratio_invalid',
	'version_invalid',
	'plan_id_invalid',
	'plan_kind_invalid',
	'plan_price_invalid',
	'plan_credits_invalid',
	'plan_seats_invalid',
	'plan_sandbox_invalid',
	'plan_margin_below_target',
	'plan_subsidised',
	'model_id_invalid',
	'model_tier_invalid',
	'model_rate_invalid',
	'model_free_but_paid',
	'model_margin_below_target',
	'model_cost_unverified',
	'model_expiring_soon',
	'no_plans',
	'no_models',
]);
export const DEFAULT_INPUT_SHARE = 0.85;
export const MODEL_TIERS = Object.freeze(['free', 'eco', 'standard', 'premium', 'expert']);
export const PLAN_KINDS = Object.freeze(['subscription', 'topup']);

/** A model about to lose its endpoint within this many days is flagged. */
const EXPIRY_WARNING_DAYS = 90;

const EPSILON = 1e-9;

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isPositiveNumber(value) {
	return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isNonNegativeNumber(value) {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/**
 * @param {number} value
 * @returns {number}
 */
function clamp01(value) {
	if (!Number.isFinite(value)) {
		return DEFAULT_INPUT_SHARE;
	}
	return Math.min(1, Math.max(0, value));
}

/**
 * OpenRouter quotes per token as decimal strings; the catalog works per million.
 * The scale change is snapped to 9 decimals so a quoted rate survives the round
 * trip without turning into 0.19999999999999998.
 *
 * @param {unknown} perToken
 * @returns {number}
 */
export function perTokenToPerMillion(perToken) {
	const value = Number(perToken);
	if (!Number.isFinite(value) || value < 0) {
		return 0;
	}
	return Math.round(value * 1_000_000 * 1e9) / 1e9;
}

/**
 * Normalise a `GET /api/v1/model/{author}/{slug}` payload into catalog pricing.
 * Conditional overrides (long context, off-peak windows) become tiers so a
 * credit table can never be built on the cheapest tier alone.
 *
 * @param {{ pricing?: Record<string, any> }} raw
 * @returns {ModelPricingUsd}
 */
export function fromOpenRouterPricing(raw) {
	const pricing = raw?.pricing ?? {};
	/** @type {ModelPricingUsd} */
	const normalised = {
		inputPerMillionUsd: perTokenToPerMillion(pricing.prompt),
		outputPerMillionUsd: perTokenToPerMillion(pricing.completion),
	};
	const cachedInput = perTokenToPerMillion(pricing.input_cache_read);
	if (cachedInput > 0) {
		normalised.cachedInputPerMillionUsd = cachedInput;
	}
	const overrides = Array.isArray(pricing.overrides) ? pricing.overrides : [];
	const tiers = overrides
		.filter((entry) => Number.isFinite(Number(entry?.min_prompt_tokens)))
		.map((entry) => {
			/** @type {PricingTierUsd} */
			const tier = {
				minPromptTokens: Number(entry.min_prompt_tokens),
				inputPerMillionUsd: perTokenToPerMillion(entry.prompt ?? pricing.prompt),
				outputPerMillionUsd: perTokenToPerMillion(entry.completion ?? pricing.completion),
			};
			const tierCached = perTokenToPerMillion(entry.input_cache_read);
			if (tierCached > 0) {
				tier.cachedInputPerMillionUsd = tierCached;
			}
			return tier;
		})
		.sort((a, b) => a.minPromptTokens - b.minPromptTokens);
	if (tiers.length > 0) {
		normalised.overrides = tiers;
	}
	return normalised;
}

/**
 * Pricing that applies to a request of this size: the last tier whose
 * threshold is strictly below the prompt is the one billed.
 *
 * @param {ModelPricingUsd} pricing
 * @param {number} promptTokens
 * @returns {ModelPricingUsd}
 */
export function resolveModelPricing(pricing, promptTokens = 0) {
	/** @type {ModelPricingUsd} */
	const current = {
		inputPerMillionUsd: pricing?.inputPerMillionUsd ?? 0,
		outputPerMillionUsd: pricing?.outputPerMillionUsd ?? 0,
	};
	if (isPositiveNumber(pricing?.cachedInputPerMillionUsd)) {
		current.cachedInputPerMillionUsd = pricing.cachedInputPerMillionUsd;
	}
	const tiers = Array.isArray(pricing?.overrides) ? pricing.overrides : [];
	for (const tier of tiers) {
		if (typeof tier?.minPromptTokens === 'number' && promptTokens > tier.minPromptTokens) {
			current.inputPerMillionUsd = tier.inputPerMillionUsd;
			current.outputPerMillionUsd = tier.outputPerMillionUsd;
			if (isPositiveNumber(tier.cachedInputPerMillionUsd)) {
				current.cachedInputPerMillionUsd = tier.cachedInputPerMillionUsd;
			}
		}
	}
	return current;
}

/**
 * Reference cost of one million tokens for an agent workload.
 *
 * @param {ModelPricingUsd} pricing Already resolved for the request size.
 * @param {number} [inputShare]
 * @returns {number}
 */
export function blendedCostUsdPerMillion(pricing, inputShare = DEFAULT_INPUT_SHARE) {
	const share = clamp01(inputShare);
	return share * (pricing?.inputPerMillionUsd ?? 0) + (1 - share) * (pricing?.outputPerMillionUsd ?? 0);
}

/**
 * The credit rate an admin must publish so this model still hits the margin
 * target. Always rounded up: a fraction of a credit is never given away.
 *
 * @param {{ costPerMillionUsd: number, creditUnitUsd: number, targetCostRatio: number }} input
 * @returns {number}
 */
export function creditsPerMillionFromCost({ costPerMillionUsd, creditUnitUsd, targetCostRatio }) {
	if (!isPositiveNumber(creditUnitUsd)) {
		throw new Error('creditUnitUsd must be > 0');
	}
	if (!isPositiveNumber(targetCostRatio) || targetCostRatio > 1) {
		throw new Error('targetCostRatio must be in (0, 1]');
	}
	if (!isNonNegativeNumber(costPerMillionUsd)) {
		throw new Error('costPerMillionUsd must be >= 0');
	}
	return Math.ceil(costPerMillionUsd / (targetCostRatio * creditUnitUsd));
}

/**
 * What the provider really charged for one run, cache hits included.
 *
 * @param {UsageTokens} usage
 * @param {ModelPricingUsd} pricing
 * @returns {number}
 */
export function realCostUsd(usage, pricing) {
	const inputTokens = isNonNegativeNumber(usage?.inputTokens) ? usage.inputTokens : 0;
	const outputTokens = isNonNegativeNumber(usage?.outputTokens) ? usage.outputTokens : 0;
	const cachedTokens = Math.min(isNonNegativeNumber(usage?.cachedInputTokens) ? usage.cachedInputTokens : 0, inputTokens);
	const uncachedTokens = inputTokens - cachedTokens;
	const resolved = resolveModelPricing(pricing, inputTokens);
	const cachedRate = isPositiveNumber(resolved.cachedInputPerMillionUsd)
		? resolved.cachedInputPerMillionUsd
		: resolved.inputPerMillionUsd;
	return (uncachedTokens * resolved.inputPerMillionUsd + cachedTokens * cachedRate + outputTokens * resolved.outputPerMillionUsd) / 1_000_000;
}

/**
 * Credits to show for a finished or planned run. One published rate per model:
 * cache hits lower the real cost without lowering the quote, so a cheaper
 * cache is extra margin rather than a price the customer can lose.
 *
 * @param {UsageTokens} usage
 * @param {number} creditsPerMillion
 * @returns {number}
 */
export function creditsForUsage(usage, creditsPerMillion) {
	if (!isNonNegativeNumber(creditsPerMillion)) {
		return 0;
	}
	const inputTokens = isNonNegativeNumber(usage?.inputTokens) ? usage.inputTokens : 0;
	const outputTokens = isNonNegativeNumber(usage?.outputTokens) ? usage.outputTokens : 0;
	return Math.ceil(((inputTokens + outputTokens) / 1_000_000) * creditsPerMillion);
}

/**
 * Included credits for a price, using the "credits = price in dollars x rate"
 * rule the dashboard exposes.
 *
 * @param {number} priceUsd
 * @param {{ creditsPerUsd: number, bonusPercent?: number }} input
 * @returns {number}
 */
export function planCreditsFromPrice(priceUsd, { creditsPerUsd, bonusPercent = 0 }) {
	if (!isNonNegativeNumber(priceUsd) || !isNonNegativeNumber(creditsPerUsd)) {
		return 0;
	}
	const bonus = isNonNegativeNumber(bonusPercent) ? bonusPercent : 0;
	return Math.floor(priceUsd * creditsPerUsd * (1 + bonus / 100));
}

/**
 * @param {PricingCatalog} catalog
 * @param {string} modelId
 * @returns {CatalogModel | undefined}
 */
export function resolveCatalogModel(catalog, modelId) {
	return catalog?.models?.find((model) => model.id === modelId);
}

/**
 * Pre-run estimate. Returns undefined when the catalog cannot answer, so the
 * caller can defer to the server instead of inventing a price.
 *
 * @param {PricingCatalog} catalog
 * @param {string} modelId
 * @param {UsageTokens} usage
 * @returns {{ modelId: string, credits: number } | undefined}
 */
export function estimateCredits(catalog, modelId, usage) {
	const model = resolveCatalogModel(catalog, modelId);
	if (!model) {
		return undefined;
	}
	return { modelId, credits: creditsForUsage(usage, model.creditsPerMillion) };
}

/**
 * Guardrails the admin dashboard runs before publishing.
 *
 * Errors block a publish. Warnings need a human decision. The rule that makes
 * this worth having: a rate below the margin floor, or a paid model marked
 * free, can never reach production silently.
 *
 * @param {PricingCatalog} catalog
 * @param {Record<string, ModelPricingUsd>} [modelPricingById]
 * @param {{ now?: Date }} [options]
 * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
 */
export function validatePricingCatalog(catalog, modelPricingById = {}, options = {}) {
	/** @type {string[]} */
	const errors = [];
	/** @type {string[]} */
	const warnings = [];
	if (!catalog || typeof catalog !== 'object') {
		return { ok: false, errors: ['catalog_missing'], warnings };
	}
	if (catalog.currency !== PRICING_CATALOG_CURRENCY) {
		errors.push('currency_not_usd');
	}
	if (!isPositiveNumber(catalog.creditUnitUsd)) {
		errors.push('credit_unit_invalid');
	}
	if (!isPositiveNumber(catalog.targetCostRatio) || catalog.targetCostRatio > 1) {
		errors.push('target_cost_ratio_invalid');
	}
	if (!Number.isInteger(catalog.version) || catalog.version < 1) {
		errors.push('version_invalid');
	}

	const creditUnit = catalog.creditUnitUsd;
	const ratio = catalog.targetCostRatio;
	const marginUsable = isPositiveNumber(creditUnit) && isPositiveNumber(ratio) && ratio <= 1;
	const floorCreditsPerMillion = (costPerMillionUsd) =>
		marginUsable ? creditsPerMillionFromCost({ costPerMillionUsd, creditUnitUsd: creditUnit, targetCostRatio: ratio }) : 0;

	const plans = Array.isArray(catalog.plans) ? catalog.plans : [];
	if (plans.length === 0) {
		warnings.push('no_plans');
	}
	/** @type {Set<string>} */
	const planIds = new Set();
	for (const plan of plans) {
		if (!plan?.id || planIds.has(plan.id)) {
			errors.push(`plan_id_invalid:${plan?.id ?? 'missing'}`);
			continue;
		}
		planIds.add(plan.id);
		if (!PLAN_KINDS.includes(plan.kind)) {
			errors.push(`plan_kind_invalid:${plan.id}`);
		}
		if (!isNonNegativeNumber(plan.priceUsd)) {
			errors.push(`plan_price_invalid:${plan.id}`);
			continue;
		}
		if (!Number.isInteger(plan.includedCredits) || plan.includedCredits < 0) {
			errors.push(`plan_credits_invalid:${plan.id}`);
			continue;
		}
		if (plan.minSeats !== undefined && (!Number.isInteger(plan.minSeats) || plan.minSeats < 1)) {
			errors.push(`plan_seats_invalid:${plan.id}`);
		}
		if (plan.sandboxHoursIncluded !== undefined && !isNonNegativeNumber(plan.sandboxHoursIncluded)) {
			errors.push(`plan_sandbox_invalid:${plan.id}`);
		}
		if (marginUsable && plan.priceUsd === 0 && plan.includedCredits > 0) {
			warnings.push(`plan_subsidised:${plan.id}`);
		}
		if (marginUsable && plan.priceUsd > 0) {
			const cost = plan.includedCredits * creditUnit;
			if (cost * ratio > plan.priceUsd + EPSILON) {
				errors.push(`plan_margin_below_target:${plan.id}`);
			}
		}
	}

	const models = Array.isArray(catalog.models) ? catalog.models : [];
	if (models.length === 0) {
		warnings.push('no_models');
	}
	/** @type {Set<string>} */
	const modelIds = new Set();
	const now = options.now instanceof Date ? options.now : new Date();
	for (const model of models) {
		if (!model?.id || modelIds.has(model.id)) {
			errors.push(`model_id_invalid:${model?.id ?? 'missing'}`);
			continue;
		}
		modelIds.add(model.id);
		if (!MODEL_TIERS.includes(model.tier)) {
			errors.push(`model_tier_invalid:${model.id}`);
		}
		if (!Number.isInteger(model.creditsPerMillion) || model.creditsPerMillion < 0) {
			errors.push(`model_rate_invalid:${model.id}`);
			continue;
		}
		const pricing = modelPricingById?.[model.id];
		if (pricing) {
			const resolved = resolveModelPricing(pricing, Number.MAX_SAFE_INTEGER);
			const cost = blendedCostUsdPerMillion(resolved);
			if (model.creditsPerMillion === 0 && cost > 0) {
				errors.push(`model_free_but_paid:${model.id}`);
			} else if (marginUsable && model.creditsPerMillion > 0) {
				const floor = floorCreditsPerMillion(cost);
				if (model.creditsPerMillion < floor) {
					errors.push(`model_margin_below_target:${model.id}`);
				}
			}
		} else if (model.creditsPerMillion > 0) {
			warnings.push(`model_cost_unverified:${model.id}`);
		}
		if (typeof model.expirationDate === 'string' && model.expirationDate.length > 0) {
			const expiry = new Date(model.expirationDate);
			if (!Number.isNaN(expiry.getTime())) {
				const days = (expiry.getTime() - now.getTime()) / 86_400_000;
				if (days <= EXPIRY_WARNING_DAYS) {
					warnings.push(`model_expiring_soon:${model.id}`);
				}
			}
		}
	}

	return { ok: errors.length === 0, errors, warnings };
}
