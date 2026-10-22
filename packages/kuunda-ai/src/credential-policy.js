/**
 * Phase 8.1 — credential storage audit (public kernel).
 * Classifies where secrets may live. Genius Pay and operator tokens stay private.
 */

export const SECRET_PLACEHOLDER = '<SET VIA SECRET STORE>';

export const CREDENTIAL_CLASSES = Object.freeze([
	'agent_byok',
	'kuunda_cloud',
	'store_developer',
	'genius_pay',
]);

/** Paths that must never be committed (gitignore or equivalent). */
export const REQUIRED_GITIGNORE_ENTRIES = Object.freeze([
	'.env',
	'.env.*',
	'*.pem',
	'*.p12',
	'*.key',
	'*.p8',
	'*.keystore',
	'credentials.json',
	'.kuunda/cloud.local.json',
	'.kuunda/publish.local.json',
	'.kuunda/play-service-account.json',
	'.kuunda/authkey.p8',
	'.kuunda/upload.keystore',
]);

export const SECRET_PATH_PATTERNS = Object.freeze([
	/(^|\/)\.env(\.|$)/i,
	/\.(pem|p12|key|p8|keystore)$/i,
	/(^|\/)credentials\.json$/i,
	/(^|\/)\.kuunda\/(cloud\.local|publish\.local|play-service-account)\.json$/i,
	/(^|\/)\.kuunda\/(authkey\.p8|upload\.keystore)$/i,
	/(^|\/)play-service-account\.json$/i,
]);

const FORBIDDEN_KEY = /^(private[_-]?key|privateKey|service[_-]?role|operatorToken|password|secret|token|authorization|api[_-]?key|aiKey|GITHUB_DISPATCH|GENIUSPAY_|whsec)/i;
const SECRET_VALUE = /BEGIN [A-Z ]+PRIVATE KEY|sk_live_|sk_sandbox_|pk_live_|pk_sandbox_|whsec_|ghp_|AKIA[0-9A-Z]{16}|service_role/;

/**
 * @param {string} path
 * @returns {'agent_byok' | 'kuunda_cloud' | 'store_developer' | 'genius_pay' | undefined}
 */
export function classifyCredentialPath(path) {
	const rel = String(path || '').replace(/\\/g, '/');
	if (/\.(p8|keystore)$/i.test(rel) || /play-service-account|authkey|upload\.keystore|publish\.local/i.test(rel)) {
		return 'store_developer';
	}
	if (/\.env|cloud\.local/i.test(rel)) {
		return 'kuunda_cloud';
	}
	if (/genius-?pay|GENIUSPAY/i.test(rel)) {
		return 'genius_pay';
	}
	if (/settings\.json|aiKey|voidSettings/i.test(rel)) {
		return 'agent_byok';
	}
	return undefined;
}

/**
 * @param {unknown} value
 */
export function looksLikeSecret(value) {
	if (typeof value !== 'string') {
		return false;
	}
	const text = value.trim();
	if (!text || text === SECRET_PLACEHOLDER || text.includes(SECRET_PLACEHOLDER)) {
		return false;
	}
	return SECRET_VALUE.test(text);
}

/**
 * @param {string} gitignoreText
 * @param {string} entry
 */
export function gitignoreCovers(gitignoreText, entry) {
	const lines = String(gitignoreText || '')
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter((line) => line && !line.startsWith('#'));
	if (lines.includes(entry)) {
		return true;
	}
	if (entry === '.env.*' && (lines.includes('.env.*') || lines.includes('.env*'))) {
		return true;
	}
	if (entry.startsWith('.kuunda/') && (lines.includes('.kuunda/*.json') || lines.includes(entry))) {
		return true;
	}
	return false;
}

/**
 * @param {unknown} payload
 * @param {string} [path]
 * @returns {{ ok: boolean, findings: Array<{ code: string, path: string }> }}
 */
export function persistableIsSafe(payload, path = '') {
	/** @type {Array<{ code: string, path: string }>} */
	const findings = [];
	if (payload == null) {
		return { ok: true, findings };
	}
	if (typeof payload === 'string') {
		if (looksLikeSecret(payload)) {
			findings.push({ code: 'secret_value', path: path || '(string)' });
		}
		return { ok: findings.length === 0, findings };
	}
	if (typeof payload !== 'object') {
		return { ok: true, findings };
	}
	for (const [key, value] of Object.entries(payload)) {
		const next = path ? `${path}.${key}` : key;
		if (FORBIDDEN_KEY.test(key) && !(typeof value === 'string' && (value === SECRET_PLACEHOLDER || value.includes(SECRET_PLACEHOLDER)))) {
			findings.push({ code: 'forbidden_key', path: next });
			continue;
		}
		if (typeof value === 'string' && looksLikeSecret(value)) {
			findings.push({ code: 'secret_value', path: next });
		} else if (value && typeof value === 'object') {
			findings.push(...persistableIsSafe(value, next).findings);
		}
	}
	return { ok: findings.length === 0, findings };
}

/**
 * @param {object} input
 * @param {string} [input.gitignoreText]
 * @param {unknown[]} [input.persistablePayloads]
 * @param {string[]} [input.committedRelPaths]
 */
export function auditCredentialStorage(input = {}) {
	/** @type {Array<{ code: string, path?: string, entry?: string }>} */
	const findings = [];
	const gitignoreText = String(input.gitignoreText || '');
	for (const entry of REQUIRED_GITIGNORE_ENTRIES) {
		if (!gitignoreCovers(gitignoreText, entry)) {
			findings.push({ code: 'missing_gitignore', entry });
		}
	}
	for (const rel of input.committedRelPaths || []) {
		const normalized = String(rel || '').replace(/\\/g, '/');
		if (SECRET_PATH_PATTERNS.some((pattern) => pattern.test(normalized))) {
			findings.push({ code: 'committed_secret_path', path: normalized });
		}
	}
	for (const payload of input.persistablePayloads || []) {
		findings.push(...persistableIsSafe(payload).findings);
	}
	return { ok: findings.length === 0, findings };
}
