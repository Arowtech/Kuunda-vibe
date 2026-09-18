/**
 * Phase 7 — mobile publishing policy (public kernel).
 * Store developer secrets stay gitignored or in kuunda-vibe-cloud CI. Never in project.json.
 */

import { SECRET_PLACEHOLDER, mergeGitignore } from './cloud-provision.js';
import { persistableIsSafe } from './credential-policy.js';

export const PUBLISH_TARGETS = ['google_play', 'app_store'];
export const PUBLISH_JOB_STATUSES = ['queued', 'running', 'succeeded', 'failed', 'pending_ci'];
export const PUBLISH_FAILURE_CODES = [
	'not_mobile',
	'no_targets',
	'incomplete_metadata',
	'missing_credentials',
	'missing_signature',
	'runner_unavailable',
];
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

export function isPublishPanelVisible(manifest) {
	return Boolean(manifest && manifest.type === 'mobile');
}

export function sanitizePackageId(value) {
	const id = String(value || '').trim();
	if (!/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*){1,8}$/i.test(id) || id.length > 128) {
		return '';
	}
	return id;
}

export function sanitizeAppVersion(value) {
	const version = String(value || '').trim();
	if (!/^\d+\.\d+\.\d+$/.test(version)) {
		return '';
	}
	return version;
}

export function parsePublishLocal(raw) {
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
	return {
		version: sanitizeAppVersion(data.version) || undefined,
		packageId: sanitizePackageId(data.packageId) || undefined,
		googlePlay: {
			configured: data.googlePlay?.configured === true,
			clientEmail: redactEmail(data.googlePlay?.clientEmail),
		},
		appStore: {
			configured: data.appStore?.configured === true,
			keyId: sanitizeAppleId(data.appStore?.keyId),
			issuerId: sanitizeAppleId(data.appStore?.issuerId),
		},
		signatureReady: data.signatureReady === true,
		lastJobId: sanitizeJobId(data.lastJobId) || undefined,
	};
}

function emptyPublishLocal() {
	return {
		googlePlay: { configured: false },
		appStore: { configured: false },
		signatureReady: false,
	};
}

function redactEmail(value) {
	const email = String(value || '').trim();
	if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 128) {
		return undefined;
	}
	return email;
}

function sanitizeAppleId(value) {
	const id = String(value || '').trim();
	if (!/^[A-Za-z0-9-]{4,64}$/.test(id)) {
		return undefined;
	}
	return id;
}

export function inspectPlayServiceAccount(raw) {
	let data = raw;
	if (typeof raw === 'string') {
		try {
			data = JSON.parse(raw);
		} catch {
			return { ok: false, error: 'invalid_play_json' };
		}
	}
	if (!data || typeof data !== 'object' || data.type !== 'service_account') {
		return { ok: false, error: 'invalid_play_json' };
	}
	const clientEmail = redactEmail(data.client_email);
	const privateKey = String(data.private_key || '');
	if (!clientEmail || !/BEGIN [A-Z ]*PRIVATE KEY/.test(privateKey) || privateKey.length < 80) {
		return { ok: false, error: 'invalid_play_json' };
	}
	return { ok: true, clientEmail, configured: true };
}

export function inspectAppStoreP8(raw) {
	const text = String(raw || '');
	if (!/BEGIN [A-Z ]*PRIVATE KEY/.test(text) || text.length < 80 || text.length > 16_000) {
		return { ok: false, error: 'invalid_p8' };
	}
	return { ok: true, configured: true };
}

export function inspectAppStoreIds({ keyId, issuerId } = {}) {
	const kid = sanitizeAppleId(keyId);
	const iss = sanitizeAppleId(issuerId);
	if (!kid || !iss) {
		return { ok: false, error: 'invalid_store_ids' };
	}
	return { ok: true, keyId: kid, issuerId: iss };
}

export function verifyPublishFiles({ publishTargets = [], files = {} } = {}) {
	const targets = (Array.isArray(publishTargets) ? publishTargets : []).filter((item) => PUBLISH_TARGETS.includes(item));
	if (targets.includes('google_play') && files.playJson !== true) {
		return { ok: false, error: 'missing_credentials', target: 'google_play' };
	}
	if (targets.includes('app_store') && files.appStoreKey !== true) {
		return { ok: false, error: 'missing_credentials', target: 'app_store' };
	}
	if (targets.includes('google_play') && files.keystore !== true) {
		return { ok: false, error: 'missing_signature' };
	}
	return { ok: true };
}

export function sanitizePublishError(error) {
	const code = String(error || '').trim();
	const allowed = new Set([
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

export function inspectKeystore(size) {
	const n = Number(size);
	if (!Number.isFinite(n) || n < 32 || n > 10_000_000) {
		return { ok: false, error: 'invalid_keystore' };
	}
	return { ok: true, signatureReady: true };
}

export function sanitizeJobId(value) {
	const id = String(value || '').trim();
	if (!/^job_[a-z0-9]+$/i.test(id) || id.length > 64) {
		return '';
	}
	return id;
}

export function sanitizeUserRef(value) {
	const id = String(value || '').trim();
	if (!id || id.length > 128) {
		return '';
	}
	return id;
}

export function publicPublishJob(job) {
	if (!job || typeof job !== 'object') {
		return undefined;
	}
	const id = sanitizeJobId(job.id);
	const status = PUBLISH_JOB_STATUSES.includes(job.status) ? job.status : undefined;
	if (!id || !status) {
		return undefined;
	}
	const targets = (Array.isArray(job.targets) ? job.targets : []).filter((item) => PUBLISH_TARGETS.includes(item));
	const failureCode = PUBLISH_FAILURE_CODES.includes(job.failureCode) ? job.failureCode : undefined;
	return redactPublishPayload({
		id,
		status,
		targets,
		version: sanitizeAppVersion(job.version) || undefined,
		packageId: sanitizePackageId(job.packageId) || undefined,
		failureCode,
	});
}

export function buildPublishRequest({ userId, decision, credentials = {}, signatureReady = false } = {}) {
	const uid = sanitizeUserRef(userId);
	if (!uid) {
		return { ok: false, error: 'missing_user' };
	}
	if (!decision || decision.ok !== true) {
		return decision && decision.error ? decision : { ok: false, error: 'incomplete_metadata' };
	}
	return {
		ok: true,
		body: {
			userId: uid,
			targets: decision.targets,
			version: decision.metadata.version,
			packageId: decision.metadata.packageId,
			googlePlayConfigured: credentials.googlePlay === true,
			appStoreConfigured: credentials.appStore === true,
			signatureReady: signatureReady === true,
		},
	};
}

export function persistablePublishLocal(local) {
	const parsed = parsePublishLocal(local);
	const payload = {
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
		payload.googlePlay = { configured: payload.googlePlay.configured === true };
		payload.appStore = { configured: payload.appStore.configured === true };
		delete payload.lastJobId;
	}
	return `${JSON.stringify(payload, null, '\t')}\n`;
}

export function validatePublishMetadata({ version, packageId } = {}) {
	const safeVersion = sanitizeAppVersion(version);
	const safeId = sanitizePackageId(packageId);
	if (!safeVersion || !safeId) {
		return { ok: false, error: 'incomplete_metadata' };
	}
	return { ok: true, version: safeVersion, packageId: safeId };
}

export function decidePublish({
	type,
	publishTargets = [],
	credentials = {},
	metadata = {},
	signatureReady = false,
} = {}) {
	if (type !== 'mobile') {
		return { ok: false, error: 'not_mobile' };
	}
	const targets = (Array.isArray(publishTargets) ? publishTargets : []).filter((item) => PUBLISH_TARGETS.includes(item));
	if (!targets.length) {
		return { ok: false, error: 'no_targets' };
	}
	const meta = validatePublishMetadata(metadata);
	if (!meta.ok) {
		return meta;
	}
	if (targets.includes('google_play') && credentials.googlePlay !== true) {
		return { ok: false, error: 'missing_credentials', target: 'google_play' };
	}
	if (targets.includes('app_store') && credentials.appStore !== true) {
		return { ok: false, error: 'missing_credentials', target: 'app_store' };
	}
	if (targets.includes('google_play') && signatureReady !== true) {
		return { ok: false, error: 'missing_signature' };
	}
	return {
		ok: true,
		action: 'enqueue',
		targets,
		metadata: { version: meta.version, packageId: meta.packageId },
	};
}

export function redactPublishPayload(payload) {
	if (payload == null || typeof payload !== 'object') {
		return payload;
	}
	const out = Array.isArray(payload) ? [] : {};
	for (const [key, value] of Object.entries(payload)) {
		if (SECRET_KEY.test(key) || (typeof value === 'string' && SECRET_VALUE.test(value))) {
			continue;
		}
		if (value && typeof value === 'object') {
			out[key] = redactPublishPayload(value);
		} else {
			out[key] = value;
		}
	}
	return out;
}

export function redactPublishLog(line) {
	const text = String(line || '').replace(/\r/g, '');
	if (SECRET_KEY.test(text) || SECRET_VALUE.test(text) || /private[_-]?key|PLAY_SERVICE_ACCOUNT|APP_STORE_CONNECT/i.test(text)) {
		return '[redacted]';
	}
	return text.slice(0, 500);
}

export function githubWorkflowSource() {
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

export function scaffoldPublishFiles({ existingGitignore = '' } = {}) {
	const gitignore = mergeGitignore(existingGitignore, PUBLISH_GITIGNORE_ENTRIES);
	const files = [
		{ path: PUBLISH_WORKFLOW_PATH, content: githubWorkflowSource() },
		{ path: PUBLISH_LOCAL_PATH, content: persistablePublishLocal(emptyPublishLocal()), gitignored: true },
	];
	if (gitignore.changed) {
		files.push({ path: '.gitignore', content: gitignore.content });
	}
	return { ok: true, files };
}

export function formatPublishContext({ manifest, local, job } = {}) {
	if (!isPublishPanelVisible(manifest)) {
		return '';
	}
	const targets = (manifest.publishTargets || []).join(',') || 'none';
	const status = job && job.status ? job.status : 'idle';
	const failure = job && job.failureCode ? ` failure=${job.failureCode}` : '';
	return `Kuunda publishing: mobile targets=${targets} status=${status}${failure}`;
}

export function formatPublishPanel({ manifest, local, job, logs } = {}) {
	if (!isPublishPanelVisible(manifest)) {
		return 'Publishing is available for mobile projects.';
	}
	const parsed = parsePublishLocal(local);
	const lines = ['Kuunda Publishing'];
	const targets = Array.isArray(manifest.publishTargets) ? manifest.publishTargets : [];
	lines.push(`targets: ${targets.length ? targets.join(', ') : 'none'}`);
	lines.push(`package: ${parsed.packageId || SECRET_PLACEHOLDER}`);
	lines.push(`version: ${parsed.version || SECRET_PLACEHOLDER}`);
	lines.push(`google_play: ${parsed.googlePlay.configured ? parsed.googlePlay.clientEmail || 'configured' : 'missing'}`);
	lines.push(`app_store: ${parsed.appStore.configured ? 'configured' : 'missing'}`);
	lines.push(`android_signature: ${parsed.signatureReady ? 'ready' : 'missing'}`);
	if (job && job.status) {
		lines.push(`job: ${job.status}${job.failureCode ? ` (${job.failureCode})` : ''}`);
	} else {
		lines.push('job: idle');
	}
	const rows = Array.isArray(logs) ? logs.map(redactPublishLog).filter(Boolean) : [];
	if (rows.length) {
		lines.push('logs:');
		for (const line of rows.slice(-20)) {
			lines.push(`- ${line}`);
		}
	}
	lines.push('Store listings for AI-generated apps must disclose AI use and the Kuunda Cloud SDK; IAP credits, if ever used, follow Play / App Store refund rules (docs/legal/STORE-REQUIREMENTS.md).');
	return lines.join('\n');
}

export { SECRET_PLACEHOLDER };
