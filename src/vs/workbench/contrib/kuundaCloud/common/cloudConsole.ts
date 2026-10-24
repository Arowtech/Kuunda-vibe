/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import { getNLSLanguage } from '../../../../nls.js';

/** Local pointer to the database created for the signed-in account. */
export const CLOUD_ACCOUNT_DATABASE_KEY = 'kuunda.cloud.accountDatabaseRef';
/** Idempotent platform id: one account database, retries do not allocate a second one. */
export const ACCOUNT_DATABASE_EXTERNAL_ID = 'account-database';

export type CloudConsoleFieldKind = 'text' | 'secret' | 'identifier' | 'url' | 'email' | 'sql';

/** OAuth providers the org key can configure. The secret is write-only. */
export const CLOUD_AUTH_PROVIDERS = ['google'] as const;

export type CloudOrgScope = 'git_tokens' | 'sites_domains';

export type CloudConsoleField = {
	key: string;
	kind: CloudConsoleFieldKind;
	label: { en: string; fr: string };
	max: number;
};

export type CloudConsoleSection = {
	id: string;
	group: 'product' | 'settings';
	/**
	 * Path under `/v1/projects/{ref}/`, served with the org key on the platform.
	 * The IDE never sends `kuunda_org_*` or `service_role`.
	 */
	read?: string;
	write?: { method: 'POST' | 'PUT'; path: string };
	/** Refused until the org key carries this scope. The IDE does not call the route. */
	scope?: CloudOrgScope;
	label: { en: string; fr: string };
	summary: { en: string; fr: string };
	fields: readonly CloudConsoleField[];
};

export type CloudConsoleRow = { label: string; value: string };

export type CloudConsoleSnapshot = {
	section: string;
	projectRef?: string;
	status: 'ready' | 'empty' | 'unavailable' | 'offline';
	rows: CloudConsoleRow[];
	notice?: string;
};

const SECRET_KEY = /anon[_-]?key|service[_-]?role|password|secret|credential|token|authorization|api[_-]?key/i;

export const CLOUD_CONSOLE_SECTIONS: readonly CloudConsoleSection[] = [
	{
		id: 'analytics',
		group: 'product',
		label: { en: 'Analytics', fr: 'Analytique' },
		summary: { en: 'Traffic and product events for this project.', fr: 'Trafic et événements produit de ce projet.' },
		fields: [],
	},
	{
		id: 'database',
		group: 'product',
		write: { method: 'POST', path: 'database/query' },
		label: { en: 'Database', fr: 'Base de données' },
		summary: {
			en: 'Runs SQL on this project through the org key. The call is logged and limited to 30 per minute. service_role never leaves the platform.',
			fr: 'Exécute le SQL de ce projet via la clé d’organisation. L’appel est journalisé et limité à 30 par minute. service_role ne quitte pas la plateforme.',
		},
		fields: [{ key: 'query', kind: 'sql', label: { en: 'SQL', fr: 'SQL' }, max: 4000 }],
	},
	{
		id: 'users',
		group: 'product',
		read: 'auth/users',
		write: { method: 'POST', path: 'auth/users' },
		label: { en: 'Users', fr: 'Utilisateurs' },
		summary: { en: 'List, create or invite users of this project.', fr: 'Liste, crée ou invite les utilisateurs de ce projet.' },
		fields: [
			{ key: 'email', kind: 'email', label: { en: 'Email', fr: 'E-mail' }, max: 180 },
			{ key: 'invite', kind: 'text', label: { en: 'Type invite to send an invite', fr: 'Écrire invite pour envoyer une invitation' }, max: 8 },
		],
	},
	{
		id: 'storage',
		group: 'product',
		read: 'storage/buckets',
		write: { method: 'POST', path: 'storage/buckets' },
		label: { en: 'Storage', fr: 'Stockage' },
		summary: { en: 'Buckets for this project. service_role stays inside the platform.', fr: 'Buckets de ce projet. service_role reste dans la plateforme.' },
		fields: [{ key: 'name', kind: 'identifier', label: { en: 'New bucket', fr: 'Nouveau bucket' }, max: 63 }],
	},
	{
		id: 'ai',
		group: 'product',
		label: { en: 'AI', fr: 'IA' },
		summary: { en: 'Not covered by the org key yet.', fr: 'Pas encore couvert par la clé d’organisation.' },
		fields: [],
	},
	{
		id: 'payments',
		group: 'product',
		label: { en: 'Payments', fr: 'Paiements' },
		summary: { en: 'Not covered by the org key yet.', fr: 'Pas encore couvert par la clé d’organisation.' },
		fields: [],
	},
	{
		id: 'emails',
		group: 'product',
		label: { en: 'Emails', fr: 'E-mails' },
		summary: { en: 'Not covered by the org key yet.', fr: 'Pas encore couvert par la clé d’organisation.' },
		fields: [],
	},
	{
		id: 'connectors',
		group: 'product',
		label: { en: 'Connectors', fr: 'Connecteurs' },
		summary: { en: 'Not covered by the org key yet.', fr: 'Pas encore couvert par la clé d’organisation.' },
		fields: [],
	},
	{
		id: 'security',
		group: 'product',
		label: { en: 'Security', fr: 'Sécurité' },
		summary: {
			en: 'Google. The secret is stored encrypted and is not shown again.',
			fr: 'Google. Le secret est stocké chiffré et n’est pas relu.',
		},
		fields: [
			{ key: 'provider', kind: 'text', label: { en: 'Provider (google)', fr: 'Fournisseur (google)' }, max: 16 },
			{ key: 'clientId', kind: 'text', label: { en: 'Client id', fr: 'Identifiant client' }, max: 200 },
			{ key: 'secret', kind: 'secret', label: { en: 'Secret', fr: 'Secret' }, max: 4096 },
		],
	},
	{
		id: 'seo',
		group: 'product',
		label: { en: 'SEO & AI search', fr: 'SEO et recherche IA' },
		summary: { en: 'Not covered by the org key yet.', fr: 'Pas encore couvert par la clé d’organisation.' },
		fields: [],
	},
	{
		id: 'usage',
		group: 'product',
		label: { en: 'Usage', fr: 'Usage' },
		summary: { en: 'Not covered by the org key yet.', fr: 'Pas encore couvert par la clé d’organisation.' },
		fields: [],
	},
	{
		id: 'settings.general',
		group: 'settings',
		label: { en: 'General', fr: 'Général' },
		summary: { en: 'Not covered by the org key yet.', fr: 'Pas encore couvert par la clé d’organisation.' },
		fields: [],
	},
	{
		id: 'settings.secrets',
		group: 'settings',
		label: { en: 'Secrets', fr: 'Secrets' },
		summary: { en: 'Not covered by the org key yet. Provider secrets are set under Security.', fr: 'Pas encore couvert par la clé d’organisation. Les secrets des fournisseurs se règlent dans Sécurité.' },
		fields: [],
	},
	{
		id: 'settings.logs',
		group: 'settings',
		label: { en: 'Logs', fr: 'Journaux' },
		summary: { en: 'SQL and functions are logged on the platform, not listed here yet.', fr: 'Le SQL et les fonctions sont journalisés sur la plateforme, pas encore listés ici.' },
		fields: [],
	},
	{
		id: 'settings.knowledge',
		group: 'settings',
		label: { en: 'Knowledge', fr: 'Connaissance' },
		summary: { en: 'Not covered by the org key yet.', fr: 'Pas encore couvert par la clé d’organisation.' },
		fields: [],
	},
	{
		id: 'settings.domains',
		group: 'settings',
		scope: 'sites_domains',
		label: { en: 'Domains', fr: 'Domaines' },
		summary: { en: 'Client domains stay closed until the org key carries sites_domains.', fr: 'Les domaines clients restent fermés tant que la clé d’organisation ne porte pas sites_domains.' },
		fields: [],
	},
	{
		id: 'settings.git',
		group: 'settings',
		scope: 'git_tokens',
		label: { en: 'Git', fr: 'Git' },
		summary: { en: 'Git tokens stay closed until the org key carries git_tokens.', fr: 'Les jetons Git restent fermés tant que la clé d’organisation ne porte pas git_tokens.' },
		fields: [],
	},
];

export function cloudConsoleSection(id: string): CloudConsoleSection | undefined {
	return CLOUD_CONSOLE_SECTIONS.find((section) => section.id === id);
}

export function cloudConsoleText(copy: { en: string; fr: string }): string {
	const lang = getNLSLanguage() || 'en';
	return lang.toLowerCase().startsWith('fr') ? copy.fr : copy.en;
}

export function sanitizeAccountDisplayName(value: unknown): string {
	const name = String(value || '').replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 80);
	return name || 'Account';
}

export function sanitizeConsoleInput(section: CloudConsoleSection, values: Record<string, unknown>): Record<string, string> | undefined {
	const out: Record<string, string> = {};
	for (const field of section.fields) {
		const raw = values[field.key];
		if (raw == null || String(raw).trim() === '') {
			continue;
		}
		const value = sanitizeField(field, raw);
		if (!value) {
			return undefined;
		}
		out[field.key] = value;
	}
	return Object.keys(out).length ? out : undefined;
}

function sanitizeField(field: CloudConsoleField, raw: unknown): string | undefined {
	const value = String(raw).replace(/[\u0000]/g, '').trim();
	if (!value || value.length > field.max) {
		return undefined;
	}
	if (field.kind === 'secret' || /kuunda_org_|service_role/i.test(value)) {
		if (field.kind !== 'secret' || /[\r\n]/.test(value) || /kuunda_org_|service_role|sk_live_|whsec_/i.test(value)) {
			return undefined;
		}
		return value;
	}
	if (field.kind === 'sql') {
		return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '');
	}
	const single = value.replace(/[\r\n]/g, ' ');
	if (field.kind === 'identifier') {
		return /^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(single) ? single : undefined;
	}
	if (field.kind === 'email') {
		return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(single) ? single : undefined;
	}
	if (field.kind === 'url') {
		return /^https:\/\/[a-z0-9.-]+\/[A-Za-z0-9._/-]+$/i.test(single) ? single : undefined;
	}
	return single;
}

export type CloudConsoleWrite = { method: 'POST' | 'PUT'; path: string; body: Record<string, string | boolean> };

/** Builds the org-key call. Returns undefined when the input cannot be sent. */
export function buildConsoleWrite(section: CloudConsoleSection, values: Record<string, unknown>): CloudConsoleWrite | undefined {
	if (section.scope || !section.write && section.id !== 'security') {
		return undefined;
	}
	const input = sanitizeConsoleInput(section, values);
	if (!input) {
		return undefined;
	}
	if (section.id === 'database') {
		return input.query ? { method: 'POST', path: 'database/query', body: { query: input.query } } : undefined;
	}
	if (section.id === 'users') {
		if (!input.email) {
			return undefined;
		}
		const body: Record<string, string | boolean> = { email: input.email };
		if (input.invite && /^(invite|true|oui)$/i.test(input.invite)) {
			body.invite = true;
		}
		return { method: 'POST', path: 'auth/users', body };
	}
	if (section.id === 'storage') {
		return input.name ? { method: 'POST', path: 'storage/buckets', body: { name: input.name } } : undefined;
	}
	if (section.id === 'security') {
		const provider = input.provider?.toLowerCase();
		if (!provider || !(CLOUD_AUTH_PROVIDERS as readonly string[]).includes(provider) || !input.secret) {
			return undefined;
		}
		const body: Record<string, string | boolean> = { secret: input.secret };
		if (input.clientId) {
			body.clientId = input.clientId;
		}
		return { method: 'PUT', path: `auth/providers/${provider}`, body };
	}
	if (!section.write) {
		return undefined;
	}
	return { method: section.write.method, path: section.write.path, body: input };
}

/** Same refusal for a missing route grant, another org, another env, or the console project. */
export function classifyConsoleStatus(status: number): 'ready' | 'rate_limited' | 'project_refused' | 'platform_route_pending' {
	if (status === 429) {
		return 'rate_limited';
	}
	if (status === 401 || status === 403 || status === 404) {
		return 'project_refused';
	}
	if (status >= 200 && status < 300) {
		return 'ready';
	}
	return 'platform_route_pending';
}

/** Operator material must never be attached by the IDE. */
export function isOperatorCredential(token: string | undefined): boolean {
	return /kuunda_org_|service_role/i.test(String(token || ''));
}

export function presentConsolePayload(payload: unknown): { rows: CloudConsoleRow[]; notice?: string } {
	if (!payload || typeof payload !== 'object') {
		return { rows: [] };
	}
	if (Array.isArray(payload)) {
		const rows: CloudConsoleRow[] = [];
		payload.slice(0, 40).forEach((item, index) => pushObjectRows(rows, item, String(index + 1)));
		return { rows: rows.slice(0, 80) };
	}
	const record = payload as Record<string, unknown>;
	const notice = typeof record.notice === 'string' ? presentPlain(record.notice, 240) : undefined;
	const rows: CloudConsoleRow[] = [];
	const items = Array.isArray(record.items) ? record.items
		: Array.isArray(record.tables) ? record.tables
			: Array.isArray(record.rows) ? record.rows
				: Array.isArray(record.users) ? record.users
					: Array.isArray(record.buckets) ? record.buckets
						: undefined;
	if (items) {
		items.slice(0, 40).forEach((item, index) => pushObjectRows(rows, item, String(index + 1)));
	} else {
		pushObjectRows(rows, record, '');
	}
	return { rows: rows.slice(0, 80), notice };
}

function pushObjectRows(rows: CloudConsoleRow[], item: unknown, prefix: string, depth = 0): void {
	if (!item || typeof item !== 'object' || Array.isArray(item) || depth > 2) {
		return;
	}
	for (const [key, value] of Object.entries(item as Record<string, unknown>)) {
		if (key === 'notice' || key === 'items' || key === 'tables' || key === 'rows') {
			continue;
		}
		const label = prefix ? `${prefix} · ${key}` : key;
		if (Array.isArray(value)) {
			value.slice(0, 20).forEach((item, index) => {
				if (item && typeof item === 'object') {
					pushObjectRows(rows, item, `${label} ${index + 1}`, depth + 1);
					return;
				}
				const shown = presentValue(key, item);
				if (shown) {
					rows.push({ label: `${label} ${index + 1}`, value: shown });
				}
			});
			continue;
		}
		if (value && typeof value === 'object') {
			pushObjectRows(rows, value, label, depth + 1);
			continue;
		}
		const shown = presentValue(key, value);
		if (!shown) {
			continue;
		}
		rows.push({ label, value: shown });
	}
}

function presentValue(key: string, value: unknown): string | undefined {
	if (typeof value === 'boolean') {
		return value ? 'true' : 'false';
	}
	if (typeof value === 'number' && Number.isFinite(value)) {
		return String(value);
	}
	if (typeof value !== 'string') {
		return undefined;
	}
	if (SECRET_KEY.test(key) || /kuunda_anon_|kuunda_org_|service_role|sk_|whsec_/i.test(value)) {
		return value.trim() ? 'configured' : undefined;
	}
	return presentPlain(value, 240);
}

function presentPlain(value: string, max: number): string | undefined {
	const text = value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/kuunda_org_[A-Za-z0-9_-]+/gi, 'configured').replace(/service_role/gi, 'configured').trim();
	return text ? text.slice(0, max) : undefined;
}
