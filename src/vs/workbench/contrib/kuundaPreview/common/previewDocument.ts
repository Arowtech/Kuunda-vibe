/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

const LIVE_EXTENSIONS = ['.html', '.htm', '.css', '.js', '.mjs', '.cjs', '.svg', '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.woff', '.woff2'];

export const PREVIEW_ENTRY_CANDIDATES = [
	'index.html',
	'index.htm',
	'public/index.html',
	'src/public/index.html',
	'src/index.html',
	'app/index.html',
];

export function isLivePreviewPath(path: string): boolean {
	const lower = path.toLowerCase().split('?')[0].split('#')[0];
	return LIVE_EXTENSIONS.some(extension => lower.endsWith(extension));
}

export function isLocalPreviewUrl(url: string): boolean {
	const trimmed = url.trim();
	if (!trimmed) {
		return false;
	}
	return !/^(?:#|data:|mailto:|javascript:|https?:|\/\/)/i.test(trimmed);
}

export function pickPreviewEntry(relativePaths: readonly string[]): string | undefined {
	const normalized = relativePaths.map(path => path.replace(/\\/g, '/'));
	for (const candidate of PREVIEW_ENTRY_CANDIDATES) {
		const found = normalized.find(path => path.toLowerCase() === candidate);
		if (found) {
			return found;
		}
	}
	const html = normalized
		.filter(path => !path.includes('/') && /\.html?$/i.test(path))
		.sort((a, b) => a.localeCompare(b));
	return html[0];
}

export function cacheBustUrl(url: string, version: string): string {
	const hashIndex = url.indexOf('#');
	const hash = hashIndex >= 0 ? url.slice(hashIndex) : '';
	const withoutHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
	if (withoutHash.includes('kuundaPreview=')) {
		return url;
	}
	const joiner = withoutHash.includes('?') ? '&' : '?';
	return `${withoutHash}${joiner}kuundaPreview=${encodeURIComponent(version)}${hash}`;
}

export function rebaseCssUrls(css: string, cssHref: string): string {
	const slash = cssHref.lastIndexOf('/');
	const dir = slash >= 0 ? cssHref.slice(0, slash + 1) : '';
	return css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/gi, (full, quote: string, url: string) => {
		if (!isLocalPreviewUrl(url) || url.startsWith('/')) {
			return full;
		}
		return `url(${quote}${dir}${url}${quote})`;
	});
}

export function collectLocalAssets(html: string): { styles: string[]; scripts: string[] } {
	const styles: string[] = [];
	const scripts: string[] = [];
	for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
		if (!isStylesheetLink(tag)) {
			continue;
		}
		const href = readAttr(tag, 'href');
		if (href && isLocalPreviewUrl(href)) {
			styles.push(href);
		}
	}
	for (const tag of html.match(/<script\b[^>]*>/gi) ?? []) {
		const src = readAttr(tag, 'src');
		if (src && isLocalPreviewUrl(src)) {
			scripts.push(src);
		}
	}
	return { styles, scripts };
}

export function buildPreviewHtml(options: {
	html: string;
	baseHref: string;
	nonce: string;
	version: string;
	styles: Readonly<Record<string, string>>;
	scripts: Readonly<Record<string, string>>;
}): string {
	let html = options.html.replace(/<link\b[^>]*>/gi, tag => {
		if (!isStylesheetLink(tag)) {
			return tag;
		}
		const href = readAttr(tag, 'href');
		const css = href ? options.styles[href] : undefined;
		if (!href || css === undefined || /@import\b/i.test(css)) {
			return tag;
		}
		return `<style nonce="${options.nonce}">${escapeStyle(rebaseCssUrls(css, href))}</style>`;
	});
	html = html.replace(/<script\b([^>]*)>\s*<\/script>/gi, (full, attrs: string) => {
		const tag = `<script${attrs}>`;
		const src = readAttr(tag, 'src');
		const code = src ? options.scripts[src] : undefined;
		if (!src || code === undefined || !shouldInlineScript(tag, code)) {
			return full;
		}
		return `<script nonce="${options.nonce}">${escapeScript(code)}</script>`;
	});
	html = html.replace(/\s(src|href|poster)\s*=\s*(['"])([^'"]+)\2/gi, (full, attr: string, quote: string, url: string) => {
		if (!isLocalPreviewUrl(url)) {
			return full;
		}
		return ` ${attr}=${quote}${cacheBustUrl(url, options.version)}${quote}`;
	});
	html = stampNonce(html, 'script', options.nonce);
	html = stampNonce(html, 'style', options.nonce);
	const injection = `<base href="${escapeAttr(options.baseHref)}"><style nonce="${options.nonce}">${PREVIEW_PAGE_STYLE}</style>`;
	if (/<head[^>]*>/i.test(html)) {
		return html.replace(/<head[^>]*>/i, head => head + injection);
	}
	return `<!DOCTYPE html><html><head>${injection}</head><body>${html}</body></html>`;
}

const PREVIEW_PAGE_STYLE = [
	'html.kuunda-select-mode,html.kuunda-select-mode *{cursor:crosshair !important}',
	'.kuunda-preview-hover{outline:2px solid #7c6af7 !important;outline-offset:1px}',
	'*{scrollbar-width:thin;scrollbar-color:rgba(128,128,128,.55) transparent}',
	'*::-webkit-scrollbar{width:10px;height:10px}',
	'*::-webkit-scrollbar-thumb{background-color:rgba(128,128,128,.55);border-radius:999px;border:3px solid transparent;background-clip:content-box}',
	'*::-webkit-scrollbar-track,*::-webkit-scrollbar-corner{background:transparent}',
].join('');

const VOID_HTML_TAGS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

export function findElementRange(source: string, hint: { id?: string; tag?: string; classes?: string; text?: string; marker?: string }): [number, number] | undefined {
	const lines = source.split(/\r?\n/);
	const index = findOpeningLine(lines, hint);
	if (index < 0) {
		return undefined;
	}
	const tag = sanitizeTag(hint.tag) || readTagAt(lines[index]);
	const end = tag ? findClosingLine(lines, index, tag) : index;
	return [index + 1, end + 1];
}

function findOpeningLine(lines: readonly string[], hint: { id?: string; tag?: string; classes?: string; text?: string; marker?: string }): number {
	const id = hint.id?.trim();
	if (id) {
		const re = new RegExp(String.raw`\bid\s*=\s*(['"])${escapeRegExp(id)}\1`, 'i');
		const found = lines.findIndex(line => re.test(line));
		if (found >= 0) {
			return found;
		}
	}
	const tag = sanitizeTag(hint.tag);
	const classes = (hint.classes ?? '').split(/\s+/).map(name => name.trim()).filter(name => name && name !== 'kuunda-preview-hover');
	if (tag && classes.length) {
		const open = new RegExp(String.raw`<${tag}\b`, 'i');
		const found = lines.findIndex(line => open.test(line) && classes.every(name => classOnLine(line, name)));
		if (found >= 0) {
			return found;
		}
	}
	const marker = hint.marker?.split('?')[0].split('#')[0].trim() ?? '';
	if (marker.length >= 2) {
		const found = lines.findIndex(line => line.includes(marker));
		if (found >= 0) {
			return found;
		}
	}
	const needle = hint.text?.replace(/\s+/g, ' ').trim().slice(0, 48) ?? '';
	if (needle.length < 2) {
		return -1;
	}
	const found = lines.findIndex(line => line.replace(/\s+/g, ' ').includes(needle));
	if (found < 0) {
		return -1;
	}
	if (!tag) {
		return found;
	}
	const open = new RegExp(String.raw`<${tag}\b`, 'i');
	for (let line = found; line >= Math.max(0, found - 30); line--) {
		if (open.test(lines[line])) {
			return line;
		}
	}
	return found;
}

function findClosingLine(lines: readonly string[], start: number, tag: string): number {
	if (VOID_HTML_TAGS.has(tag)) {
		return start;
	}
	const token = new RegExp(String.raw`<\/?${tag}\b[^>]*>`, 'gi');
	let depth = 0;
	let seen = false;
	for (let line = start; line < lines.length; line++) {
		for (const match of lines[line].match(token) ?? []) {
			seen = true;
			if (match.startsWith('</')) {
				depth -= 1;
			} else if (!match.endsWith('/>')) {
				depth += 1;
			}
			if (seen && depth <= 0) {
				return line;
			}
		}
	}
	return start;
}

function classOnLine(line: string, name: string): boolean {
	return new RegExp(String.raw`(?:^|[\s"'=])${escapeRegExp(name)}(?=$|[\s"'])`).test(line);
}

function readTagAt(line: string): string {
	const found = /<([a-zA-Z][\w-]*)\b/.exec(line);
	return found ? found[1].toLowerCase() : '';
}

function sanitizeTag(tag: string | undefined): string {
	const value = tag?.trim().toLowerCase() ?? '';
	return /^[a-z][\w-]*$/.test(value) ? value : '';
}

function escapeRegExp(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isStylesheetLink(tag: string): boolean {
	const rel = readAttr(tag, 'rel');
	return !!rel && /\bstylesheet\b/i.test(rel);
}

function shouldInlineScript(tag: string, code: string): boolean {
	if (/type\s*=\s*(['"])module\1/i.test(tag)) {
		return false;
	}
	return !/(^|\n)\s*(import|export)\s/.test(code);
}

function readAttr(tag: string, name: string): string | undefined {
	const found = new RegExp(String.raw`\b${name}\s*=\s*(['"])(.*?)\1`, 'i').exec(tag);
	return found?.[2];
}

function stampNonce(html: string, tagName: 'script' | 'style', nonce: string): string {
	return html.replace(new RegExp(String.raw`<${tagName}\b([^>]*)>`, 'gi'), (full, attrs: string) => {
		if (/\bnonce\s*=/i.test(attrs)) {
			return full;
		}
		return `<${tagName} nonce="${nonce}"${attrs}>`;
	});
}

function escapeStyle(css: string): string {
	return css.replace(/<\/style/gi, '<\\/style');
}

function escapeScript(code: string): string {
	return code.replace(/<\/script/gi, '<\\/script');
}

function escapeAttr(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}
