/**
 * Phase 5 — project type picker and scaffold templates.
 * Kuunda Cloud credentials are injected by Phase 6 (gitignored). No store secrets (Phase 7).
 */

import { parseCloudSettings, publicCloudRecord } from './cloud-provision.js';

export const PROJECT_TYPES = ['website', 'webapp', 'mobile', 'other'];
export const MOBILE_PUBLISH_OPTIONS = ['google_play', 'app_store', 'both', 'none'];
export const MOBILE_PUBLISH_TARGETS = ['google_play', 'app_store'];
export const PROJECT_MANIFEST_VERSION = 1;
export const PROJECT_MANIFEST_PATH = '.kuunda/project.json';
const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

export function isProjectType(value) {
	return PROJECT_TYPES.includes(value);
}

export function isMobilePublishOption(value) {
	return MOBILE_PUBLISH_OPTIONS.includes(value);
}

export function sanitizeProjectName(name) {
	const raw = String(name || '').trim();
	if (!raw || raw === '.' || raw === '..') {
		return '';
	}
	if (/[\\/]/.test(raw) || raw.includes('\0')) {
		return '';
	}
	const cleaned = raw.replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^[.-]+|[.-]+$/g, '');
	if (!cleaned || cleaned === '.' || cleaned === '..') {
		return '';
	}
	if (WINDOWS_RESERVED_NAMES.test(cleaned)) {
		return '';
	}
	return cleaned.slice(0, 64);
}

export function normalizePublishTargets(type, publishOption) {
	if (type !== 'mobile') {
		return [];
	}
	if (publishOption === 'google_play') {
		return ['google_play'];
	}
	if (publishOption === 'app_store') {
		return ['app_store'];
	}
	if (publishOption === 'both') {
		return ['google_play', 'app_store'];
	}
	if (publishOption === 'none') {
		return [];
	}
	return null;
}

export function publishOptionFromTargets(targets) {
	const list = Array.isArray(targets) ? targets.filter((item) => MOBILE_PUBLISH_TARGETS.includes(item)) : [];
	const unique = [...new Set(list)];
	if (unique.length === 2) {
		return 'both';
	}
	if (unique[0] === 'google_play') {
		return 'google_play';
	}
	if (unique[0] === 'app_store') {
		return 'app_store';
	}
	return 'none';
}

export function decideProjectCreate({
	type,
	publishOption,
	name,
	destinationKind = 'missing',
	existingManifest = false,
} = {}) {
	if (!isProjectType(type)) {
		return { ok: false, error: 'type_required' };
	}
	if (type === 'mobile') {
		const targets = normalizePublishTargets(type, publishOption);
		if (targets === null) {
			return { ok: false, error: 'publish_required' };
		}
	} else if (publishOption != null && publishOption !== '' && publishOption !== 'none') {
		return { ok: false, error: 'publish_not_applicable' };
	}
	const safeName = sanitizeProjectName(name);
	if (!safeName) {
		return { ok: false, error: 'name_required' };
	}
	if (destinationKind === 'file') {
		return { ok: false, error: 'not_a_directory' };
	}
	if (existingManifest) {
		return { ok: false, error: 'already_kuunda_project' };
	}
	return {
		ok: true,
		type,
		name: safeName,
		publishTargets: normalizePublishTargets(type, type === 'mobile' ? publishOption : 'none') || [],
	};
}

export function decideDestination({
	parentKind = 'folder',
	folderKind = 'missing',
	manifestExists = false,
	manifestValid = false,
} = {}) {
	if (parentKind === 'missing') {
		return { ok: false, error: 'parent_missing' };
	}
	if (parentKind === 'file' || folderKind === 'file') {
		return { ok: false, error: 'not_a_directory' };
	}
	if (manifestExists && manifestValid) {
		return { ok: false, error: 'already_kuunda_project' };
	}
	if (manifestExists && !manifestValid) {
		return { ok: false, error: 'invalid_manifest' };
	}
	return { ok: true };
}

export function parseProjectManifest(raw) {
	let data = raw;
	if (typeof raw === 'string') {
		try {
			data = JSON.parse(raw);
		} catch {
			return { ok: false, error: 'invalid_json' };
		}
	}
	if (!data || typeof data !== 'object' || Array.isArray(data)) {
		return { ok: false, error: 'invalid_json' };
	}
	if (data.version !== PROJECT_MANIFEST_VERSION) {
		return { ok: false, error: 'unsupported_version' };
	}
	if (!isProjectType(data.type)) {
		return { ok: false, error: 'type_required' };
	}
	const name = sanitizeProjectName(data.name);
	if (!name) {
		return { ok: false, error: 'name_required' };
	}
	const option = data.type === 'mobile'
		? (isMobilePublishOption(data.publishOption) ? data.publishOption : publishOptionFromTargets(data.publishTargets))
		: 'none';
	if (data.type === 'mobile' && !isMobilePublishOption(option)) {
		return { ok: false, error: 'publish_required' };
	}
	const decided = decideProjectCreate({
		type: data.type,
		publishOption: option,
		name,
	});
	if (!decided.ok) {
		return decided;
	}
	return {
		ok: true,
		manifest: {
			version: PROJECT_MANIFEST_VERSION,
			type: decided.type,
			name: decided.name,
			publishTargets: decided.publishTargets,
			cloud: publicCloudRecord(parseCloudSettings(data)),
		},
	};
}

export function serializeProjectManifest(manifest) {
	return `${JSON.stringify({
		version: PROJECT_MANIFEST_VERSION,
		type: manifest.type,
		name: manifest.name,
		publishTargets: manifest.publishTargets || [],
		cloud: publicCloudRecord(manifest.cloud),
	}, null, '\t')}\n`;
}

export function selectFilesToWrite(files, existingPaths) {
	const existing = new Set((existingPaths || []).map((path) => String(path).replace(/\\/g, '/')));
	const written = [];
	const skipped = [];
	for (const file of files || []) {
		if (existing.has(file.path)) {
			skipped.push(file.path);
		} else {
			written.push(file);
		}
	}
	return { written, skipped };
}

export function formatProjectContext(entries) {
	const rows = (entries || []).filter((entry) => entry && entry.manifest && entry.manifest.type);
	if (!rows.length) {
		return '';
	}
	const lines = ['Kuunda project type:'];
	for (const entry of rows) {
		const folder = entry.folderName || entry.manifest.name;
		const targets = entry.manifest.type === 'mobile'
			? ` publish=${publishOptionFromTargets(entry.manifest.publishTargets)}`
			: '';
		lines.push(`- ${folder}: ${entry.manifest.type}${targets}`);
	}
	return lines.join('\n');
}

function rulesFor(type, name) {
	return `# ${name}\nProject type: ${type}. Stay inside this workspace. Do not commit .env.local or .kuunda/cloud.local.json. Never commit operator or privileged database keys. Store publishing is Phase 7.\n`;
}

function readmeFor(type, name, publishTargets) {
	const publish = type === 'mobile' ? `\n\nMobile publishing target: ${publishOptionFromTargets(publishTargets)}. Store credentials and AAB/IPA builds are Phase 7.` : '';
	return `# ${name}\n\nScaffolded by Kuunda Vibe as a **${type}** project.${publish}\n\nKuunda Cloud is enabled by default. Create a Kuunda account in Studio to attach a sandbox to this IDE. The agent manages the sandbox; you promote migrations to production from Kuunda Cloud. Project credentials live in gitignored \`.env.local\`. Disable or replace it from the Kuunda Cloud commands.\n`;
}

function websiteFiles(name) {
	return [
		{
			path: 'index.html',
			content: `<!doctype html>\n<html lang="en">\n<head>\n\t<meta charset="utf-8">\n\t<meta name="viewport" content="width=device-width, initial-scale=1">\n\t<title>${name}</title>\n\t<link rel="stylesheet" href="styles.css">\n</head>\n<body>\n\t<main>\n\t\t<h1>${name}</h1>\n\t\t<p>Static website scaffolded by Kuunda Vibe.</p>\n\t</main>\n\t<script src="script.js"></script>\n</body>\n</html>\n`,
		},
		{
			path: 'styles.css',
			content: `html, body { margin: 0; font-family: system-ui, sans-serif; }\nmain { max-width: 40rem; margin: 4rem auto; padding: 0 1rem; }\n`,
		},
		{
			path: 'script.js',
			content: `document.documentElement.dataset.kuundaProject = ${JSON.stringify(name)};\n`,
		},
	];
}

function webappFiles(name) {
	return [
		{
			path: 'package.json',
			content: `${JSON.stringify({
				name,
				private: true,
				type: 'module',
				scripts: { start: 'node src/server.js' },
			}, null, '\t')}\n`,
		},
		{
			path: 'src/server.js',
			content: `import { createServer } from 'node:http';\nimport { readFile } from 'node:fs/promises';\nimport { dirname, join } from 'node:path';\nimport { fileURLToPath } from 'node:url';\n\nconst root = join(dirname(fileURLToPath(import.meta.url)), 'public');\nconst server = createServer(async (_req, res) => {\n\ttry {\n\t\tconst html = await readFile(join(root, 'index.html'));\n\t\tres.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });\n\t\tres.end(html);\n\t} catch {\n\t\tres.writeHead(500);\n\t\tres.end('unavailable');\n\t}\n});\nserver.listen(3000, () => console.log('http://127.0.0.1:3000'));\n`,
		},
		{
			path: 'src/public/index.html',
			content: `<!doctype html>\n<html lang="en">\n<head>\n\t<meta charset="utf-8">\n\t<title>${name}</title>\n</head>\n<body>\n\t<h1>${name}</h1>\n\t<p>Web application scaffold. Run <code>npm start</code>.</p>\n</body>\n</html>\n`,
		},
	];
}

function mobileFiles(name, publishTargets) {
	const files = [
		{
			path: 'app.json',
			content: `${JSON.stringify({
				name,
				displayName: name,
				platforms: publishTargets,
			}, null, '\t')}\n`,
		},
		{
			path: 'src/index.html',
			content: `<!doctype html>\n<html lang="en">\n<head>\n\t<meta charset="utf-8">\n\t<meta name="viewport" content="width=device-width, initial-scale=1">\n\t<title>${name}</title>\n</head>\n<body>\n\t<h1>${name}</h1>\n\t<p>Mobile application shell. Publishing is Phase 7.</p>\n</body>\n</html>\n`,
		},
	];
	if (publishTargets.includes('google_play')) {
		files.push({
			path: 'store/play/README.md',
			content: `# Google Play\n\nPlaceholder for Play Console metadata. Do not put a service account JSON here. Builds (AAB) are Phase 7.\n`,
		});
	}
	if (publishTargets.includes('app_store')) {
		files.push({
			path: 'store/appstore/README.md',
			content: `# App Store\n\nPlaceholder for App Store Connect metadata. Do not put an .p8 or certificate here. Builds (IPA) are Phase 7.\n`,
		});
	}
	return files;
}

export function scaffoldProjectFiles({ type, name, publishTargets = [] } = {}) {
	const decided = decideProjectCreate({
		type,
		name,
		publishOption: type === 'mobile' ? publishOptionFromTargets(publishTargets) : 'none',
	});
	if (!decided.ok) {
		return decided;
	}
	const files = [
		{ path: '.projectrules', content: rulesFor(decided.type, decided.name) },
		{ path: 'README.md', content: readmeFor(decided.type, decided.name, decided.publishTargets) },
	];
	if (decided.type === 'website') {
		files.push(...websiteFiles(decided.name));
	} else if (decided.type === 'webapp') {
		files.push(...webappFiles(decided.name));
	} else if (decided.type === 'mobile') {
		files.push(...mobileFiles(decided.name, decided.publishTargets));
	}
	files.push({ path: PROJECT_MANIFEST_PATH, content: serializeProjectManifest(decided) });
	return { ok: true, manifest: decided, files };
}
