/**
 * Phase 6 — Kuunda Cloud project provisioning (public kernel).
 * Operator credentials stay in kuunda-vibe-cloud. Project anon keys never land in git.
 */

export const CLOUD_ENABLED_DEFAULT = true;
export const CLOUD_ENV_PATH = '.env.local';
export const CLOUD_LOCAL_PATH = '.kuunda/cloud.local.json';
export const CLOUD_CLIENT_PATH = 'src/kuunda/client.js';
export const SECRET_PLACEHOLDER = '<SET VIA SECRET STORE>';
export const CLOUD_GITIGNORE_ENTRIES = ['.env.local', '.kuunda/cloud.local.json'];
export const SEED_TABLE = 'items';

const SECRET_KEY = /anon[_-]?key|service[_-]?role|operator|password|secret|credential|token|authorization|api[_-]?key/i;

export function parseCloudSettings(raw) {
	let data = raw;
	if (typeof raw === 'string') {
		try {
			data = JSON.parse(raw);
		} catch {
			return { enabled: CLOUD_ENABLED_DEFAULT };
		}
	}
	const cloud = data && typeof data === 'object' ? data.cloud : data;
	if (!cloud || typeof cloud !== 'object' || Array.isArray(cloud)) {
		return { enabled: CLOUD_ENABLED_DEFAULT };
	}
	const enabled = cloud.enabled !== false;
	const projectRef = sanitizeProjectRef(cloud.projectRef);
	const env = cloud.env === 'production' ? 'production' : cloud.env === 'sandbox' ? 'sandbox' : undefined;
	const url = sanitizeCloudUrl(cloud.url);
	return { enabled, projectRef, env, url };
}

export function sanitizeProjectRef(value) {
	const ref = String(value || '').trim();
	if (!/^proj_[a-z0-9]+$/i.test(ref) || ref.length > 64) {
		return undefined;
	}
	return ref;
}

export function sanitizeCloudUrl(url) {
	const value = String(url || '').trim();
	if (!value) {
		return undefined;
	}
	if (!/^https:\/\/[a-z0-9.-]+\.kuunda-cloud\.com\/?$/i.test(value)) {
		return undefined;
	}
	return value.replace(/\/$/, '');
}

export function redactCloudPayload(payload) {
	if (payload == null || typeof payload !== 'object') {
		return payload;
	}
	const out = Array.isArray(payload) ? [] : {};
	for (const [key, value] of Object.entries(payload)) {
		if (SECRET_KEY.test(key) || (typeof value === 'string' && SECRET_KEY.test(value))) {
			continue;
		}
		if (typeof value === 'string' && /kuunda_anon_|service_role|sk_|whsec_/i.test(value)) {
			continue;
		}
		if (value && typeof value === 'object') {
			out[key] = redactCloudPayload(value);
		} else {
			out[key] = value;
		}
	}
	return out;
}

export function decideCloudProvisioning({
	enabled = CLOUD_ENABLED_DEFAULT,
	userId,
	hasSession,
	alreadyProvisioned = false,
	apiOk,
} = {}) {
	if (enabled === false) {
		return { ok: true, action: 'skip', enabled: false };
	}
	if (alreadyProvisioned) {
		return { ok: true, action: 'reuse', enabled: true };
	}
	const signedIn = hasSession === true || (hasSession !== false && Boolean(String(userId || '').trim()));
	if (!signedIn || !String(userId || '').trim()) {
		return { ok: true, action: 'pending_user', enabled: true };
	}
	if (apiOk === false) {
		return { ok: true, action: 'pending_api', enabled: true };
	}
	return { ok: true, action: 'provision', enabled: true };
}

export function resolveCloudRecordAfterDecision({
	decision,
	api,
	previous,
} = {}) {
	if (decision?.action === 'skip') {
		return publicCloudRecord({ ...previous, enabled: false });
	}
	if (decision?.action === 'provision') {
		return publicCloudRecord({
			enabled: true,
			projectRef: api?.kuundaProjectRef || api?.projectId,
			env: 'sandbox',
			url: api?.url,
		});
	}
	return publicCloudRecord({
		enabled: true,
		projectRef: previous?.projectRef || api?.kuundaProjectRef || api?.projectId,
		env: previous?.env === 'production' || previous?.env === 'sandbox' ? previous.env : undefined,
		url: previous?.url || api?.url,
	});
}

export function serializeManifestWithCloud(manifest, cloud) {
	return `${JSON.stringify({
		version: 1,
		type: manifest.type,
		name: manifest.name,
		publishTargets: manifest.publishTargets || [],
		cloud: publicCloudRecord(cloud),
	}, null, '\t')}\n`;
}

export function publicCloudRecord({ enabled = true, projectRef, env, url } = {}) {
	const record = { enabled: enabled !== false };
	const safeRef = sanitizeProjectRef(projectRef);
	if (safeRef) {
		record.projectRef = safeRef;
	}
	if (env === 'sandbox' || env === 'production') {
		record.env = env;
	}
	const safeUrl = sanitizeCloudUrl(url);
	if (safeUrl) {
		record.url = safeUrl;
	}
	return redactCloudPayload(record);
}

export function mergeGitignore(existing, entries = CLOUD_GITIGNORE_ENTRIES) {
	const lines = String(existing || '').replace(/\r\n/g, '\n').split('\n');
	const have = new Set(lines.map((line) => line.trim()).filter(Boolean));
	const extra = [];
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

export function persistableAnonKey(anonKey) {
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

export function localSecretFiles({ url, anonKey } = {}) {
	const safeUrl = sanitizeCloudUrl(url) || SECRET_PLACEHOLDER;
	const key = persistableAnonKey(anonKey);
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

export function crudClientSource(type) {
	const header = `/**\n * Kuunda Cloud client. Keys come from env / .env.local — never commit them.\n */\n`;
	if (type === 'website') {
		return `${header}const KUUNDA_URL = (typeof process !== 'undefined' && process.env && process.env.KUUNDA_URL) || '${SECRET_PLACEHOLDER}';\nconst KUUNDA_ANON_KEY = (typeof process !== 'undefined' && process.env && process.env.KUUNDA_ANON_KEY) || '${SECRET_PLACEHOLDER}';\n\nexport async function listItems() {\n\tconst response = await fetch(\`\${KUUNDA_URL}/rest/v1/${SEED_TABLE}\`, {\n\t\theaders: { apikey: KUUNDA_ANON_KEY, Authorization: \`Bearer \${KUUNDA_ANON_KEY}\` },\n\t});\n\tif (!response.ok) {\n\t\tthrow new Error('kuunda_rest_error');\n\t}\n\treturn response.json();\n}\n\nexport async function createItem(title) {\n\tconst response = await fetch(\`\${KUUNDA_URL}/rest/v1/${SEED_TABLE}\`, {\n\t\tmethod: 'POST',\n\t\theaders: { apikey: KUUNDA_ANON_KEY, Authorization: \`Bearer \${KUUNDA_ANON_KEY}\`, 'Content-Type': 'application/json' },\n\t\tbody: JSON.stringify({ title }),\n\t});\n\tif (!response.ok) {\n\t\tthrow new Error('kuunda_rest_error');\n\t}\n\treturn response.json();\n}\n`;
	}
	return `${header}const KUUNDA_URL = process.env.KUUNDA_URL || '${SECRET_PLACEHOLDER}';\nconst KUUNDA_ANON_KEY = process.env.KUUNDA_ANON_KEY || '${SECRET_PLACEHOLDER}';\n\nexport async function listItems() {\n\tconst response = await fetch(\`\${KUUNDA_URL}/rest/v1/${SEED_TABLE}\`, {\n\t\theaders: { apikey: KUUNDA_ANON_KEY, Authorization: \`Bearer \${KUUNDA_ANON_KEY}\` },\n\t});\n\tif (!response.ok) {\n\t\tthrow new Error('kuunda_rest_error');\n\t}\n\treturn response.json();\n}\n\nexport async function createItem(title) {\n\tconst response = await fetch(\`\${KUUNDA_URL}/rest/v1/${SEED_TABLE}\`, {\n\t\tmethod: 'POST',\n\t\theaders: { apikey: KUUNDA_ANON_KEY, Authorization: \`Bearer \${KUUNDA_ANON_KEY}\`, 'Content-Type': 'application/json' },\n\t\tbody: JSON.stringify({ title }),\n\t});\n\tif (!response.ok) {\n\t\tthrow new Error('kuunda_rest_error');\n\t}\n\treturn response.json();\n}\n`;
}

export function cloudReadmeSection({ enabled, url } = {}) {
	const state = enabled === false ? 'disabled' : 'enabled by default';
	const endpoint = sanitizeCloudUrl(url) || SECRET_PLACEHOLDER;
	return `\n## Kuunda Cloud\n\nProvisioning is **${state}**. REST URL: \`${endpoint}\`.\nSign in (or create a Kuunda account) in Studio to attach a **sandbox** to this IDE. The agent may manage that sandbox; you promote migrations to production from Kuunda Cloud.\nCopy \`.env.local\` from the scaffold (gitignored) and replace \`${SECRET_PLACEHOLDER}\` with the project anon key issued at runtime. Never commit operator or service_role keys.\nCRUD helper: \`${CLOUD_CLIENT_PATH}\` (\`${SEED_TABLE}\` table).\n`;
}

export function scaffoldCloudFiles({ type, enabled = true, projectRef, env, url, anonKey, existingGitignore = '' } = {}) {
	const decision = decideCloudProvisioning({
		enabled,
		userId: 'scaffold',
		alreadyProvisioned: Boolean(projectRef),
		apiOk: true,
	});
	const publicCloud = publicCloudRecord({ enabled: decision.enabled, projectRef, env, url });
	const gitignore = mergeGitignore(existingGitignore);
	const files = [
		{ path: CLOUD_CLIENT_PATH, content: crudClientSource(type || 'other') },
	];
	if (gitignore.changed) {
		files.push({ path: '.gitignore', content: gitignore.content });
	}
	if (decision.enabled) {
		files.push(...localSecretFiles({ url: publicCloud.url, anonKey }));
	}
	return {
		ok: true,
		cloud: publicCloud,
		files,
		decision,
	};
}

export function formatCloudContext(cloud) {
	if (!cloud) {
		return '';
	}
	const publicCloud = publicCloudRecord(cloud);
	if (publicCloud.enabled === false) {
		return 'Kuunda Cloud: disabled (replaceable in project settings).';
	}
	if (!publicCloud.projectRef) {
		return 'Kuunda Cloud: enabled but not linked. Ask the user to create or sign in to their Kuunda account in Studio so this IDE can attach a sandbox database. Do not invent credentials or a production URL.';
	}
	const env = publicCloud.env || 'sandbox';
	if (env === 'production') {
		return `Kuunda Cloud: enabled ref=${publicCloud.projectRef} env=production. Treat production as user-owned. Do not apply schema or data migrations there. The user promotes sandbox work from the Kuunda Cloud dashboard.`;
	}
	return `Kuunda Cloud: enabled ref=${publicCloud.projectRef} env=sandbox. You may manage this sandbox autonomously (schema, migrations, seed data). Never push to production; tell the user to promote migrations in Kuunda Cloud (app.kuunda.cloud).`;
}

export function formatCloudPanel({ cloud, tables } = {}) {
	const publicCloud = publicCloudRecord(cloud || { enabled: true });
	const lines = ['Kuunda Cloud'];
	lines.push(`enabled: ${publicCloud.enabled !== false}`);
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
		lines.push('link: create a Kuunda account in Studio to attach this IDE');
	} else if ((publicCloud.env || 'sandbox') === 'sandbox') {
		lines.push('agent: sandbox (autonomous). production: you promote in Kuunda Cloud.');
	} else {
		lines.push('production is user-owned — promote from Kuunda Cloud, not the agent.');
	}
	const rows = Array.isArray(tables) ? tables : [];
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

function sanitizeTableName(value) {
	const name = String(value || '').trim();
	if (!/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(name)) {
		return 'unknown';
	}
	return name;
}
