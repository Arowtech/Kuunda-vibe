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
	const injection = `<base href="${escapeAttr(options.baseHref)}"><style nonce="${options.nonce}">html.kuunda-select-mode, html.kuunda-select-mode *{cursor:crosshair !important}.kuunda-preview-hover{outline:2px solid #7c6af7 !important;outline-offset:1px}</style>`;
	if (/<head[^>]*>/i.test(html)) {
		return html.replace(/<head[^>]*>/i, head => head + injection);
	}
	return `<!DOCTYPE html><html><head>${injection}</head><body>${html}</body></html>`;
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
