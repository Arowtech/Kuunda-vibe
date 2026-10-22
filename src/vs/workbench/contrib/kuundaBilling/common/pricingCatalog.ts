/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

/**
 * Pricing catalog contracts (USD), consumed from the admin dashboard.
 *
 * The dashboard owns plans, included credits and the value of one credit. The
 * IDE never freezes a tariff: it renders the published catalog and quotes
 * credits before a run. Consumption stays authoritative server-side.
 *
 * Mirrors packages/cloud-client/src/pricing-catalog.js — keep both in sync.
 */

export const PRICING_CATALOG_CURRENCY = 'USD';
export const PRICING_CATALOG_PATH = '/v1/pricing/catalog';
export const DEFAULT_INPUT_SHARE = 0.85;

/**
 * Every code `validatePricingCatalog` can emit, errors and warnings alike.
 * Documented in docs/codebase/14-pricing-catalog-admin.md.
 */
export const PRICING_VALIDATION_CODES: readonly string[] = [
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
];

export type PricingCurrency = 'USD';
export type ModelTier = 'free' | 'eco' | 'standard' | 'premium' | 'expert';
export type PlanKind = 'subscription' | 'topup';

export const MODEL_TIERS: readonly ModelTier[] = ['free', 'eco', 'standard', 'premium', 'expert'];
export const PLAN_KINDS: readonly PlanKind[] = ['subscription', 'topup'];

export type PricingTierUsd = {
	inputPerMillionUsd: number;
	outputPerMillionUsd: number;
	cachedInputPerMillionUsd?: number;
	/** Applies only when prompt tokens are strictly greater. */
	minPromptTokens?: number;
};

export type ModelPricingUsd = {
	inputPerMillionUsd: number;
	outputPerMillionUsd: number;
	cachedInputPerMillionUsd?: number;
	/** Conditional tiers, ascending by minPromptTokens. */
	overrides?: PricingTierUsd[];
};

export type CatalogModel = {
	/** OpenRouter slug, e.g. 'deepseek/deepseek-v4.1-flash'. */
	id: string;
	label: string;
	tier: ModelTier;
	creditsPerMillion: number;
	/** ISO date reported by OpenRouter. */
	expirationDate?: string;
	enabled?: boolean;
	/** Provider slugs allowed for this model. */
	providerAllowlist?: string[];
};

export type CatalogPlan = {
	id: string;
	name: string;
	kind: PlanKind;
	/** 0 for the free plan. */
	priceUsd: number;
	includedCredits: number;
	bonusPercent?: number;
	minSeats?: number;
	/** Quota only, never billed hourly. */
	sandboxHoursIncluded?: number;
	visible?: boolean;
};

export type PricingCatalog = {
	version: number;
	currency: PricingCurrency;
	/** Value in USD of one credit at catalog price. */
	creditUnitUsd: number;
	/** Real provider cost divided by the credits charged. */
	targetCostRatio: number;
	publishedAt?: string;
	plans: CatalogPlan[];
	models: CatalogModel[];
};

export type UsageTokens = {
	inputTokens: number;
	outputTokens: number;
	/** Included in inputTokens when present. */
	cachedInputTokens?: number;
};

export type PricingCatalogValidation = {
	ok: boolean;
	errors: string[];
	warnings: string[];
};

/** A model about to lose its endpoint within this many days is flagged. */
const EXPIRY_WARNING_DAYS = 90;
const EPSILON = 1e-9;

function isPositiveNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isNonNegativeNumber(value: unknown): value is number {
	return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function clamp01(value: number | undefined): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) {
		return DEFAULT_INPUT_SHARE;
	}
	return Math.min(1, Math.max(0, value));
}

/**
 * OpenRouter quotes per token as decimal strings; the catalog works per million.
 * The scale change is snapped to 9 decimals so a quoted rate survives the round
 * trip without turning into 0.19999999999999998.
 */
export function perTokenToPerMillion(perToken: unknown): number {
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
 */
export function fromOpenRouterPricing(raw: { pricing?: Record<string, unknown> } | undefined): ModelPricingUsd {
	const pricing = raw?.pricing ?? {};
	const normalised: ModelPricingUsd = {
		inputPerMillionUsd: perTokenToPerMillion(pricing['prompt']),
		outputPerMillionUsd: perTokenToPerMillion(pricing['completion']),
	};
	const cachedInput = perTokenToPerMillion(pricing['input_cache_read']);
	if (cachedInput > 0) {
		normalised.cachedInputPerMillionUsd = cachedInput;
	}
	const rawOverrides = Array.isArray(pricing['overrides']) ? pricing['overrides'] as Array<Record<string, unknown>> : [];
	const tiers: PricingTierUsd[] = [];
	for (const entry of rawOverrides) {
		const minPromptTokens = Number(entry?.['min_prompt_tokens']);
		if (!Number.isFinite(minPromptTokens)) {
			continue;
		}
		const tier: PricingTierUsd = {
			minPromptTokens,
			inputPerMillionUsd: perTokenToPerMillion(entry['prompt'] ?? pricing['prompt']),
			outputPerMillionUsd: perTokenToPerMillion(entry['completion'] ?? pricing['completion']),
		};
		const tierCached = perTokenToPerMillion(entry['input_cache_read']);
		if (tierCached > 0) {
			tier.cachedInputPerMillionUsd = tierCached;
		}
		tiers.push(tier);
	}
	tiers.sort((a, b) => (a.minPromptTokens ?? 0) - (b.minPromptTokens ?? 0));
	if (tiers.length > 0) {
		normalised.overrides = tiers;
	}
	return normalised;
}

/**
 * Pricing that applies to a request of this size: the last tier whose threshold
 * is strictly below the prompt is the one billed.
 */
export function resolveModelPricing(pricing: ModelPricingUsd | undefined, promptTokens = 0): ModelPricingUsd {
	const current: ModelPricingUsd = {
		inputPerMillionUsd: pricing?.inputPerMillionUsd ?? 0,
		outputPerMillionUsd: pricing?.outputPerMillionUsd ?? 0,
	};
	if (isPositiveNumber(pricing?.cachedInputPerMillionUsd)) {
		current.cachedInputPerMillionUsd = pricing.cachedInputPerMillionUsd;
	}
	for (const tier of pricing?.overrides ?? []) {
		if (typeof tier.minPromptTokens === 'number' && promptTokens > tier.minPromptTokens) {
			current.inputPerMillionUsd = tier.inputPerMillionUsd;
			current.outputPerMillionUsd = tier.outputPerMillionUsd;
			if (isPositiveNumber(tier.cachedInputPerMillionUsd)) {
				current.cachedInputPerMillionUsd = tier.cachedInputPerMillionUsd;
			}
		}
	}
	return current;
}

/** Reference cost of one million tokens for an agent workload. */
export function blendedCostUsdPerMillion(pricing: ModelPricingUsd | undefined, inputShare?: number): number {
	const share = clamp01(inputShare);
	return share * (pricing?.inputPerMillionUsd ?? 0) + (1 - share) * (pricing?.outputPerMillionUsd ?? 0);
}

/**
 * The credit rate an admin must publish so this model still hits the margin
 * target. Always rounded up: a fraction of a credit is never given away.
 */
export function creditsPerMillionFromCost(costPerMillionUsd: number, creditUnitUsd: number, targetCostRatio: number): number {
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

/** What the provider really charged for one run, cache hits included. */
export function realCostUsd(usage: UsageTokens | undefined, pricing: ModelPricingUsd | undefined): number {
	const inputTokens = isNonNegativeNumber(usage?.inputTokens) ? usage.inputTokens : 0;
	const outputTokens = isNonNegativeNumber(usage?.outputTokens) ? usage.outputTokens : 0;
	const cachedTokens = Math.min(isNonNegativeNumber(usage?.cachedInputTokens) ? usage.cachedInputTokens : 0, inputTokens);
	const uncachedTokens = inputTokens - cachedTokens;
	const resolved = resolveModelPricing(pricing, inputTokens);
	const cachedRate = isPositiveNumber(resolved.cachedInputPerMillionUsd) ? resolved.cachedInputPerMillionUsd : resolved.inputPerMillionUsd;
	return (uncachedTokens * resolved.inputPerMillionUsd + cachedTokens * cachedRate + outputTokens * resolved.outputPerMillionUsd) / 1_000_000;
}

/**
 * Credits to show for a finished or planned run. One published rate per model:
 * cache hits lower the real cost without lowering the quote, so a cheaper cache
 * is extra margin rather than a price the customer can lose.
 */
export function creditsForUsage(usage: UsageTokens | undefined, creditsPerMillion: number): number {
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
 */
export function planCreditsFromPrice(priceUsd: number, creditsPerUsd: number, bonusPercent = 0): number {
	if (!isNonNegativeNumber(priceUsd) || !isNonNegativeNumber(creditsPerUsd)) {
		return 0;
	}
	const bonus = isNonNegativeNumber(bonusPercent) ? bonusPercent : 0;
	return Math.floor(priceUsd * creditsPerUsd * (1 + bonus / 100));
}

export function resolveCatalogModel(catalog: PricingCatalog | undefined, modelId: string): CatalogModel | undefined {
	return catalog?.models?.find((model) => model.id === modelId);
}

/**
 * Pre-run estimate. Returns undefined when the catalog cannot answer, so the
 * caller can defer to the server instead of inventing a price.
 */
export function estimateCredits(catalog: PricingCatalog | undefined, modelId: string, usage: UsageTokens | undefined): number | undefined {
	const model = resolveCatalogModel(catalog, modelId);
	if (!model) {
		return undefined;
	}
	return creditsForUsage(usage, model.creditsPerMillion);
}

/**
 * Guardrails the admin dashboard runs before publishing.
 *
 * Errors block a publish. Warnings need a human decision. A rate below the
 * margin floor, or a paid model marked free, can never reach production silently.
 */
export function validatePricingCatalog(catalog: PricingCatalog | undefined, modelPricingById: Record<string, ModelPricingUsd | undefined> = {}, now: Date = new Date()): PricingCatalogValidation {
	const errors: string[] = [];
	const warnings: string[] = [];
	if (!catalog || typeof catalog !== 'object') {
		return { ok: false, errors: ['catalog_missing'], warnings };
	}
	if (String(catalog.currency) !== PRICING_CATALOG_CURRENCY) {
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
	const floorCreditsPerMillion = (costPerMillionUsd: number): number =>
		marginUsable ? creditsPerMillionFromCost(costPerMillionUsd, creditUnit, ratio) : 0;

	const plans = Array.isArray(catalog.plans) ? catalog.plans : [];
	if (plans.length === 0) {
		warnings.push('no_plans');
	}
	const planIds = new Set<string>();
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
	const modelIds = new Set<string>();
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
		const pricing = modelPricingById[model.id];
		if (pricing) {
			const cost = blendedCostUsdPerMillion(resolveModelPricing(pricing, Number.MAX_SAFE_INTEGER));
			if (model.creditsPerMillion === 0 && cost > 0) {
				errors.push(`model_free_but_paid:${model.id}`);
			} else if (marginUsable && model.creditsPerMillion > 0 && model.creditsPerMillion < floorCreditsPerMillion(cost)) {
				errors.push(`model_margin_below_target:${model.id}`);
			}
		} else if (model.creditsPerMillion > 0) {
			warnings.push(`model_cost_unverified:${model.id}`);
		}
		if (typeof model.expirationDate === 'string' && model.expirationDate.length > 0) {
			const expiry = new Date(model.expirationDate);
			if (!Number.isNaN(expiry.getTime()) && (expiry.getTime() - now.getTime()) / 86_400_000 <= EXPIRY_WARNING_DAYS) {
				warnings.push(`model_expiring_soon:${model.id}`);
			}
		}
	}

	return { ok: errors.length === 0, errors, warnings };
}
