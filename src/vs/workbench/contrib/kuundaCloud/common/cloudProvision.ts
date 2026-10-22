/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

export const CLOUD_ENABLED_DEFAULT = true;
export const CLOUD_ENV_PATH = '.env.local';
export const CLOUD_LOCAL_PATH = '.kuunda/cloud.local.json';
export const CLOUD_CLIENT_PATH = 'src/kuunda/client.js';
export const SECRET_PLACEHOLDER = '<SET VIA SECRET STORE>';
export const CLOUD_GITIGNORE_ENTRIES = ['.env.local', '.kuunda/cloud.local.json'];
export const SEED_TABLE = 'items';
export const DEFAULT_API_BASE_URL = 'https://api.ide.kuunda-cloud.com';
/** Every project starts on the standard Cloud plan; upgrades happen in IDE settings. */
export const DEFAULT_CLOUD_PLAN = 'standard';
/**
 * The main Kuunda Vibe account id lives here: one account per installation, created
 * automatically, with no Kuunda Cloud signup and no web account ever required.
 * Every project of the install is centralised under this single account.
 */
export const CLOUD_ACCOUNT_STORAGE_KEY = 'kuunda.cloud.accountId';
/** Prefix of an auto-created account id (kuunda vibe account). */
export const CLOUD_ACCOUNT_PREFIX = 'kva_';
/**
 * Route mode of the transitioning platform API. `auto` tries the spec routes
 * (`/v1/accounts/{accountId}/…`) and falls back to the legacy routes; `off` never
 * calls a legacy route, so a spec route that is missing surfaces as a real error.
 * Set from the IDE setting `kuunda.cloud.legacyRoutes`.
 */
export type CloudRouteMode = 'auto' | 'off';

export function sanitizeRouteMode(value: unknown): CloudRouteMode {
	return String(value || '').trim().toLowerCase() === 'off' ? 'off' : 'auto';
}

/** One platform route family: the spec route we want, and the legacy route to delete. */
export type CloudRouteFamily = { family: string; spec: string; legacy: string };

/**
 * Every route family the client calls. The report counts how each one is served, so
 * the fallback is removed on evidence (`spec > 0` and `legacy === 0` for every family)
 * instead of on hope.
 */
export const ROUTE_FAMILIES: readonly CloudRouteFamily[] = [
	{ family: 'projects.create', spec: 'POST /v1/accounts/{accountId}/projects', legacy: 'POST /v1/provisioning/projects' },
	{ family: 'projects.list', spec: 'GET /v1/accounts/{accountId}/projects', legacy: 'GET /v1/account/projects?accountId={accountId}' },
	{ family: 'project.archive', spec: 'POST /v1/accounts/{accountId}/projects/{ref}/archive', legacy: 'POST /v1/account/projects/{ref}/archive' },
	{ family: 'project.restore', spec: 'POST /v1/accounts/{accountId}/projects/{ref}/restore', legacy: 'POST /v1/account/projects/{ref}/restore' },
	{ family: 'project.plan', spec: 'PUT /v1/accounts/{accountId}/projects/{ref}/plan', legacy: 'POST /v1/provisioning/projects/{ref}/plan' },
	{ family: 'project.tables', spec: 'GET /v1/accounts/{accountId}/projects/{ref}/tables', legacy: 'GET /v1/provisioning/projects/{ref}/tables' },
	{ family: 'plans', spec: 'GET /v1/plans', legacy: 'GET /v1/provisioning/plans' },
	{ family: 'link.start', spec: 'POST /v1/accounts/{accountId}/link/start', legacy: 'POST /v1/account/link/start' },
	{ family: 'link.claim', spec: 'POST /v1/accounts/link/claim', legacy: 'POST /v1/account/link/claim' },
];

/** One counted route family: how it answered, and on which route. */
export type CloudRouteFamilyReport = {
	family: string;
	specPath: string;
	legacyPath: string;
	/** Calls answered by the spec route. */
	spec: number;
	/** Calls answered by the legacy route. */
	legacy: number;
	/** Route that answered last, if this family was used at all. */
	lastRoute?: 'spec' | 'legacy';
};

export type CloudRouteReport = {
	mode: CloudRouteMode;
	generatedAt: number;
	/** When the first evidence was counted for this profile, if any. */
	since?: number;
	/** Calls answered by the spec route across every family. */
	spec: number;
	/** Calls answered by the legacy route across every family. */
	legacy: number;
	families: CloudRouteFamilyReport[];
	/** Every family has spec evidence and none of them needed the legacy route. */
	legacyRemovable: boolean;
};

/** Non-negative integer, or 0 for anything a platform could send back. */
function callCount(value: unknown): number {
	return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

const SECRET_KEY = /anon[_-]?key|service[_-]?role|operator|password|secret|credential|token|authorization|api[_-]?key/i;
const OWNER_ID_PATTERN = /^[A-Za-z0-9_-]{8,96}$/;
const PLAN_ID_PATTERN = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const LINK_CODE_PATTERN = /^[A-Z0-9]{4}(?:-[A-Z0-9]{4}){0,3}$/;
const REPO_URL_PATTERN = /^https:\/\/[a-z0-9.-]+\/[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+$/i;

export type CloudEnv = 'sandbox' | 'production';

export type CloudRecord = {
	enabled: boolean;
	projectRef?: string;
	env?: CloudEnv;
	url?: string;
	plan?: string;
	/** Where the source lives, so another machine can re-clone this project. */
	repo?: string;
};

export type CloudTable = { name: string; rowCount?: number };

/** `pending_user` now only means "no owner identity could be resolved" — never "sign up first". */
export type CloudDecision =
	| { ok: true; action: 'skip' | 'reuse' | 'pending_user' | 'pending_api' | 'provision'; enabled: boolean };

export type CloudFile = { path: string; content: string; gitignored?: boolean };

export function parseCloudSettings(raw: unknown): CloudRecord {
	let data = raw;
	if (typeof raw === 'string') {
		try {
			data = JSON.parse(raw);
		} catch {
			return { enabled: CLOUD_ENABLED_DEFAULT };
		}
	}
	const record = data && typeof data === 'object' && !Array.isArray(data) ? data as { cloud?: unknown } : undefined;
	const cloud = record && record.cloud && typeof record.cloud === 'object' && !Array.isArray(record.cloud)
		? record.cloud as { enabled?: unknown; projectRef?: unknown; env?: unknown; url?: unknown; plan?: unknown; repo?: unknown }
		: (data && typeof data === 'object' && !Array.isArray(data) && 'enabled' in (data as object)
			? data as { enabled?: unknown; projectRef?: unknown; env?: unknown; url?: unknown; plan?: unknown; repo?: unknown }
			: undefined);
	if (!cloud) {
		return { enabled: CLOUD_ENABLED_DEFAULT, plan: DEFAULT_CLOUD_PLAN };
	}
	const enabled = cloud.enabled !== false;
	const projectRef = sanitizeProjectRef(cloud.projectRef);
	const env: CloudEnv | undefined = cloud.env === 'production' ? 'production' : cloud.env === 'sandbox' ? 'sandbox' : undefined;
	const url = sanitizeCloudUrl(typeof cloud.url === 'string' ? cloud.url : undefined);
	const plan = sanitizePlanId(cloud.plan);
	const repo = sanitizeRepoUrl(cloud.repo);
	return { enabled, projectRef, env, url, plan, repo };
}

export function sanitizeOwnerId(value: unknown): string | undefined {
	const ownerId = String(value || '').trim();
	if (!OWNER_ID_PATTERN.test(ownerId)) {
		return undefined;
	}
	return ownerId;
}

export function sanitizePlanId(value: unknown): string {
	const planId = String(value || '').trim().toLowerCase();
	return PLAN_ID_PATTERN.test(planId) ? planId : DEFAULT_CLOUD_PLAN;
}

/** Short human code used to adopt the same account on another machine. */
export function sanitizeLinkCode(value: unknown): string | undefined {
	const code = String(value || '').trim().toUpperCase();
	return LINK_CODE_PATTERN.test(code) ? code : undefined;
}

/** Normalised, https-only repository url (never a token, never ssh). */
export function sanitizeRepoUrl(value: unknown): string | undefined {
	const url = String(value || '').trim().replace(/\.git$/, '');
	if (!REPO_URL_PATTERN.test(url) || url.length > 220) {
		return undefined;
	}
	return url;
}

/**
 * Extracts the `origin` remote from a `.git/config` so the project record can
 * carry the source location — the only way code is "synced" (via git, not us).
 */
export function parseGitRemote(configText: string | undefined): string | undefined {
	const text = String(configText || '');
	const origin = /\[remote "origin"\]([\s\S]*?)(?:\r?\n\[|$)/.exec(text);
	const scope = origin ? origin[1] : text;
	const match = /url\s*=\s*([^\r\n]+)/i.exec(scope);
	if (!match) {
		return undefined;
	}
	let url = match[1].trim();
	const ssh = /^git@([A-Za-z0-9.-]+):(.+)$/.exec(url);
	if (ssh) {
		url = `https://${ssh[1]}/${ssh[2]}`;
	}
	return sanitizeRepoUrl(url);
}

export function sanitizeProjectRef(value: unknown): string | undefined {
	const ref = String(value || '').trim();
	if (!/^proj_[a-z0-9]+$/i.test(ref) || ref.length > 64) {
		return undefined;
	}
	return ref;
}

export function sanitizeCloudUrl(url: string | undefined): string | undefined {
	const value = String(url || '').trim();
	if (!value) {
		return undefined;
	}
	if (!/^https:\/\/[a-z0-9.-]+\.kuunda-cloud\.com\/?$/i.test(value)) {
		return undefined;
	}
	return value.replace(/\/$/, '');
}

export function redactCloudPayload(payload: unknown): unknown {
	if (payload == null || typeof payload !== 'object') {
		return payload;
	}
	const out: Record<string, unknown> | unknown[] = Array.isArray(payload) ? [] : {};
	for (const [key, value] of Object.entries(payload as Record<string, unknown>)) {
		if (SECRET_KEY.test(key) || (typeof value === 'string' && SECRET_KEY.test(value))) {
			continue;
		}
		if (typeof value === 'string' && /kuunda_anon_|service_role|sk_|whsec_/i.test(value)) {
			continue;
		}
		if (value && typeof value === 'object') {
			(out as Record<string, unknown>)[key] = redactCloudPayload(value);
		} else {
			(out as Record<string, unknown>)[key] = value;
		}
	}
	return out;
}

/**
 * Cloud provisioning never requires a Kuunda Cloud signup: the IDE resolves an
 * owner identity (signed-in user, otherwise the anonymous install id) and the
 * platform creates a per-project space on the standard plan automatically.
 */
export function decideCloudProvisioning(input: {
	enabled?: boolean;
	ownerId?: string;
	alreadyProvisioned?: boolean;
	apiOk?: boolean;
} = {}): CloudDecision {
	if (input.enabled === false) {
		return { ok: true, action: 'skip', enabled: false };
	}
	if (input.alreadyProvisioned) {
		return { ok: true, action: 'reuse', enabled: true };
	}
	if (!sanitizeOwnerId(input.ownerId)) {
		return { ok: true, action: 'pending_user', enabled: true };
	}
	if (input.apiOk === false) {
		return { ok: true, action: 'pending_api', enabled: true };
	}
	return { ok: true, action: 'provision', enabled: true };
}

export function resolveCloudRecordAfterDecision(input: {
	decision?: CloudDecision;
	api?: { kuundaProjectRef?: string; projectId?: string; env?: string; url?: string; planId?: string };
	previous?: Partial<CloudRecord>;
} = {}): CloudRecord {
	if (input.decision?.action === 'skip') {
		return publicCloudRecord({ ...input.previous, enabled: false });
	}
	if (input.decision?.action === 'provision') {
		return publicCloudRecord({
			enabled: true,
			projectRef: input.api?.kuundaProjectRef || input.api?.projectId,
			env: 'sandbox',
			url: input.api?.url,
			plan: input.api?.planId,
		});
	}
	return publicCloudRecord({
		enabled: true,
		projectRef: input.previous?.projectRef || input.api?.kuundaProjectRef || input.api?.projectId,
		env: input.previous?.env === 'production' || input.previous?.env === 'sandbox' ? input.previous.env : undefined,
		url: input.previous?.url || input.api?.url,
		plan: input.previous?.plan || input.api?.planId,
	});
}

export function publicCloudRecord(cloud: Partial<CloudRecord> | undefined = {}): CloudRecord {
	const record: CloudRecord = { enabled: cloud.enabled !== false };
	const safeRef = sanitizeProjectRef(cloud.projectRef);
	if (safeRef) {
		record.projectRef = safeRef;
	}
	if (cloud.env === 'sandbox' || cloud.env === 'production') {
		record.env = cloud.env;
	}
	const safeUrl = sanitizeCloudUrl(cloud.url);
	if (safeUrl) {
		record.url = safeUrl;
	}
	record.plan = sanitizePlanId(cloud.plan);
	const safeRepo = sanitizeRepoUrl(cloud.repo);
	if (safeRepo) {
		record.repo = safeRepo;
	}
	return redactCloudPayload(record) as CloudRecord;
}

export function serializeManifestWithCloud(manifest: { type: string; name: string; publishTargets?: string[] }, cloud?: Partial<CloudRecord>): string {
	return `${JSON.stringify({
		version: 1,
		type: manifest.type,
		name: manifest.name,
		publishTargets: manifest.publishTargets || [],
		cloud: publicCloudRecord(cloud),
	}, null, '\t')}\n`;
}

export function mergeGitignore(existing: string | undefined, entries: string[] = CLOUD_GITIGNORE_ENTRIES): { changed: boolean; content: string } {
	const lines = String(existing || '').replace(/\r\n/g, '\n').split('\n');
	const have = new Set(lines.map((line) => line.trim()).filter(Boolean));
	const extra: string[] = [];
	for (const entry of entries) {
		if (!have.has(entry)) {
			extra.push(entry);
			have.add(entry);
		}
	}
	if (!extra.length) {
		return { changed: false, content: String(existing || '') };
	}
	const prefix = String(existing || '').replace(/\s*$/, '');
	const content = `${prefix}${prefix ? '\n' : ''}${extra.join('\n')}\n`;
	return { changed: true, content };
}

export function persistableAnonKey(anonKey: string | undefined): string {
	if (typeof anonKey !== 'string' || !anonKey.trim()) {
		return SECRET_PLACEHOLDER;
	}
	const key = anonKey.trim();
	if (key.length > 4096 || /[\r\n\0=]/.test(key) || /\s/.test(key)) {
		return SECRET_PLACEHOLDER;
	}
	if (/service_role|sk_|whsec_|operator/i.test(key)) {
		return SECRET_PLACEHOLDER;
	}
	return key;
}

export function localSecretFiles(input: { url?: string; anonKey?: string } = {}): CloudFile[] {
	const safeUrl = sanitizeCloudUrl(input.url) || SECRET_PLACEHOLDER;
	const key = persistableAnonKey(input.anonKey);
	return [
		{
			path: CLOUD_ENV_PATH,
			content: `KUUNDA_URL=${JSON.stringify(safeUrl)}\nKUUNDA_ANON_KEY=${JSON.stringify(key)}\n`,
			gitignored: true,
		},
		{
			path: CLOUD_LOCAL_PATH,
			content: `${JSON.stringify({ url: safeUrl, anonKey: key }, null, '\t')}\n`,
			gitignored: true,
		},
	];
}

export function crudClientSource(type: string | undefined): string {
	const header = `/**\n * Kuunda Cloud client. Keys come from env / .env.local — never commit them.\n */\n`;
	const fromProcess = type === 'website'
		? `(typeof process !== 'undefined' && process.env && process.env.KUUNDA_URL) || '${SECRET_PLACEHOLDER}'`
		: `process.env.KUUNDA_URL || '${SECRET_PLACEHOLDER}'`;
	const fromKey = type === 'website'
		? `(typeof process !== 'undefined' && process.env && process.env.KUUNDA_ANON_KEY) || '${SECRET_PLACEHOLDER}'`
		: `process.env.KUUNDA_ANON_KEY || '${SECRET_PLACEHOLDER}'`;
	return `${header}const KUUNDA_URL = ${fromProcess};\nconst KUUNDA_ANON_KEY = ${fromKey};\n\nexport async function listItems() {\n\tconst response = await fetch(\`\${KUUNDA_URL}/rest/v1/${SEED_TABLE}\`, {\n\t\theaders: { apikey: KUUNDA_ANON_KEY, Authorization: \`Bearer \${KUUNDA_ANON_KEY}\` },\n\t});\n\tif (!response.ok) {\n\t\tthrow new Error('kuunda_rest_error');\n\t}\n\treturn response.json();\n}\n\nexport async function createItem(title) {\n\tconst response = await fetch(\`\${KUUNDA_URL}/rest/v1/${SEED_TABLE}\`, {\n\t\tmethod: 'POST',\n\t\theaders: { apikey: KUUNDA_ANON_KEY, Authorization: \`Bearer \${KUUNDA_ANON_KEY}\`, 'Content-Type': 'application/json' },\n\t\tbody: JSON.stringify({ title }),\n\t});\n\tif (!response.ok) {\n\t\tthrow new Error('kuunda_rest_error');\n\t}\n\treturn response.json();\n}\n`;
}

export function cloudReadmeSection(input: { enabled?: boolean; url?: string; plan?: string } = {}): string {
	const state = input.enabled === false ? 'disabled' : 'enabled by default';
	const endpoint = sanitizeCloudUrl(input.url) || SECRET_PLACEHOLDER;
	const plan = sanitizePlanId(input.plan);
	return `\n## Kuunda Cloud\n\nProvisioning is **${state}** on the **${plan}** plan. REST URL: \`${endpoint}\`.\nThis project gets its own Kuunda Cloud space automatically — no account to create. Change or upgrade the plan from Kuunda Vibe settings (\`Kuunda Vibe: Manage Cloud Plan\`). The agent may manage the sandbox; you promote migrations to production from Kuunda Cloud.\nCopy \`.env.local\` from the scaffold (gitignored) and replace \`${SECRET_PLACEHOLDER}\` with the project anon key issued at runtime. Never commit operator or service_role keys.\nCRUD helper: \`${CLOUD_CLIENT_PATH}\` (\`${SEED_TABLE}\` table).\n`;
}

export function scaffoldCloudFiles(input: {
	type?: string;
	enabled?: boolean;
	projectRef?: string;
	env?: CloudEnv;
	url?: string;
	anonKey?: string;
	existingGitignore?: string;
	plan?: string;
	repo?: string;
} = {}): { ok: true; cloud: CloudRecord; files: CloudFile[]; decision: CloudDecision } {
	const decision = decideCloudProvisioning({
		enabled: input.enabled,
		ownerId: 'anon_scaffold',
		alreadyProvisioned: Boolean(input.projectRef),
		apiOk: true,
	});
	const publicCloud = publicCloudRecord({ enabled: decision.enabled, projectRef: input.projectRef, env: input.env, url: input.url, plan: input.plan, repo: input.repo });
	const gitignore = mergeGitignore(input.existingGitignore);
	const files: CloudFile[] = [
		{ path: CLOUD_CLIENT_PATH, content: crudClientSource(input.type || 'other') },
	];
	if (gitignore.changed) {
		files.push({ path: '.gitignore', content: gitignore.content });
	}
	if (decision.enabled) {
		files.push(...localSecretFiles({ url: publicCloud.url, anonKey: input.anonKey }));
	}
	return { ok: true, cloud: publicCloud, files, decision };
}

export function formatCloudContext(cloud: Partial<CloudRecord> | undefined): string {
	if (!cloud) {
		return '';
	}
	const publicCloud = publicCloudRecord(cloud);
	if (publicCloud.enabled === false) {
		return 'Kuunda Cloud: disabled (replaceable in project settings).';
	}
	const plan = sanitizePlanId(publicCloud.plan);
	if (!publicCloud.projectRef) {
		return `Kuunda Cloud: enabled but not provisioned yet (plan=${plan}). The IDE creates the project space automatically; retry provisioning from the Cloud panel. No Kuunda Cloud account is required and the user must not be asked to sign up. Do not invent credentials or a production URL.`;
	}
	const env = publicCloud.env || 'sandbox';
	if (env === 'production') {
		return `Kuunda Cloud: enabled ref=${publicCloud.projectRef} env=production plan=${plan}. Treat production as user-owned. Do not apply schema or data migrations there. The user promotes sandbox work from the Kuunda Cloud dashboard.`;
	}
	return `Kuunda Cloud: enabled ref=${publicCloud.projectRef} env=sandbox plan=${plan}. You may manage this sandbox autonomously (schema, migrations, seed data). Never push to production; tell the user to promote migrations in Kuunda Cloud (app.kuunda.cloud).`;
}

/**
 * Human-readable route evidence. Kept next to the panel formatter so the counter is
 * visible where the user already looks, not only in logs.
 */
export function formatRouteReport(report: Partial<CloudRouteReport> | undefined): string {
	const value: Partial<CloudRouteReport> = report || {};
	const mode = sanitizeRouteMode(value.mode);
	const families = Array.isArray(value.families) ? value.families : [];
	const lines = ['Kuunda Cloud routes'];
	lines.push(`mode: ${mode}${mode === 'off' ? ' (spec only, no legacy fallback)' : ' (legacy fallback allowed)'}`);
	lines.push(`calls: spec=${callCount(value.spec)} legacy=${callCount(value.legacy)} across ${families.length} families`);
	const since = callCount(value.since);
	if (since) {
		lines.push(`evidence since: ${new Date(since).toISOString()}`);
	}
	lines.push(value.legacyRemovable
		? 'legacy removal: ready — every family is served by the spec routes'
		: 'legacy removal: not yet — at least one family has no spec proof');
	for (const row of families) {
		const spec = callCount(row && row.spec);
		const legacy = callCount(row && row.legacy);
		const last = row && row.lastRoute === 'legacy' ? 'legacy' : row && row.lastRoute === 'spec' ? 'spec' : 'none';
		const state = !spec && !legacy ? 'unexercised' : legacy > 0 ? 'legacy still used' : 'spec only';
		lines.push(`- ${row && row.family ? row.family : 'unknown'}: spec=${spec} legacy=${legacy} last=${last} (${state})`);
		if (legacy > 0 && row && row.legacyPath) {
			lines.push(`  legacy route to retire: ${row.legacyPath}`);
		}
	}
	return lines.join('\n');
}

export function formatCloudPanel(input: { cloud?: Partial<CloudRecord>; tables?: CloudTable[]; routes?: CloudRouteReport } = {}): string {
	const publicCloud = publicCloudRecord(input.cloud || { enabled: true });
	const lines = ['Kuunda Cloud'];
	lines.push(`enabled: ${publicCloud.enabled !== false}`);
	lines.push(`plan: ${sanitizePlanId(publicCloud.plan)}`);
	if (publicCloud.projectRef) {
		lines.push(`project: ${publicCloud.projectRef}`);
	}
	if (publicCloud.env) {
		lines.push(`env: ${publicCloud.env}`);
	}
	if (publicCloud.url) {
		lines.push(`url: ${publicCloud.url}`);
	}
	if (!publicCloud.projectRef) {
		lines.push('link: the IDE provisions this project space automatically — no account needed');
	} else {
		lines.push('manage plan: Kuunda Vibe settings → Cloud plan');
	}
	if (publicCloud.projectRef) {
		if ((publicCloud.env || 'sandbox') === 'sandbox') {
			lines.push('agent: sandbox (autonomous). production: you promote in Kuunda Cloud.');
		} else {
			lines.push('production is user-owned — promote from Kuunda Cloud, not the agent.');
		}
	}
	const routes = input.routes;
	if (routes) {
		const families = Array.isArray(routes.families) ? routes.families : [];
		const unexercised = families.filter((row) => !callCount(row && row.spec) && !callCount(row && row.legacy)).length;
		const verdict = routes.legacyRemovable
			? 'legacy fallback ready to remove'
			: unexercised ? `${unexercised} families unexercised` : 'legacy fallback still needed';
		lines.push(`routes: spec=${callCount(routes.spec)} legacy=${callCount(routes.legacy)} mode=${sanitizeRouteMode(routes.mode)} (${verdict})`);
	}
	const rows = Array.isArray(input.tables) ? input.tables : [];
	if (!rows.length) {
		lines.push('tables: (none yet)');
	} else {
		lines.push('tables:');
		for (const table of rows) {
			const name = sanitizeTableName(table && table.name);
			const count = typeof table.rowCount === 'number' && Number.isFinite(table.rowCount) ? Math.max(0, Math.floor(table.rowCount)) : 0;
			lines.push(`- ${name} (${count})`);
		}
	}
	return lines.join('\n');
}

function sanitizeTableName(value: unknown): string {
	const name = String(value || '').trim();
	if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(name)) {
		return 'unknown';
	}
	return name;
}
