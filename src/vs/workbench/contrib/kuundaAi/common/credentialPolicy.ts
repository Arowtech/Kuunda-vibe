/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

export const SECRET_PLACEHOLDER = '<SET VIA SECRET STORE>';

export const CREDENTIAL_CLASSES = ['agent_byok', 'kuunda_cloud', 'store_developer', 'genius_pay'] as const;
export type CredentialClass = typeof CREDENTIAL_CLASSES[number];

export const REQUIRED_GITIGNORE_ENTRIES = [
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
] as const;

export const SECRET_PATH_PATTERNS = [
	/(^|\/)\.env(\.|$)/i,
	/\.(pem|p12|key|p8|keystore)$/i,
	/(^|\/)credentials\.json$/i,
	/(^|\/)\.kuunda\/(cloud\.local|publish\.local|play-service-account)\.json$/i,
	/(^|\/)\.kuunda\/(authkey\.p8|upload\.keystore)$/i,
	/(^|\/)play-service-account\.json$/i,
];

const FORBIDDEN_KEY = /^(private[_-]?key|privateKey|service[_-]?role|operatorToken|password|secret|token|authorization|api[_-]?key|aiKey|GITHUB_DISPATCH|GENIUSPAY_|whsec)/i;
const SECRET_VALUE = /BEGIN [A-Z ]+PRIVATE KEY|sk_live_|sk_sandbox_|pk_live_|pk_sandbox_|whsec_|ghp_|AKIA[0-9A-Z]{16}|service_role/;

export type CredentialFinding = { code: string; path?: string; entry?: string };

export function classifyCredentialPath(path: string): CredentialClass | undefined {
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

export function looksLikeSecret(value: unknown): boolean {
	if (typeof value !== 'string') {
		return false;
	}
	const text = value.trim();
	if (!text || text === SECRET_PLACEHOLDER || text.includes(SECRET_PLACEHOLDER)) {
		return false;
	}
	return SECRET_VALUE.test(text);
}

export function gitignoreCovers(gitignoreText: string, entry: string): boolean {
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

export function persistableIsSafe(payload: unknown, path = ''): { ok: boolean; findings: CredentialFinding[] } {
	const findings: CredentialFinding[] = [];
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
	for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
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

export function auditCredentialStorage(input: {
	gitignoreText?: string;
	persistablePayloads?: unknown[];
	committedRelPaths?: string[];
} = {}): { ok: boolean; findings: CredentialFinding[] } {
	const findings: CredentialFinding[] = [];
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
