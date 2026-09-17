/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import { mergeGitignore, SECRET_PLACEHOLDER } from '../../kuundaCloud/common/cloudProvision.js';
import { persistableIsSafe } from '../../kuundaAi/common/credentialPolicy.js';

export { SECRET_PLACEHOLDER };

export const PUBLISH_TARGETS = ['google_play', 'app_store'] as const;
export const PUBLISH_JOB_STATUSES = ['queued', 'running', 'succeeded', 'failed', 'pending_ci'] as const;
export const PUBLISH_FAILURE_CODES = [
	'not_mobile',
	'no_targets',
	'incomplete_metadata',
	'missing_credentials',
	'missing_signature',
	'runner_unavailable',
] as const;
export const PUBLISH_LOCAL_PATH = '.kuunda/publish.local.json';
export const PUBLISH_PLAY_JSON_PATH = '.kuunda/play-service-account.json';
export const PUBLISH_ASC_P8_PATH = '.kuunda/authkey.p8';
export const PUBLISH_KEYSTORE_PATH = '.kuunda/upload.keystore';
export const PUBLISH_WORKFLOW_PATH = '.github/workflows/kuunda-publish.yml';
export const PUBLISH_GITIGNORE_ENTRIES = [
	PUBLISH_LOCAL_PATH,
	PUBLISH_PLAY_JSON_PATH,
	PUBLISH_ASC_P8_PATH,
	PUBLISH_KEYSTORE_PATH,
	'store/**/*.p8',
	'store/**/*.keystore',
	'store/**/*service-account*.json',
];

const SECRET_KEY = /^(private[_-]?key|password|secret|token|authorization|api[_-]?key|keystore(Password)?|p8|playJson|GITHUB_DISPATCH)$/i;
const SECRET_VALUE = /BEGIN [A-Z ]+PRIVATE KEY|sk_|whsec_|-----/;

export type PublishTarget = typeof PUBLISH_TARGETS[number];
export type PublishJobStatus = typeof PUBLISH_JOB_STATUSES[number];
export type PublishFailureCode = typeof PUBLISH_FAILURE_CODES[number];

export type PublishLocal = {
	version?: string;
	packageId?: string;
	googlePlay: { configured: boolean; clientEmail?: string };
	appStore: { configured: boolean; keyId?: string; issuerId?: string };
	signatureReady: boolean;
	lastJobId?: string;
};

export type PublishFile = { path: string; content: string; gitignored?: boolean };

export type PublishDecision =
	| { ok: true; action: 'enqueue'; targets: PublishTarget[]; metadata: { version: string; packageId: string } }
	| { ok: false; error: string; target?: string };

export type PublicPublishJob = {
	id: string;
	status: PublishJobStatus;
	targets: PublishTarget[];
	version?: string;
	packageId?: string;
	failureCode?: PublishFailureCode;
};

export function isPublishPanelVisible(manifest: { type?: string } | undefined): boolean {
	return Boolean(manifest && manifest.type === 'mobile');
}

export function sanitizePackageId(value: unknown): string {
	const id = String(value || '').trim();
	if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){1,8}$/i.test(id) || id.length > 128) {
		return '';
	}
	return id;
}

export function sanitizeAppVersion(value: unknown): string {
	const version = String(value || '').trim();
	if (!/^\d+\.\d+\.\d+$/.test(version)) {
		return '';
	}
	return version;
}

export function parsePublishLocal(raw: unknown): PublishLocal {
	let data = raw;
	if (typeof raw === 'string') {
		try {
			data = JSON.parse(raw);
		} catch {
			return emptyPublishLocal();
		}
	}
	if (!data || typeof data !== 'object' || Array.isArray(data)) {
		return emptyPublishLocal();
	}
	const record = data as {
		version?: unknown;
		packageId?: unknown;
		googlePlay?: { configured?: unknown; clientEmail?: unknown };
		appStore?: { configured?: unknown; keyId?: unknown; issuerId?: unknown };
		signatureReady?: unknown;
		lastJobId?: unknown;
	};
	return {
		version: sanitizeAppVersion(record.version) || undefined,
		packageId: sanitizePackageId(record.packageId) || undefined,
		googlePlay: {
			configured: record.googlePlay?.configured === true,
			clientEmail: redactEmail(record.googlePlay?.clientEmail),
		},
		appStore: {
			configured: record.appStore?.configured === true,
			keyId: sanitizeAppleId(record.appStore?.keyId),
			issuerId: sanitizeAppleId(record.appStore?.issuerId),
		},
		signatureReady: record.signatureReady === true,
		lastJobId: sanitizeJobId(record.lastJobId) || undefined,
	};
}

function emptyPublishLocal(): PublishLocal {
	return {
		googlePlay: { configured: false },
		appStore: { configured: false },
		signatureReady: false,
	};
}

function redactEmail(value: unknown): string | undefined {
	const email = String(value || '').trim();
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 128) {
		return undefined;
	}
	return email;
}

function sanitizeAppleId(value: unknown): string | undefined {
	const id = String(value || '').trim();
	if (!/^[A-Za-z0-9-]{4,64}$/.test(id)) {
		return undefined;
	}
	return id;
}

export function inspectPlayServiceAccount(raw: unknown): { ok: true; clientEmail: string; configured: true } | { ok: false; error: string } {
	let data = raw;
	if (typeof raw === 'string') {
		try {
			data = JSON.parse(raw);
		} catch {
			return { ok: false, error: 'invalid_play_json' };
		}
	}
	if (!data || typeof data !== 'object' || (data as { type?: unknown }).type !== 'service_account') {
		return { ok: false, error: 'invalid_play_json' };
	}
	const clientEmail = redactEmail((data as { client_email?: unknown }).client_email);
	const privateKey = String((data as { private_key?: unknown }).private_key || '');
	if (!clientEmail || !/BEGIN [A-Z ]*PRIVATE KEY/.test(privateKey) || privateKey.length < 80) {
		return { ok: false, error: 'invalid_play_json' };
	}
	return { ok: true, clientEmail, configured: true };
}

export function inspectAppStoreP8(raw: unknown): { ok: true; configured: true } | { ok: false; error: string } {
	const text = String(raw || '');
	if (!/BEGIN [A-Z ]*PRIVATE KEY/.test(text) || text.length < 80 || text.length > 16_000) {
		return { ok: false, error: 'invalid_p8' };
	}
	return { ok: true, configured: true };
}

export function inspectAppStoreIds(input: { keyId?: string; issuerId?: string } = {}): { ok: true; keyId: string; issuerId: string } | { ok: false; error: string } {
	const keyId = sanitizeAppleId(input.keyId);
	const issuerId = sanitizeAppleId(input.issuerId);
	if (!keyId || !issuerId) {
		return { ok: false, error: 'invalid_store_ids' };
	}
	return { ok: true, keyId, issuerId };
}

export function verifyPublishFiles(input: { publishTargets?: string[]; files?: { playJson?: boolean; appStoreKey?: boolean; keystore?: boolean } } = {}): { ok: true } | { ok: false; error: string; target?: string } {
	const targets = (Array.isArray(input.publishTargets) ? input.publishTargets : []).filter((item): item is PublishTarget => (PUBLISH_TARGETS as readonly string[]).includes(item));
	if (targets.includes('google_play') && input.files?.playJson !== true) {
		return { ok: false, error: 'missing_credentials', target: 'google_play' };
	}
	if (targets.includes('app_store') && input.files?.appStoreKey !== true) {
		return { ok: false, error: 'missing_credentials', target: 'app_store' };
	}
	if (targets.includes('google_play') && input.files?.keystore !== true) {
		return { ok: false, error: 'missing_signature' };
	}
	return { ok: true };
}

export function sanitizePublishError(error: unknown): string {
	const code = String(error || '').trim();
	const allowed = new Set<string>([
		...PUBLISH_FAILURE_CODES,
		'missing_user',
		'invalid_play_json',
		'invalid_p8',
		'invalid_keystore',
		'invalid_store_ids',
		'write_failed',
	]);
	return allowed.has(code) ? code : 'write_failed';
}

export function inspectKeystore(size: unknown): { ok: true; signatureReady: true } | { ok: false; error: string } {
	const n = Number(size);
	if (!Number.isFinite(n) || n < 32 || n > 10_000_000) {
		return { ok: false, error: 'invalid_keystore' };
	}
	return { ok: true, signatureReady: true };
}

export function sanitizeJobId(value: unknown): string {
	const id = String(value || '').trim();
	if (!/^job_[a-z0-9]+$/i.test(id) || id.length > 64) {
		return '';
	}
	return id;
}

export function sanitizeUserRef(value: unknown): string {
	const id = String(value || '').trim();
	if (!id || id.length > 128) {
		return '';
	}
	return id;
}

export function publicPublishJob(job: unknown): PublicPublishJob | undefined {
	if (!job || typeof job !== 'object') {
		return undefined;
	}
	const record = job as { id?: unknown; status?: unknown; targets?: unknown; version?: unknown; packageId?: unknown; failureCode?: unknown };
	const id = sanitizeJobId(record.id);
	const status = PUBLISH_JOB_STATUSES.includes(record.status as PublishJobStatus) ? record.status as PublishJobStatus : undefined;
	if (!id || !status) {
		return undefined;
	}
	const targets = (Array.isArray(record.targets) ? record.targets : []).filter((item): item is PublishTarget => (PUBLISH_TARGETS as readonly string[]).includes(String(item)));
	const failureCode = PUBLISH_FAILURE_CODES.includes(record.failureCode as PublishFailureCode) ? record.failureCode as PublishFailureCode : undefined;
	return redactPublishPayload({
		id,
		status,
		targets,
		version: sanitizeAppVersion(record.version) || undefined,
		packageId: sanitizePackageId(record.packageId) || undefined,
		failureCode,
	}) as PublicPublishJob;
}

export function buildPublishRequest(input: {
	userId?: string;
	decision?: PublishDecision;
	credentials?: { googlePlay?: boolean; appStore?: boolean };
	signatureReady?: boolean;
} = {}): { ok: true; body: Record<string, unknown> } | { ok: false; error: string; target?: string } {
	const uid = sanitizeUserRef(input.userId);
	if (!uid) {
		return { ok: false, error: 'missing_user' };
	}
	if (!input.decision || input.decision.ok !== true) {
		return input.decision && input.decision.ok === false
			? input.decision
			: { ok: false, error: 'incomplete_metadata' };
	}
	return {
		ok: true,
		body: {
			userId: uid,
			targets: input.decision.targets,
			version: input.decision.metadata.version,
			packageId: input.decision.metadata.packageId,
			googlePlayConfigured: input.credentials?.googlePlay === true,
			appStoreConfigured: input.credentials?.appStore === true,
			signatureReady: input.signatureReady === true,
		},
	};
}

export function persistablePublishLocal(local: unknown): string {
	const parsed = parsePublishLocal(local);
	const payload: Record<string, unknown> = {
		version: parsed.version,
		packageId: parsed.packageId,
		googlePlay: { configured: parsed.googlePlay.configured === true, clientEmail: parsed.googlePlay.clientEmail },
		appStore: {
			configured: parsed.appStore.configured === true,
			keyId: parsed.appStore.keyId,
			issuerId: parsed.appStore.issuerId,
		},
		signatureReady: parsed.signatureReady === true,
		lastJobId: parsed.lastJobId,
	};
	if (!persistableIsSafe(payload).ok) {
		payload.googlePlay = { configured: parsed.googlePlay.configured === true };
		payload.appStore = { configured: parsed.appStore.configured === true };
		delete payload.lastJobId;
	}
	return `${JSON.stringify(payload, null, '\t')}\n`;
}

export function validatePublishMetadata(input: { version?: unknown; packageId?: unknown } = {}): { ok: true; version: string; packageId: string } | { ok: false; error: string } {
	const safeVersion = sanitizeAppVersion(input.version);
	const safeId = sanitizePackageId(input.packageId);
	if (!safeVersion || !safeId) {
		return { ok: false, error: 'incomplete_metadata' };
	}
	return { ok: true, version: safeVersion, packageId: safeId };
}

export function decidePublish(input: {
	type?: string;
	publishTargets?: string[];
	credentials?: { googlePlay?: boolean; appStore?: boolean };
	metadata?: { version?: string; packageId?: string };
	signatureReady?: boolean;
} = {}): PublishDecision {
	if (input.type !== 'mobile') {
		return { ok: false, error: 'not_mobile' };
	}
	const targets = (Array.isArray(input.publishTargets) ? input.publishTargets : []).filter((item): item is PublishTarget => (PUBLISH_TARGETS as readonly string[]).includes(item));
	if (!targets.length) {
		return { ok: false, error: 'no_targets' };
	}
	const meta = validatePublishMetadata(input.metadata);
	if (!meta.ok) {
		return meta;
	}
	if (targets.includes('google_play') && input.credentials?.googlePlay !== true) {
		return { ok: false, error: 'missing_credentials', target: 'google_play' };
	}
	if (targets.includes('app_store') && input.credentials?.appStore !== true) {
		return { ok: false, error: 'missing_credentials', target: 'app_store' };
	}
	if (targets.includes('google_play') && input.signatureReady !== true) {
		return { ok: false, error: 'missing_signature' };
	}
	return {
		ok: true,
		action: 'enqueue',
		targets,
		metadata: { version: meta.version, packageId: meta.packageId },
	};
}

export function redactPublishPayload(payload: unknown): unknown {
	if (payload == null || typeof payload !== 'object') {
		return payload;
	}
	const out: Record<string, unknown> | unknown[] = Array.isArray(payload) ? [] : {};
	for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
		if (SECRET_KEY.test(key) || (typeof value === 'string' && SECRET_VALUE.test(value))) {
			continue;
		}
		if (value && typeof value === 'object') {
			(out as Record<string, unknown>)[key] = redactPublishPayload(value);
		} else {
			(out as Record<string, unknown>)[key] = value;
		}
	}
	return out;
}

export function redactPublishLog(line: unknown): string {
	const text = String(line || '').replace(/\r/g, '');
	if (SECRET_KEY.test(text) || SECRET_VALUE.test(text) || /private[_-]?key|PLAY_SERVICE_ACCOUNT|APP_STORE_CONNECT/i.test(text)) {
		return '[redacted]';
	}
	return text.slice(0, 500);
}

export function githubWorkflowSource(): string {
	return `name: kuunda-publish
on:
  workflow_dispatch:
    inputs:
      target:
        description: google_play or app_store
        required: true
jobs:
  android:
    if: \${{ inputs.target == 'google_play' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: echo "AAB build uses GitHub secret PLAY_SERVICE_ACCOUNT — never commit it."
  ios:
    if: \${{ inputs.target == 'app_store' }}
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v4
      - run: echo "IPA build uses GitHub secrets APP_STORE_CONNECT_API_KEY — never commit it."
`;
}

export function scaffoldPublishFiles(input: { existingGitignore?: string } = {}): { ok: true; files: PublishFile[] } {
	const gitignore = mergeGitignore(input.existingGitignore, PUBLISH_GITIGNORE_ENTRIES);
	const files: PublishFile[] = [
		{ path: PUBLISH_WORKFLOW_PATH, content: githubWorkflowSource() },
		{ path: PUBLISH_LOCAL_PATH, content: persistablePublishLocal(emptyPublishLocal()), gitignored: true },
	];
	if (gitignore.changed) {
		files.push({ path: '.gitignore', content: gitignore.content });
	}
	return { ok: true, files };
}

export function formatPublishContext(input: { manifest?: { type?: string; publishTargets?: string[] }; local?: unknown; job?: { status?: string; failureCode?: string } } = {}): string {
	if (!isPublishPanelVisible(input.manifest)) {
		return '';
	}
	const targets = (input.manifest?.publishTargets || []).join(',') || 'none';
	const status = input.job && input.job.status ? input.job.status : 'idle';
	const failure = input.job && input.job.failureCode ? ` failure=${input.job.failureCode}` : '';
	return `Kuunda publishing: mobile targets=${targets} status=${status}${failure}`;
}

export function formatPublishPanel(input: { manifest?: { type?: string; publishTargets?: string[] }; local?: unknown; job?: { status?: string; failureCode?: string }; logs?: string[] } = {}): string {
	if (!isPublishPanelVisible(input.manifest)) {
		return 'Publishing is available for mobile projects.';
	}
	const parsed = parsePublishLocal(input.local);
	const lines = ['Kuunda Publishing'];
	const targets = Array.isArray(input.manifest?.publishTargets) ? input.manifest.publishTargets : [];
	lines.push(`targets: ${targets.length ? targets.join(', ') : 'none'}`);
	lines.push(`package: ${parsed.packageId || SECRET_PLACEHOLDER}`);
	lines.push(`version: ${parsed.version || SECRET_PLACEHOLDER}`);
	lines.push(`google_play: ${parsed.googlePlay.configured ? parsed.googlePlay.clientEmail || 'configured' : 'missing'}`);
	lines.push(`app_store: ${parsed.appStore.configured ? 'configured' : 'missing'}`);
	lines.push(`android_signature: ${parsed.signatureReady ? 'ready' : 'missing'}`);
	if (input.job && input.job.status) {
		lines.push(`job: ${input.job.status}${input.job.failureCode ? ` (${input.job.failureCode})` : ''}`);
	} else {
		lines.push('job: idle');
	}
	const rows = Array.isArray(input.logs) ? input.logs.map(redactPublishLog).filter(Boolean) : [];
	if (rows.length) {
		lines.push('logs:');
		for (const line of rows.slice(-20)) {
			lines.push(`- ${line}`);
		}
	}
	lines.push('Store listings for AI-generated apps must disclose AI use and the Kuunda Cloud SDK; IAP credits, if ever used, follow Play / App Store refund rules (docs/legal/STORE-REQUIREMENTS.md).');
	return lines.join('\n');
}
