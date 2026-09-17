/**
 * Phase 4bis — versioned Kuunda API for VS Code/Open VSX extensions.
 * Standard VSIX only; no proprietary package format.
 */

export const KUUNDA_API_VERSION = '1.0.0';
export const KUUNDA_EXTENSION_FORMAT = 'vsix';
export const OPEN_VSX_GALLERY = 'openvsx';

export const KUUNDA_API_PERMISSIONS = Object.freeze(['agent', 'credits', 'kuundaCloud', 'kuundaPublish']);

export const KUUNDA_API_METHODS = Object.freeze({
	'api.version': { permission: null },
	'agent.capabilities': { permission: 'agent' },
	'agent.getPolicy': { permission: 'agent' },
	'credits.balance': { permission: 'credits' },
	'cloud.status': { permission: 'kuundaCloud' },
	'publish.status': { permission: 'kuundaPublish' },
});

export const MARKETPLACE_SOURCES = Object.freeze(['openvsx', 'sideload', 'kuunda_marketplace', 'builtin']);
export const REVIEW_STATUSES = Object.freeze(['openvsx', 'sideload', 'pending', 'approved', 'rejected']);

export function isSupportedExtensionFormat(fileName) {
	return /\.vsix$/i.test(String(fileName || ''));
}

export function isApiVersionCompatible(requested, current = KUUNDA_API_VERSION) {
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

export function parseKuundaContribution(manifest) {
	const raw = manifest && manifest.contributes && manifest.contributes.kuunda;
	if (!raw || typeof raw !== 'object') {
		return { apiVersion: KUUNDA_API_VERSION, permissions: [] };
	}
	const apiVersion = String(raw.apiVersion || KUUNDA_API_VERSION);
	const permissions = (Array.isArray(raw.permissions) ? raw.permissions : [])
		.map((name) => String(name))
		.filter((name) => KUUNDA_API_PERMISSIONS.includes(name));
	return { apiVersion, permissions };
}

export function reviewThirdPartyExtension({ source, reviewStatus } = {}) {
	const src = String(source || '');
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
		const status = REVIEW_STATUSES.includes(reviewStatus) ? reviewStatus : 'pending';
		return { status, trustedGallery: status === 'approved', kuundaApi: status === 'approved' ? 'grant_required' : 'review_required' };
	}
	return { status: 'rejected', trustedGallery: false, kuundaApi: 'unknown_source' };
}

export function decideMarketplaceInstall({ format, source, reviewStatus } = {}) {
	const raw = String(format || 'vsix');
	const okFormat = raw === 'vsix' || raw === '.vsix' || isSupportedExtensionFormat(raw);
	if (!okFormat) {
		return { ok: false, error: 'unsupported_format' };
	}
	const review = reviewThirdPartyExtension({ source, reviewStatus });
	if (review.kuundaApi === 'unknown_source') {
		return { ok: false, error: 'unknown_source' };
	}
	if (source === 'kuunda_marketplace' && review.status !== 'approved') {
		return { ok: false, error: 'review_required' };
	}
	if (review.status === 'rejected') {
		return { ok: false, error: 'rejected' };
	}
	return { ok: true, policy: review.status, trustedGallery: review.trustedGallery };
}

export function decideKuundaApiAccess({
	method,
	extensionId,
	declaredPermissions,
	grantedPermissions,
	source,
	reviewStatus,
	apiVersion,
} = {}) {
	if (!String(extensionId || '').trim()) {
		return { ok: false, error: 'missing_extension' };
	}
	const spec = KUUNDA_API_METHODS[method];
	if (!spec) {
		return { ok: false, error: 'unknown_method' };
	}
	if (!isApiVersionCompatible(apiVersion || KUUNDA_API_VERSION)) {
		return { ok: false, error: 'incompatible_api' };
	}
	const market = decideMarketplaceInstall({
		format: 'vsix',
		source: source || 'openvsx',
		reviewStatus,
	});
	if (!market.ok) {
		return { ok: false, error: market.error };
	}
	if (!spec.permission) {
		return { ok: true, method, permission: null };
	}
	if (!(declaredPermissions || []).includes(spec.permission)) {
		return { ok: false, error: 'undeclared_permission' };
	}
	if (!(grantedPermissions || []).includes(spec.permission)) {
		return { ok: false, error: 'not_granted' };
	}
	return { ok: true, method, permission: spec.permission };
}

export function describeKuundaApi() {
	return {
		version: KUUNDA_API_VERSION,
		format: KUUNDA_EXTENSION_FORMAT,
		marketplace: OPEN_VSX_GALLERY,
		permissions: [...KUUNDA_API_PERMISSIONS],
		methods: Object.keys(KUUNDA_API_METHODS),
	};
}

export function containsForbiddenSecret(value) {
	return /^(secret|password|credential|msisdn|hmac|token|authorization|api[_-]?key|anon[_-]?key|service[_-]?role)$/i.test(String(value || ''));
}

export function redactApiPayload(payload) {
	if (payload == null || typeof payload !== 'object') {
		return payload;
	}
	const out = Array.isArray(payload) ? [] : {};
	for (const [key, value] of Object.entries(payload)) {
		if (containsForbiddenSecret(key) || containsForbiddenSecret(value)) {
			continue;
		}
		if (typeof value === 'string' && /kuunda_anon_|service_role|sk_|whsec_/i.test(value)) {
			continue;
		}
		if (value && typeof value === 'object') {
			out[key] = redactApiPayload(value);
		} else {
			out[key] = value;
		}
	}
	return out;
}

function parseSemver(version) {
	const match = String(version || '').trim().match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
	if (!match) {
		return null;
	}
	return { major: Number(match[1]), minor: Number(match[2] || 0), patch: Number(match[3] || 0) };
}

export function marketplaceSourceFromInstall({
	installSource,
	isBuiltin,
	isUnderDevelopment,
} = {}) {
	if (isBuiltin) {
		return 'builtin';
	}
	if (isUnderDevelopment) {
		return 'sideload';
	}
	if (installSource === 'vsix' || installSource === 'resource') {
		return 'sideload';
	}
	if (installSource === 'gallery') {
		return 'openvsx';
	}
	return 'openvsx';
}

export function canGrantPermission(declaredPermissions, permission) {
	return (declaredPermissions || []).includes(permission);
}
