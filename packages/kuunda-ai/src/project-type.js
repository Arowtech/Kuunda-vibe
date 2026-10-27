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
	const stack = 'Choose the language and a current, maintained frontend framework for the need (React, Next.js, Vue, Svelte, Solid, Angular, Expo, or another fit on its latest stable major). The files here are a starter, not a lock. Do not ship jQuery, Create React App, AngularJS, or a single HTML page unless the user explicitly asks for a static page.';
	return `# ${name}\nProject type: ${type}. ${stack} If package.json already chooses a framework, keep it.\nBefore a new application or a stack change, propose two or three options, mark one recommended, and wait for the user's choice. Do not switch frameworks in silence.\nData: Kuunda Cloud is the default database. Read and write through src/kuunda/client.js. Credentials stay in gitignored .env.local. Do not add SQLite, localStorage as a database, Supabase, Firebase, or another backend unless the user asks.\nCode hosting: Kuunda Git is the default remote (https://git.kuunda-cloud.com/<projectRef>/<repo>.git, remote name kuunda). Do not create a GitHub or GitLab repository unless the user asks. Do not push until a write token exists in Services → Kuunda Git. Never commit the token, .env.local, or .kuunda/cloud.local.json. Never commit operator or privileged database keys.\nFrontend hosting: Kuunda Frontend (https://<slug>.kuunda-cloud.com) is the default. A push to Kuunda Git publishes the site. Do not add Vercel, Netlify, or GitHub Pages unless the user asks.\nAccount: a user created through the Kuunda Cloud API already has Kuunda Cloud, Kuunda Git, Kuunda Frontend, and the auth providers in that same account. Do not create a separate account per service.\nStay inside this workspace.\n`;
}

function readmeFor(type, name, publishTargets) {
	const publish = type === 'mobile' ? `\n\nMobile publishing target: ${publishOptionFromTargets(publishTargets)}. Store credentials and AAB/IPA builds are Phase 7.` : '';
	return `# ${name}\n\nScaffolded by Kuunda Vibe as a **${type}** project. The starter UI is React (Vite); replace it with another current frontend framework when that fits the product better.${publish}\n\nKuunda Cloud is enabled by default and is the database for this project: this project gets its own Cloud space (standard plan) automatically — no Kuunda Cloud account to create. Change or upgrade the plan from Kuunda Vibe settings (\`Kuunda Vibe: Manage Cloud Plan\`). The agent manages the sandbox; you promote migrations to production from Kuunda Studio. Project credentials live in gitignored \`.env.local\`. Disable or replace it from the Kuunda Cloud commands.\n\nSource code is hosted on Kuunda Git (\`https://git.kuunda-cloud.com/<projectRef>/<repo>.git\`), not on GitHub, unless you choose another remote. The published site is hosted on Kuunda Frontend (\`https://<slug>.kuunda-cloud.com\`). A push to Kuunda Git publishes it.\n\nA user account created through the Kuunda Cloud API already includes Kuunda Cloud, Kuunda Git, Kuunda Frontend, and the auth providers. No separate signup per service.\n`;
}

function reactAppFiles(name) {
	const label = JSON.stringify(name);
	return [
		{
			path: 'package.json',
			content: `${JSON.stringify({
				name,
				private: true,
				type: 'module',
				scripts: { dev: 'vite', build: 'vite build', preview: 'vite preview' },
				dependencies: { react: '^19.0.0', 'react-dom': '^19.0.0' },
				devDependencies: { '@vitejs/plugin-react': '^4.3.4', vite: '^6.0.0' },
			}, null, '\t')}\n`,
		},
		{
			path: 'vite.config.js',
			content: `import { defineConfig } from 'vite';\nimport react from '@vitejs/plugin-react';\n\nexport default defineConfig({ plugins: [react()] });\n`,
		},
		{
			path: 'index.html',
			content: `<!doctype html>\n<html lang="en">\n<head>\n\t<meta charset="utf-8">\n\t<meta name="viewport" content="width=device-width, initial-scale=1">\n\t<title>${name}</title>\n</head>\n<body>\n\t<div id="root"></div>\n\t<script type="module" src="/src/main.jsx"></script>\n</body>\n</html>\n`,
		},
		{
			path: 'src/main.jsx',
			content: `import { createRoot } from 'react-dom/client';\nimport { App } from './App.jsx';\n\ncreateRoot(document.getElementById('root')).render(<App />);\n`,
		},
		{
			path: 'src/App.jsx',
			content: `import { useEffect, useState } from 'react';\nimport { listItems } from './kuunda/client.js';\n\nexport function App() {\n\tconst [items, setItems] = useState([]);\n\tconst [error, setError] = useState('');\n\tuseEffect(() => {\n\t\tlistItems().then(setItems).catch(() => setError('Kuunda Cloud is not ready yet.'));\n\t}, []);\n\treturn (\n\t\t<main>\n\t\t\t<h1>{${label}}</h1>\n\t\t\t<p>React application. Data comes from Kuunda Cloud.</p>\n\t\t\t{error ? <p>{error}</p> : <ul>{items.map((item) => <li key={item.id ?? item.title}>{item.title}</li>)}</ul>}\n\t\t</main>\n\t);\n}\n`,
		},
		{
			path: '.gitignore',
			content: `node_modules\ndist\n.env.local\n.kuunda/cloud.local.json\n`,
		},
	];
}

function websiteFiles(name) {
	return reactAppFiles(name);
}

function webappFiles(name) {
	return reactAppFiles(name);
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
		...reactAppFiles(name),
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
