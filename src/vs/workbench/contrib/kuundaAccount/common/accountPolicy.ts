/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

export const AUTH_PROVIDERS = ['email', 'google', 'github', 'apple'] as const;
export const OAUTH_PROVIDERS = ['google', 'github', 'apple'] as const;
export const AUTH_ERROR_CODES = ['invalid_credentials', 'invalid_email', 'weak_password', 'offline', 'timeout', 'unavailable', 'strict_offline', 'oauth_denied', 'expired'] as const;
export const USAGE_FEATURES = ['agent', 'tab', 'publish', 'other'] as const;
export const MIN_PASSWORD_LENGTH = 10;
export const AUTH_CALLBACK_AUTHORITY = 'auth';
export const DEFAULT_API_BASE_URL = 'https://api.ide.kuunda-cloud.com';
export const DEFAULT_ACCOUNT_URL = 'https://app.ide.kuunda-cloud.com/app/';
export const DEFAULT_CLOUD_APP_URL = 'https://app.kuunda.cloud';

export type AuthProvider = typeof AUTH_PROVIDERS[number];
export type OAuthProvider = typeof OAUTH_PROVIDERS[number];
export type AuthErrorCode = typeof AUTH_ERROR_CODES[number];

export type AccountProfile = {
	userId: string;
	email: string;
	displayName?: string;
	emailVerified?: boolean;
	planId?: string;
	orgId?: string;
	orgName?: string;
	orgPlan?: string;
	projectCount?: number;
	providers: AuthProvider[];
};

export type AuthSession = {
	accessToken: string;
	refreshToken?: string;
	expiresAt?: number;
	profile: AccountProfile;
};

export type DeviceAuthStart = {
	deviceCode: string;
	userCode: string;
	verificationUrl: string;
	expiresIn: number;
	interval: number;
};

export type AccountUsageSnapshot = {
	period: string;
	credits: { remaining: number; includedQuota: number; used: number };
	breakdown: Array<{ feature: string; amount: number }>;
	days: Array<{ date: string; amount: number }>;
};

export type AccountDeviceSession = {
	id: string;
	label: string;
	current?: boolean;
	createdAt?: string;
	lastSeenAt?: string;
};

export function isValidEmail(email: unknown): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

export function isStrongPassword(password: unknown): boolean {
	return String(password || '').length >= MIN_PASSWORD_LENGTH;
}

export function normalizeAuthProvider(provider: unknown): AuthProvider | undefined {
	const key = String(provider || '').trim().toLowerCase();
	return (AUTH_PROVIDERS as readonly string[]).includes(key) ? key as AuthProvider : undefined;
}

export function classifyAuthError(error: unknown): AuthErrorCode {
	const msg = String((error as { message?: unknown })?.message || error || '').toLowerCase();
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
	return 'unavailable';
}

export function parseAccountProfile(raw: unknown): AccountProfile {
	const data = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
	const org = data.org && typeof data.org === 'object' ? data.org as Record<string, unknown> : {};
	const cloud = data.cloud && typeof data.cloud === 'object' ? data.cloud as Record<string, unknown> : {};
	const providers = Array.isArray(data.providers)
		? data.providers.map(normalizeAuthProvider).filter((item): item is AuthProvider => Boolean(item))
		: [];
	return {
		userId: String(data.userId || data.id || '').trim(),
		email: String(data.email || '').trim(),
		displayName: String(data.displayName || data.fullName || data.name || '').trim() || undefined,
		emailVerified: data.emailVerified === true,
		planId: String(data.planId || org.plan || 'free').trim() || 'free',
		orgId: String(org.id || '').trim() || undefined,
		orgName: String(org.name || cloud.orgName || '').trim() || undefined,
		orgPlan: String(org.plan || cloud.plan || '').trim() || undefined,
		projectCount: Number.isFinite(Number(cloud.projectCount)) ? Number(cloud.projectCount) : undefined,
		providers,
	};
}

export function parseAuthTokens(raw: unknown): AuthSession | undefined {
	const data = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
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

export function parseDeviceStart(raw: unknown): DeviceAuthStart | undefined {
	const data = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
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

export function parseUsageSnapshot(raw: unknown): AccountUsageSnapshot {
	const data = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
	const credits = data.credits && typeof data.credits === 'object' ? data.credits as Record<string, unknown> : {};
	const breakdown = Array.isArray(data.breakdown) ? data.breakdown : [];
	const days = Array.isArray(data.days) ? data.days : [];
	return {
		period: String(data.period || '30d'),
		credits: {
			remaining: Number(credits.remaining) || 0,
			includedQuota: Number(credits.includedQuota) || 0,
			used: Number(credits.used) || 0,
		},
		breakdown: breakdown.map((row) => {
			const item = row as { feature?: unknown; amount?: unknown };
			return {
				feature: (USAGE_FEATURES as readonly string[]).includes(String(item?.feature)) ? String(item.feature) : 'other',
				amount: Number(item?.amount) || 0,
			};
		}),
		days: days.map((row) => {
			const item = row as { date?: unknown; amount?: unknown };
			return { date: String(item?.date || ''), amount: Number(item?.amount) || 0 };
		}),
	};
}

export function parseAccountSessions(raw: unknown): AccountDeviceSession[] {
	const rows = Array.isArray(raw) ? raw : Array.isArray((raw as { sessions?: unknown })?.sessions) ? (raw as { sessions: unknown[] }).sessions : [];
	return rows.map((row) => {
		const item = row as Record<string, unknown>;
		return {
			id: String(item?.id || '').trim(),
			label: String(item?.label || item?.device || 'IDE').trim() || 'IDE',
			current: item?.current === true,
			createdAt: String(item?.createdAt || item?.created_at || ''),
			lastSeenAt: String(item?.lastSeenAt || item?.last_seen_at || ''),
		};
	}).filter((row) => row.id);
}

export function redirectUriForProtocol(protocol: string): string {
	const scheme = String(protocol || 'kuunda-vibe').replace(/:$/, '');
	return `${scheme}://${AUTH_CALLBACK_AUTHORITY}/callback`;
}

export function isAuthCallbackUri(uri: { scheme?: string; authority?: string }, protocol = 'kuunda-vibe'): boolean {
	if (!uri) {
		return false;
	}
	return String(uri.scheme || '').replace(/:$/, '') === String(protocol).replace(/:$/, '')
		&& String(uri.authority || '') === AUTH_CALLBACK_AUTHORITY;
}

export function parseAuthCallbackQuery(query: string | undefined): { code?: string; state?: string; error?: string } {
	const params = new URLSearchParams(String(query || '').replace(/^\?/, ''));
	return {
		code: params.get('code') || undefined,
		state: params.get('state') || undefined,
		error: params.get('error') || undefined,
	};
}

export function decideAccountGate(input: { hasSession?: boolean; feature?: string } = {}): { ok: true; feature: string } | { ok: false; error: 'need_session'; feature: string } {
	const feature = String(input.feature || '');
	if (!input.hasSession && (feature === 'credits' || feature === 'billing' || feature === 'kuunda_cloud' || feature === 'publish' || feature === 'account')) {
		return { ok: false, error: 'need_session', feature };
	}
	return { ok: true, feature };
}

export type StudioOpenIntent = {
	intent: 'signIn' | 'signUp';
	reason: 'account' | 'credits' | 'cloud';
};

export function parseStudioOpenIntent(raw: unknown = {}): StudioOpenIntent {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
		return { intent: 'signIn', reason: 'account' };
	}
	const data = raw as Record<string, unknown>;
	const reason: StudioOpenIntent['reason'] = data.reason === 'cloud' || data.reason === 'credits' ? data.reason : 'account';
	const intent: StudioOpenIntent['intent'] = reason === 'cloud' || data.intent === 'signUp' ? 'signUp' : 'signIn';
	return { intent, reason };
}
