/**
 * Phase 10 — post-launch iteration.
 * Opt-in structured feedback only. No silent usage telemetry. No auto-rebase.
 */

import { decideExternalSend } from './legal-policy.js';
import { looksLikeSecret } from './credential-policy.js';

export const FEEDBACK_CHANNEL = 'structured';
export const FEEDBACK_PATH = '/v1/feedback';
export const FEEDBACK_CATEGORIES = Object.freeze(['bug', 'crash', 'feature', 'docs']);
export const USAGE_TELEMETRY_DEFAULT = false;
export const MAX_FEEDBACK_TITLE = 120;
export const MAX_FEEDBACK_BODY = 4000;
export const UPSTREAM_VSCODE = 'microsoft/vscode';
export const UPSTREAM_VOID = 'voideditor/void';
export const REBASE_CADENCE_DAYS = 30;
export const DEPENDABOT_INTERVAL = 'weekly';
export const FEEDBACK_QUALITIES = Object.freeze(['internal', 'staging']);
export const MAX_FEEDBACK_TICKETS = 200;
export const MAX_FEEDBACK_LINES = 60;

const SEVERITY_WEIGHT = { 1: 1, 2: 2, 3: 4 };
const CATEGORY_WEIGHT = { crash: 100, bug: 40, feature: 15, docs: 5 };
const FEEDBACK_SECRET = /BEGIN [A-Z ]+PRIVATE KEY|sk_live_|sk_sandbox_|pk_live_|pk_sandbox_|sk-ant-|sk-proj-|whsec_|ghp_|github_pat_|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|service_role|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\./;

export function isTruthyFlag(value) {
	return value === true || value === 1 || value === '1' || value === 'true';
}

export function looksLikeFeedbackSecret(value) {
	if (looksLikeSecret(value)) {
		return true;
	}
	return typeof value === 'string' && FEEDBACK_SECRET.test(value);
}

export function looksLikeWorkspaceDump(value) {
	const text = String(value || '');
	if ((text.match(/\n/g) || []).length > MAX_FEEDBACK_LINES) {
		return true;
	}
	if (/\.kuunda\/|credentials\.json|\.p8\b|play-service-account|\.keystore\b|authkey\.p8/i.test(text)) {
		return true;
	}
	return false;
}

export function isAllowedFeedbackOrigin(origin) {
	if (!origin || origin === 'null') {
		return true;
	}
	if (/^vscode-(file|webview|app):/i.test(origin)) {
		return true;
	}
	try {
		const parsed = new URL(origin);
		return parsed.protocol === 'https:' && (
			parsed.hostname === 'ide.kuunda-cloud.com'
			|| parsed.hostname === 'app.ide.kuunda-cloud.com'
		);
	} catch {
		return false;
	}
}

function scrubText(value, max) {
	return String(value || '').replace(/\0/g, '').trim().slice(0, max);
}

export function decideFeedbackSend(input = {}) {
	if (isTruthyFlag(input.includeWorkspace)) {
		return { ok: false, error: 'workspace_forbidden' };
	}
	if (input.consent !== true) {
		return { ok: false, error: 'consent_required' };
	}
	if (USAGE_TELEMETRY_DEFAULT === true || isTruthyFlag(input.telemetry)) {
		return { ok: false, error: 'telemetry_forbidden' };
	}
	const ext = decideExternalSend({ strictOffline: input.strictOffline, feature: 'feedback' });
	if (!ext.ok) {
		return ext;
	}
	return { ok: true, channel: FEEDBACK_CHANNEL, telemetry: false };
}

export function recordUsageSignal() {
	return { ok: false, error: 'silent_telemetry_forbidden', telemetry: USAGE_TELEMETRY_DEFAULT };
}

export function sanitizeFeedbackPayload(input = {}) {
	const category = FEEDBACK_CATEGORIES.includes(input.category) ? input.category : '';
	const severity = Number.parseInt(input.severity, 10);
	const title = scrubText(input.title, MAX_FEEDBACK_TITLE);
	const body = scrubText(input.body, MAX_FEEDBACK_BODY);
	if (!category || !title || title.length < 3) {
		return { ok: false, error: 'invalid_feedback' };
	}
	if (![1, 2, 3].includes(severity)) {
		return { ok: false, error: 'invalid_severity' };
	}
	if (looksLikeFeedbackSecret(title) || looksLikeFeedbackSecret(body) || looksLikeWorkspaceDump(body) || looksLikeWorkspaceDump(title)) {
		return { ok: false, error: 'secret_in_payload' };
	}
	const send = decideFeedbackSend(input);
	if (!send.ok) {
		return send;
	}
	const quality = FEEDBACK_QUALITIES.includes(input.quality) ? input.quality : 'internal';
	return {
		ok: true,
		payload: {
			category,
			severity,
			title,
			body,
			quality,
			version: String(input.version || '').slice(0, 64),
			platform: String(input.platform || '').slice(0, 32),
			commit: String(input.commit || '').slice(0, 40),
			consent: true,
			includeWorkspace: false,
			telemetry: false,
		},
	};
}

export function scoreBacklogItem(item = {}) {
	const category = FEEDBACK_CATEGORIES.includes(item.category) ? item.category : 'docs';
	const reports = Math.max(1, Number(item.reportCount) || 1);
	const severity = SEVERITY_WEIGHT[item.severity] || 1;
	const blocked = item.blocked === true ? 50 : 0;
	return CATEGORY_WEIGHT[category] * reports * severity + blocked;
}

export function prioritizeBacklog(items = []) {
	const rows = Array.isArray(items) ? items.map((item, index) => ({
		...item,
		score: scoreBacklogItem(item),
		index,
	})) : [];
	rows.sort((a, b) => b.score - a.score || a.index - b.index);
	return rows.map(({ index, ...row }) => row);
}

export function decideUpstreamSync(input = {}) {
	if (input.forcePush === true) {
		return { ok: false, error: 'force_push_forbidden', runRebase: false };
	}
	if (input.autoRebase === true) {
		return { ok: false, error: 'auto_rebase_forbidden', runRebase: false };
	}
	const days = Number(input.daysSinceSync);
	const due = Number.isFinite(days) && days >= REBASE_CADENCE_DAYS && days < 36500;
	return {
		ok: true,
		due,
		cadenceDays: REBASE_CADENCE_DAYS,
		autoRebase: false,
		runRebase: false,
		vscode: UPSTREAM_VSCODE,
		voidUpstream: UPSTREAM_VOID,
	};
}

export function planUpstreamSync(input = {}) {
	const sync = decideUpstreamSync(input);
	return {
		...sync,
		dependabot: DEPENDABOT_INTERVAL,
		compileElectron: false,
		wranglerDeploy: false,
		publicRelease: false,
	};
}

export function formatFeedbackError(locale = 'en', error = 'invalid_feedback') {
	const fr = locale === 'fr' || (typeof locale === 'string' && locale.startsWith('fr'));
	const map = {
		consent_required: fr
			? 'Le rapport n’est envoyé qu’avec votre consentement explicite. Aucun fichier du workspace n’est joint.'
			: 'Feedback is sent only with your explicit consent. Workspace files are never attached.',
		strict_offline: fr
			? 'Mode hors ligne strict : le canal de feedback est coupé.'
			: 'Strict offline mode: the feedback channel is off.',
		secret_in_payload: fr
			? 'Le rapport a l’air de contenir un secret. Rien n’a été envoyé.'
			: 'The report looks like it contains a secret. Nothing was sent.',
		workspace_forbidden: fr
			? 'Joindre le workspace est interdit.'
			: 'Attaching the workspace is not allowed.',
		silent_telemetry_forbidden: fr
			? 'Aucune télémétrie d’usage silencieuse.'
			: 'Silent usage telemetry is not allowed.',
		telemetry_forbidden: fr
			? 'La télémétrie d’usage n’est pas activée.'
			: 'Usage telemetry is not enabled.',
	};
	return map[error] || (fr
		? 'Rapport refusé. Vérifiez le titre, la catégorie et la gravité.'
		: 'Feedback rejected. Check the title, category and severity.');
}
