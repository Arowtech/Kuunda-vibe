/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import { looksLikeSecret } from '../../kuundaAi/common/credentialPolicy.js';
import { decideExternalSend } from '../../kuundaLegal/common/legalPolicy.js';

export const FEEDBACK_CHANNEL = 'structured';
export const FEEDBACK_PATH = '/v1/feedback';
export const FEEDBACK_CATEGORIES = ['bug', 'crash', 'feature', 'docs'] as const;
export const FEEDBACK_QUALITIES = ['internal', 'staging'] as const;
export const USAGE_TELEMETRY_DEFAULT = false;
export const MAX_FEEDBACK_TITLE = 120;
export const MAX_FEEDBACK_BODY = 4000;
export const MAX_FEEDBACK_LINES = 60;

const SEVERITY_WEIGHT: Record<number, number> = { 1: 1, 2: 2, 3: 4 };
const CATEGORY_WEIGHT: Record<string, number> = { crash: 100, bug: 40, feature: 15, docs: 5 };
const FEEDBACK_SECRET = /BEGIN [A-Z ]+PRIVATE KEY|sk_live_|sk_sandbox_|pk_live_|pk_sandbox_|sk-ant-|sk-proj-|whsec_|ghp_|github_pat_|AKIA[0-9A-Z]{16}|AIza[0-9A-Za-z_-]{20,}|service_role|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\./;

export type FeedbackCategory = typeof FEEDBACK_CATEGORIES[number];

export type FeedbackReceipt = {
	id: string;
	category: FeedbackCategory;
	severity: number;
	title: string;
	reportCount?: number;
	blocked?: boolean;
};

export function isTruthyFlag(value: unknown): boolean {
	return value === true || value === 1 || value === '1' || value === 'true';
}

export function looksLikeFeedbackSecret(value: unknown): boolean {
	if (looksLikeSecret(value)) {
		return true;
	}
	return typeof value === 'string' && FEEDBACK_SECRET.test(value);
}

export function looksLikeWorkspaceDump(value: unknown): boolean {
	const text = String(value || '');
	if ((text.match(/\n/g) || []).length > MAX_FEEDBACK_LINES) {
		return true;
	}
	if (/\.kuunda\/|credentials\.json|\.p8\b|play-service-account|\.keystore\b|authkey\.p8/i.test(text)) {
		return true;
	}
	return false;
}

function scrubText(value: unknown, max: number): string {
	return String(value || '').replace(/\0/g, '').trim().slice(0, max);
}

export function decideFeedbackSend(input: {
	strictOffline?: boolean;
	consent?: boolean;
	includeWorkspace?: unknown;
	telemetry?: unknown;
} = {}) {
	if (isTruthyFlag(input.includeWorkspace)) {
		return { ok: false as const, error: 'workspace_forbidden' };
	}
	if (input.consent !== true) {
		return { ok: false as const, error: 'consent_required' };
	}
	if (USAGE_TELEMETRY_DEFAULT || isTruthyFlag(input.telemetry)) {
		return { ok: false as const, error: 'telemetry_forbidden' };
	}
	const ext = decideExternalSend({ strictOffline: input.strictOffline, feature: 'feedback' });
	if (!ext.ok) {
		return ext;
	}
	return { ok: true as const, channel: FEEDBACK_CHANNEL, telemetry: false as const };
}

export function recordUsageSignal() {
	return { ok: false as const, error: 'silent_telemetry_forbidden', telemetry: USAGE_TELEMETRY_DEFAULT };
}

export function sanitizeFeedbackPayload(input: {
	category?: string;
	severity?: number | string;
	title?: string;
	body?: string;
	quality?: string;
	version?: string;
	platform?: string;
	commit?: string;
	consent?: boolean;
	includeWorkspace?: unknown;
	telemetry?: unknown;
	strictOffline?: boolean;
} = {}) {
	const category = (FEEDBACK_CATEGORIES as readonly string[]).includes(String(input.category || ''))
		? input.category as FeedbackCategory
		: '';
	const severity = Number.parseInt(String(input.severity), 10);
	const title = scrubText(input.title, MAX_FEEDBACK_TITLE);
	const body = scrubText(input.body, MAX_FEEDBACK_BODY);
	if (!category || !title || title.length < 3) {
		return { ok: false as const, error: 'invalid_feedback' };
	}
	if (![1, 2, 3].includes(severity)) {
		return { ok: false as const, error: 'invalid_severity' };
	}
	if (looksLikeFeedbackSecret(title) || looksLikeFeedbackSecret(body) || looksLikeWorkspaceDump(body) || looksLikeWorkspaceDump(title)) {
		return { ok: false as const, error: 'secret_in_payload' };
	}
	const send = decideFeedbackSend(input);
	if (!send.ok) {
		return send;
	}
	const quality = (FEEDBACK_QUALITIES as readonly string[]).includes(String(input.quality || '')) ? String(input.quality) : 'internal';
	return {
		ok: true as const,
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

export function scoreBacklogItem(item: FeedbackReceipt): number {
	const category = (FEEDBACK_CATEGORIES as readonly string[]).includes(item.category) ? item.category : 'docs';
	const reports = Math.max(1, Number(item.reportCount) || 1);
	const severity = SEVERITY_WEIGHT[item.severity] || 1;
	const blocked = item.blocked === true ? 50 : 0;
	return (CATEGORY_WEIGHT[category] || 5) * reports * severity + blocked;
}

export function prioritizeBacklog(items: FeedbackReceipt[] = []): Array<FeedbackReceipt & { score: number }> {
	return items
		.map((item, index) => ({ ...item, score: scoreBacklogItem(item), index }))
		.sort((a, b) => b.score - a.score || a.index - b.index)
		.map(({ index: _index, ...row }) => row);
}

export function formatFeedbackError(locale = 'en', error = 'invalid_feedback'): string {
	const fr = locale === 'fr' || locale.startsWith('fr');
	if (error === 'consent_required') {
		return fr
			? 'Le rapport n’est envoyé qu’avec votre consentement explicite. Aucun fichier du workspace n’est joint.'
			: 'Feedback is sent only with your explicit consent. Workspace files are never attached.';
	}
	if (error === 'strict_offline') {
		return fr ? 'Mode hors ligne strict : le canal de feedback est coupé.' : 'Strict offline mode: the feedback channel is off.';
	}
	if (error === 'secret_in_payload') {
		return fr ? 'Le rapport a l’air de contenir un secret. Rien n’a été envoyé.' : 'The report looks like it contains a secret. Nothing was sent.';
	}
	if (error === 'workspace_forbidden') {
		return fr ? 'Joindre le workspace est interdit.' : 'Attaching the workspace is not allowed.';
	}
	if (error === 'silent_telemetry_forbidden') {
		return fr ? 'Aucune télémétrie d’usage silencieuse.' : 'Silent usage telemetry is not allowed.';
	}
	if (error === 'telemetry_forbidden') {
		return fr ? 'La télémétrie d’usage n’est pas activée.' : 'Usage telemetry is not enabled.';
	}
	return fr
		? 'Rapport refusé. Vérifiez le titre, la catégorie et la gravité.'
		: 'Feedback rejected. Check the title, category and severity.';
}
