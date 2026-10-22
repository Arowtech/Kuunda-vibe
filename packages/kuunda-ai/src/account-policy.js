/**
 * Phase 11 — Kuunda Studio account (email + OAuth + device pairing).
 * No passwords, tokens, or provider secrets are persisted by these helpers.
 */

export const AUTH_PROVIDERS = Object.freeze(['email', 'google', 'github', 'apple']);
export const OAUTH_PROVIDERS = Object.freeze(['google', 'github', 'apple']);
export const AUTH_ERROR_CODES = Object.freeze([
	'invalid_credentials',
	'invalid_email',
	'weak_password',
	'offline',
	'timeout',
	'unavailable',
	'strict_offline',
	'oauth_denied',
	'expired',
]);
export const USAGE_FEATURES = Object.freeze(['agent', 'tab', 'publish', 'other']);
export const MIN_PASSWORD_LENGTH = 10;
export const AUTH_CALLBACK_AUTHORITY = 'auth';

/**
 * @param {unknown} email
 */
export function isValidEmail(email) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

/**
 * @param {unknown} password
 */
export function isStrongPassword(password) {
	return String(password || '').length >= MIN_PASSWORD_LENGTH;
}

/**
 * @param {unknown} provider
 */
export function normalizeAuthProvider(provider) {
	const key = String(provider || '').trim().toLowerCase();
	if (AUTH_PROVIDERS.includes(key)) {
		return key;
	}
	return undefined;
}

/**
 * @param {unknown} error
 */
export function classifyAuthError(error) {
	const msg = String(error?.message || error || '').toLowerCase();
	if (msg.includes('strict_offline') || msg.includes('strict offline')) {
		return 'strict_offline';
	}
	if (msg.includes('platform_timeout') || msg.includes('timeout')) {
		return 'timeout';
	}
	if (msg.includes('offline') || msg.includes('enotfound') || msg.includes('failed to fetch')) {
		return 'offline';
	}
	if (msg.includes('access_denied') || msg.includes('oauth_denied')) {
		return 'oauth_denied';
	}
	if (msg.includes('platform_http_401') || msg.includes('invalid_credentials') || msg.includes('unauthorized')) {
		return 'invalid_credentials';
	}
	if (msg.includes('invalid_email') || msg.includes('platform_http_400')) {
		return 'invalid_email';
	}
	if (msg.includes('weak_password') || msg.includes('platform_http_422')) {
		return 'weak_password';
	}
	if (msg.includes('expired') || msg.includes('platform_http_410')) {
		return 'expired';
	}
	if (msg.includes('platform_http_501') || msg.includes('platform_http_503') || msg.includes('unavailable')) {
		return 'unavailable';
	}
	return 'unavailable';
}

/**
 * @param {unknown} raw
 */
export function parseAccountProfile(raw) {
	const data = raw && typeof raw === 'object' ? raw : {};
	const providers = Array.isArray(data.providers)
		? data.providers.map(normalizeAuthProvider).filter(Boolean)
		: [];
	const org = data.org && typeof data.org === 'object' ? data.org : {};
	const cloud = data.cloud && typeof data.cloud === 'object' ? data.cloud : {};
	return {
		userId: String(data.userId || data.id || '').trim(),
		email: String(data.email || '').trim(),
		displayName: String(data.displayName || data.fullName || data.name || '').trim(),
		emailVerified: data.emailVerified === true,
		planId: String(data.planId || org.plan || 'free').trim() || 'free',
		orgId: String(org.id || '').trim() || undefined,
		orgName: String(org.name || cloud.orgName || '').trim() || undefined,
		orgPlan: String(org.plan || cloud.plan || '').trim() || undefined,
		projectCount: Number.isFinite(Number(cloud.projectCount)) ? Number(cloud.projectCount) : undefined,
		providers,
	};
}

/**
 * @param {unknown} raw
 */
export function parseAuthTokens(raw) {
	const data = raw && typeof raw === 'object' ? raw : {};
	const accessToken = String(data.accessToken || data.access_token || '').trim();
	const refreshToken = String(data.refreshToken || data.refresh_token || '').trim();
	const profile = parseAccountProfile(data.profile || data.user || data);
	if (!accessToken || !profile.userId) {
		return undefined;
	}
	return {
		accessToken,
		refreshToken: refreshToken || undefined,
		expiresAt: Number.isFinite(Number(data.expiresAt || data.expires_at)) ? Number(data.expiresAt || data.expires_at) : undefined,
		profile,
	};
}

/**
 * @param {unknown} raw
 */
export function parseDeviceStart(raw) {
	const data = raw && typeof raw === 'object' ? raw : {};
	const deviceCode = String(data.deviceCode || data.device_code || '').trim();
	const userCode = String(data.userCode || data.user_code || '').trim();
	const verificationUrl = String(data.verificationUrl || data.verification_uri || '').trim();
	if (!deviceCode || !userCode || !verificationUrl) {
		return undefined;
	}
	return {
		deviceCode,
		userCode,
		verificationUrl,
		expiresIn: Number(data.expiresIn || data.expires_in) || 900,
		interval: Math.max(3, Number(data.interval) || 5),
	};
}

/**
 * @param {unknown} raw
 */
export function parseUsageSnapshot(raw) {
	const data = raw && typeof raw === 'object' ? raw : {};
	const credits = data.credits && typeof data.credits === 'object' ? data.credits : {};
	const breakdown = Array.isArray(data.breakdown) ? data.breakdown : [];
	const days = Array.isArray(data.days) ? data.days : [];
	return {
		period: String(data.period || '30d'),
		credits: {
			remaining: Number(credits.remaining) || 0,
			includedQuota: Number(credits.includedQuota) || 0,
			used: Number(credits.used) || 0,
		},
		breakdown: breakdown.map((row) => ({
			feature: USAGE_FEATURES.includes(String(row?.feature)) ? String(row.feature) : 'other',
			amount: Number(row?.amount) || 0,
		})),
		days: days.map((row) => ({
			date: String(row?.date || ''),
			amount: Number(row?.amount) || 0,
		})),
	};
}

/**
 * @param {unknown} raw
 */
export function parseAccountSessions(raw) {
	const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.sessions) ? raw.sessions : [];
	return rows.map((row) => ({
		id: String(row?.id || '').trim(),
		label: String(row?.label || row?.device || 'IDE').trim() || 'IDE',
		current: row?.current === true,
		createdAt: String(row?.createdAt || row?.created_at || ''),
		lastSeenAt: String(row?.lastSeenAt || row?.last_seen_at || ''),
	})).filter((row) => row.id);
}

/**
 * @param {string} protocol
 */
export function redirectUriForProtocol(protocol) {
	const scheme = String(protocol || 'kuunda-vibe').replace(/:$/, '');
	return `${scheme}://${AUTH_CALLBACK_AUTHORITY}/callback`;
}

/**
 * @param {{ scheme?: string, authority?: string, path?: string, query?: string }} uri
 * @param {string} [protocol]
 */
export function isAuthCallbackUri(uri, protocol = 'kuunda-vibe') {
	if (!uri) {
		return false;
	}
	const scheme = String(uri.scheme || '').replace(/:$/, '');
	if (scheme !== String(protocol).replace(/:$/, '')) {
		return false;
	}
	return String(uri.authority || '') === AUTH_CALLBACK_AUTHORITY;
}

/**
 * @param {string} [query]
 */
export function parseAuthCallbackQuery(query) {
	const params = new URLSearchParams(String(query || '').replace(/^\?/, ''));
	return {
		code: params.get('code') || undefined,
		state: params.get('state') || undefined,
		error: params.get('error') || undefined,
	};
}

/**
 * Agent / Tab stay usable without an account (BYOK / Ollama). Cloud credits need a session.
 * @param {{ hasSession?: boolean, feature?: string }} input
 */
export function decideAccountGate(input = {}) {
	const feature = String(input.feature || '');
	if (!input.hasSession && (feature === 'credits' || feature === 'billing' || feature === 'kuunda_cloud' || feature === 'publish' || feature === 'account')) {
		return { ok: false, error: 'need_session', feature };
	}
	return { ok: true, feature };
}

/**
 * Cloud database linking opens Studio on the create-account form so the same
 * identity is bound to this IDE. Credits can stay on sign-in.
 * @param {unknown} raw
 */
export function parseStudioOpenIntent(raw = {}) {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
		return { intent: 'signIn', reason: 'account' };
	}
	const data = raw;
	const reason = data.reason === 'cloud' || data.reason === 'credits' ? data.reason : 'account';
	const intent = reason === 'cloud' || data.intent === 'signUp' ? 'signUp' : 'signIn';
	return { intent, reason };
}
