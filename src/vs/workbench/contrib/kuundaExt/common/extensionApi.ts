/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

export const KUUNDA_API_VERSION = '1.0.0';
export const KUUNDA_EXTENSION_FORMAT = 'vsix';
export const OPEN_VSX_GALLERY = 'openvsx';

export const KUUNDA_API_PERMISSIONS = ['agent', 'credits', 'kuundaCloud', 'kuundaPublish'] as const;
export type KuundaApiPermission = typeof KUUNDA_API_PERMISSIONS[number];

export const KUUNDA_API_METHODS = {
	'api.version': { permission: null },
	'agent.capabilities': { permission: 'agent' },
	'agent.getPolicy': { permission: 'agent' },
	'credits.balance': { permission: 'credits' },
	'cloud.status': { permission: 'kuundaCloud' },
	'publish.status': { permission: 'kuundaPublish' },
} as const;

export type KuundaApiMethod = keyof typeof KUUNDA_API_METHODS;
export type MarketplaceSource = 'openvsx' | 'sideload' | 'kuunda_marketplace' | 'builtin';
export type ReviewStatus = 'openvsx' | 'sideload' | 'pending' | 'approved' | 'rejected';

export function isSupportedExtensionFormat(fileName: string): boolean {
	return /\.vsix$/i.test(String(fileName || ''));
}

export function isApiVersionCompatible(requested: string | undefined, current = KUUNDA_API_VERSION): boolean {
	const req = parseSemver(requested || current);
	const cur = parseSemver(current);
	if (!req || !cur) {
		return false;
	}
	if (req.major !== cur.major) {
		return false;
	}
	if (req.minor > cur.minor) {
		return false;
	}
	if (req.minor === cur.minor && req.patch > cur.patch) {
		return false;
	}
	return true;
}

export function parseKuundaContribution(manifest: { contributes?: { kuunda?: { apiVersion?: string; permissions?: string[] } } } | undefined): { apiVersion: string; permissions: KuundaApiPermission[] } {
	const raw = manifest?.contributes?.kuunda;
	if (!raw || typeof raw !== 'object') {
		return { apiVersion: KUUNDA_API_VERSION, permissions: [] };
	}
	const apiVersion = String(raw.apiVersion || KUUNDA_API_VERSION);
	const permissions = (Array.isArray(raw.permissions) ? raw.permissions : [])
		.map((name) => String(name))
		.filter((name): name is KuundaApiPermission => (KUUNDA_API_PERMISSIONS as readonly string[]).includes(name));
	return { apiVersion, permissions };
}

export function reviewThirdPartyExtension(input: { source?: string; reviewStatus?: string } = {}): { status: string; trustedGallery: boolean; kuundaApi: string } {
	const src = String(input.source || '');
	if (src === 'openvsx') {
		return { status: 'openvsx', trustedGallery: true, kuundaApi: 'grant_required' };
	}
	if (src === 'sideload') {
		return { status: 'sideload', trustedGallery: false, kuundaApi: 'grant_required' };
	}
	if (src === 'builtin') {
		return { status: 'openvsx', trustedGallery: true, kuundaApi: 'grant_required' };
	}
	if (src === 'kuunda_marketplace') {
		const status = ['openvsx', 'sideload', 'pending', 'approved', 'rejected'].includes(String(input.reviewStatus))
			? String(input.reviewStatus)
			: 'pending';
		return { status, trustedGallery: status === 'approved', kuundaApi: status === 'approved' ? 'grant_required' : 'review_required' };
	}
	return { status: 'rejected', trustedGallery: false, kuundaApi: 'unknown_source' };
}

export function decideMarketplaceInstall(input: { format?: string; source?: string; reviewStatus?: string } = {}): { ok: true; policy: string; trustedGallery: boolean } | { ok: false; error: string } {
	const raw = String(input.format || 'vsix');
	const okFormat = raw === 'vsix' || raw === '.vsix' || isSupportedExtensionFormat(raw);
	if (!okFormat) {
		return { ok: false, error: 'unsupported_format' };
	}
	const review = reviewThirdPartyExtension({ source: input.source, reviewStatus: input.reviewStatus });
	if (review.kuundaApi === 'unknown_source') {
		return { ok: false, error: 'unknown_source' };
	}
	if (input.source === 'kuunda_marketplace' && review.status !== 'approved') {
		return { ok: false, error: 'review_required' };
	}
	if (review.status === 'rejected') {
		return { ok: false, error: 'rejected' };
	}
	return { ok: true, policy: review.status, trustedGallery: review.trustedGallery };
}

export function decideKuundaApiAccess(input: {
	method?: string;
	extensionId?: string;
	declaredPermissions?: string[];
	grantedPermissions?: string[];
	source?: string;
	reviewStatus?: string;
	apiVersion?: string;
} = {}): { ok: true; method: string; permission: string | null } | { ok: false; error: string } {
	if (!String(input.extensionId || '').trim()) {
		return { ok: false, error: 'missing_extension' };
	}
	const spec = KUUNDA_API_METHODS[input.method as KuundaApiMethod];
	if (!spec) {
		return { ok: false, error: 'unknown_method' };
	}
	if (!isApiVersionCompatible(input.apiVersion || KUUNDA_API_VERSION)) {
		return { ok: false, error: 'incompatible_api' };
	}
	const market = decideMarketplaceInstall({
		format: 'vsix',
		source: input.source || 'openvsx',
		reviewStatus: input.reviewStatus,
	});
	if (!market.ok) {
		return { ok: false, error: market.error };
	}
	if (!spec.permission) {
		return { ok: true, method: String(input.method), permission: null };
	}
	if (!(input.declaredPermissions || []).includes(spec.permission)) {
		return { ok: false, error: 'undeclared_permission' };
	}
	if (!(input.grantedPermissions || []).includes(spec.permission)) {
		return { ok: false, error: 'not_granted' };
	}
	return { ok: true, method: String(input.method), permission: spec.permission };
}

export function describeKuundaApi(): { version: string; format: string; marketplace: string; permissions: string[]; methods: string[] } {
	return {
		version: KUUNDA_API_VERSION,
		format: KUUNDA_EXTENSION_FORMAT,
		marketplace: OPEN_VSX_GALLERY,
		permissions: [...KUUNDA_API_PERMISSIONS],
		methods: Object.keys(KUUNDA_API_METHODS),
	};
}

export function containsForbiddenSecret(value: unknown): boolean {
	return /^(secret|password|credential|msisdn|hmac|token|authorization|api[_-]?key|anon[_-]?key|service[_-]?role)$/i.test(String(value || ''));
}

export function redactApiPayload(payload: unknown): unknown {
	if (payload == null || typeof payload !== 'object') {
		return payload;
	}
	const out: Record<string, unknown> | unknown[] = Array.isArray(payload) ? [] : {};
	for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
		if (containsForbiddenSecret(key) || containsForbiddenSecret(value)) {
			continue;
		}
		if (typeof value === 'string' && /kuunda_anon_|service_role|sk_|whsec_/i.test(value)) {
			continue;
		}
		if (value && typeof value === 'object') {
			(out as Record<string, unknown>)[key] = redactApiPayload(value);
		} else {
			(out as Record<string, unknown>)[key] = value;
		}
	}
	return out;
}

function parseSemver(version: string): { major: number; minor: number; patch: number } | null {
	const match = String(version || '').trim().match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
	if (!match) {
		return null;
	}
	return { major: Number(match[1]), minor: Number(match[2] || 0), patch: Number(match[3] || 0) };
}

export function marketplaceSourceFromInstall(input: {
	installSource?: string;
	isBuiltin?: boolean;
	isUnderDevelopment?: boolean;
} = {}): MarketplaceSource {
	if (input.isBuiltin) {
		return 'builtin';
	}
	if (input.isUnderDevelopment) {
		return 'sideload';
	}
	if (input.installSource === 'vsix' || input.installSource === 'resource') {
		return 'sideload';
	}
	if (input.installSource === 'gallery') {
		return 'openvsx';
	}
	return 'openvsx';
}

export function canGrantPermission(declaredPermissions: string[] | undefined, permission: string): boolean {
	return (declaredPermissions || []).includes(permission);
}
