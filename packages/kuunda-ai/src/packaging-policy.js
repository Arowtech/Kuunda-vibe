/**
 * Phase 9 — packaging / distribution policy.
 * No private signing keys, no store certs, no wrangler deploy.
 */

export const BUILDER_NAME = 'kuunda-builder';
export const BUILDER_RENAMED_FROM = 'void-builder';
export const UPDATE_BASE_URL = 'https://updates.ide.kuunda-cloud.com';
export const DEFAULT_CHANNEL = 'internal';
export const SIGNATURE_ALGORITHM = 'Ed25519-SHA256';
export const UPDATE_VERIFY_ALWAYS = true;

export const PACKAGED_PLATFORMS = Object.freeze([
	'win32-x64',
	'win32-arm64',
	'darwin-x64',
	'darwin-arm64',
]);

export const GULP_TASK_BY_PLATFORM = Object.freeze({
	'win32-x64': 'vscode-win32-x64',
	'win32-arm64': 'vscode-win32-arm64',
	'darwin-x64': 'vscode-darwin-x64',
	'darwin-arm64': 'vscode-darwin-arm64',
});

/** Inno Setup (Windows) vs zip (macOS). */
export const SETUP_TASK_BY_PLATFORM = Object.freeze({
	'win32-x64': 'vscode-win32-x64-user-setup',
	'win32-arm64': 'vscode-win32-arm64-user-setup',
	'darwin-x64': 'vscode-darwin-x64',
	'darwin-arm64': 'vscode-darwin-arm64',
});

export const UPDATE_DOWNLOAD_HOST = 'updates.ide.kuunda-cloud.com';
export const SHA256_HEX = /^[0-9a-f]{64}$/i;

export const CHANNELS = Object.freeze(['internal', 'staging', 'stable']);

export const CODE_SIGN_SECRETS = Object.freeze({
	windows: ['WINDOWS_CERT_PFX', 'WINDOWS_CERT_PASSWORD'],
	darwin: ['APPLE_CERTIFICATE', 'APPLE_CERTIFICATE_PASSWORD', 'APPLE_API_KEY', 'APPLE_API_KEY_ID', 'APPLE_API_ISSUER'],
	updates: ['UPDATE_SIGNING_PRIVATE_KEY'],
});

export function isPackagedPlatform(platform) {
	return PACKAGED_PLATFORMS.includes(String(platform || ''));
}

export function gulpTaskFor(platform) {
	return GULP_TASK_BY_PLATFORM[platform] || null;
}

export function setupTaskFor(platform) {
	return SETUP_TASK_BY_PLATFORM[platform] || null;
}

/** IDE feed ids: win32-x64-user, darwin → build ids win32-x64, darwin-x64. */
export function normalizeUpdatePlatform(platform) {
	const raw = String(platform || '').trim();
	if (raw === 'darwin') {
		return 'darwin-x64';
	}
	return raw.replace(/-(user|archive|system)$/i, '');
}

export function isAllowedUpdateDownloadUrl(url) {
	try {
		const parsed = new URL(String(url || ''));
		return parsed.protocol === 'https:' && parsed.hostname === UPDATE_DOWNLOAD_HOST;
	} catch {
		return false;
	}
}

export function createUpdateFeedUrl({ platform, quality, commit, baseUrl = UPDATE_BASE_URL } = {}) {
	const host = String(baseUrl || UPDATE_BASE_URL).replace(/\/+$/, '');
	const plat = normalizeUpdatePlatform(platform);
	const channel = String(quality || DEFAULT_CHANNEL).trim() || DEFAULT_CHANNEL;
	const sha = String(commit || '').trim();
	if (!plat || !sha || !CHANNELS.includes(channel)) {
		return { ok: false, error: 'missing_feed_params' };
	}
	return {
		ok: true,
		url: `${host}/api/update/${encodeURIComponent(plat)}/${encodeURIComponent(channel)}/${encodeURIComponent(sha)}`,
	};
}

/**
 * @param {{ platform?: string, channel?: string }} input
 */
export function decidePackage(input = {}) {
	const platform = String(input.platform || '');
	const channel = CHANNELS.includes(input.channel) ? input.channel : DEFAULT_CHANNEL;
	if (!isPackagedPlatform(platform)) {
		return { ok: false, error: 'unsupported_platform', builder: BUILDER_NAME, channel };
	}
	return {
		ok: true,
		builder: BUILDER_NAME,
		platform,
		channel,
		gulpTask: gulpTaskFor(platform),
		setupTask: setupTaskFor(platform),
		audience: channel === 'internal' ? 'internal_test' : channel,
	};
}

/**
 * Internal unsigned builds are allowed. Public/stable requires platform certs.
 * @param {{ channel?: string, platform?: string, hasWindowsCert?: boolean, hasAppleIdentity?: boolean }} input
 */
export function decideCodeSign(input = {}) {
	const channel = CHANNELS.includes(input.channel) ? input.channel : DEFAULT_CHANNEL;
	const platform = String(input.platform || '');
	const windows = platform.startsWith('win32');
	const darwin = platform.startsWith('darwin');
	const hasCert = windows ? input.hasWindowsCert === true : darwin ? input.hasAppleIdentity === true : false;
	if (channel === 'internal') {
		return { ok: true, signed: hasCert, required: false, channel, skipReason: hasCert ? undefined : 'internal_unsigned_ok' };
	}
	if (!hasCert) {
		return { ok: false, error: 'code_sign_required', signed: false, required: true, channel };
	}
	return { ok: true, signed: true, required: true, channel };
}

/**
 * 9.4 — first releases stay internal until the steward opens a public channel.
 * @param {{ channel?: string, publicRelease?: boolean }} input
 */
export function decideRelease(input = {}) {
	const channel = CHANNELS.includes(input.channel) ? input.channel : DEFAULT_CHANNEL;
	if (channel === 'stable' || input.publicRelease === true) {
		return { ok: false, error: 'public_release_blocked', channel, audience: 'public' };
	}
	return { ok: true, channel, audience: 'internal_test' };
}

/**
 * Fail-closed: missing signature is never "ok for tests".
 * @param {{ url?: string, version?: string, productVersion?: string, sha256hash?: string, signature?: string }} manifest
 */
export function requireUpdateSignature(manifest = {}) {
	if (!manifest || !manifest.url || !manifest.version || !manifest.productVersion) {
		return { ok: false, error: 'invalid_manifest' };
	}
	if (!isAllowedUpdateDownloadUrl(manifest.url)) {
		return { ok: false, error: 'url_not_allowed' };
	}
	const sha256hash = String(manifest.sha256hash || '').trim().toLowerCase();
	const signature = String(manifest.signature || '').replace(/\s/g, '');
	if (!SHA256_HEX.test(sha256hash) || signature.length < 80) {
		return { ok: false, error: 'signature_required', algorithm: SIGNATURE_ALGORITHM };
	}
	if (UPDATE_VERIFY_ALWAYS !== true) {
		return { ok: false, error: 'verify_disabled_forbidden' };
	}
	return { ok: true, algorithm: SIGNATURE_ALGORITHM, sha256hash, signature };
}

export function inspectUpdateManifest(update) {
	if (!update) {
		return { ok: false, error: 'invalid_manifest' };
	}
	return requireUpdateSignature(update);
}

export function planKuundaBuild(input = {}) {
	const pack = decidePackage(input);
	if (!pack.ok) {
		return pack;
	}
	const sign = decideCodeSign({ ...input, platform: pack.platform, channel: pack.channel });
	const release = decideRelease({ channel: pack.channel, publicRelease: input.publicRelease });
	const feed = createUpdateFeedUrl({
		platform: pack.platform,
		quality: pack.channel,
		commit: input.commit || 'unbuilt',
	});
	return {
		ok: pack.ok && sign.ok && release.ok,
		builder: BUILDER_NAME,
		renamedFrom: BUILDER_RENAMED_FROM,
		platform: pack.platform,
		gulpTask: pack.gulpTask,
		setupTask: pack.setupTask,
		channel: pack.channel,
		sign,
		release,
		feed,
		compileElectron: false,
		wranglerDeploy: false,
	};
}

export function formatUpdateIntegrityError(locale = 'en') {
	const fr = locale === 'fr' || (typeof locale === 'string' && locale.startsWith('fr'));
	return fr
		? 'Mise à jour refusée : signature Ed25519 absente ou invalide. La vérification ne peut pas être désactivée.'
		: 'Update rejected: missing or invalid Ed25519 signature. Verification cannot be turned off.';
}
