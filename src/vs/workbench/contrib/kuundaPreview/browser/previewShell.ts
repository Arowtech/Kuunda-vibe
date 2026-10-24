/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

export interface PreviewShellText {
	readonly menu: string;
	readonly selectElement: string;
	readonly navigate: string;
	readonly reload: string;
	readonly live: string;
	readonly selected: string;
	readonly empty: string;
	readonly frameTitle: string;
}

export function previewShellHtml(text: PreviewShellText, nonce: string, cspSource: string): string {
	return `<!DOCTYPE html>
<html>
<head>
	<meta charset="utf-8">
	<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} https: data: blob:; media-src ${cspSource} https: data: blob:; font-src ${cspSource} https: data:; style-src 'nonce-${nonce}' 'unsafe-inline' ${cspSource} https:; script-src 'nonce-${nonce}' ${cspSource} https:; frame-src 'self' about: ${cspSource} https: data: blob:;">
	<style nonce="${nonce}">
		html, body { height: 100%; margin: 0; }
		body { display: grid; grid-template-rows: auto 1fr; background: var(--vscode-editor-background); color: var(--vscode-foreground); font-family: var(--vscode-font-family); font-size: 13px; }
		.toolbar { display: flex; align-items: center; gap: 8px; padding: 6px 10px; border-bottom: 1px solid var(--vscode-panel-border); position: relative; }
		.menu-wrap { position: relative; }
		button { font: inherit; color: var(--vscode-foreground); background: var(--vscode-button-secondaryBackground, transparent); border: 1px solid var(--vscode-button-border, transparent); border-radius: 4px; padding: 3px 8px; cursor: pointer; }
		button:hover { background: var(--vscode-toolbar-hoverBackground); }
		.menu-panel { display: none; position: absolute; top: calc(100% + 4px); left: 0; z-index: 2; min-width: 196px; padding: 4px; background: var(--vscode-menu-background); color: var(--vscode-menu-foreground); border: 1px solid var(--vscode-menu-border, var(--vscode-panel-border)); border-radius: 4px; box-shadow: 0 4px 16px rgba(0,0,0,.24); }
		.menu-panel.open { display: flex; flex-direction: column; }
		.menu-panel button { text-align: left; background: transparent; border-color: transparent; }
		.menu-panel button[aria-checked="true"]::before { content: "✓ "; }
		.mode { font-weight: 600; }
		.file, .selection { opacity: .8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
		.live { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; }
		.live i { width: 8px; height: 8px; border-radius: 50%; background: #3dd68c; display: inline-block; }
		.stage { position: relative; min-height: 0; }
		iframe { width: 100%; height: 100%; border: 0; background: #fff; }
		.empty { margin: 0; padding: 24px; }
	</style>
</head>
<body
	data-select="${escapeAttr(text.selectElement)}"
	data-navigate="${escapeAttr(text.navigate)}"
	data-selected="${escapeAttr(text.selected)}">
	<header class="toolbar">
		<div class="menu-wrap">
			<button type="button" id="browser-menu" aria-haspopup="menu" aria-expanded="false">${escapeText(text.menu)}</button>
			<div id="browser-menu-panel" class="menu-panel" role="menu">
				<button type="button" role="menuitemradio" data-mode="select" aria-checked="true">${escapeText(text.selectElement)}</button>
				<button type="button" role="menuitemradio" data-mode="navigate" aria-checked="false">${escapeText(text.navigate)}</button>
				<button type="button" role="menuitem" data-action="reload">${escapeText(text.reload)}</button>
			</div>
		</div>
		<span class="mode" id="mode">${escapeText(text.selectElement)}</span>
		<span class="file" id="file"></span>
		<span class="selection" id="selection"></span>
		<span class="live"><i></i>${escapeText(text.live)}</span>
	</header>
	<div class="stage">
		<p class="empty" id="empty">${escapeText(text.empty)}</p>
		<iframe id="preview" title="${escapeAttr(text.frameTitle)}" hidden></iframe>
	</div>
	<script nonce="${nonce}">
		const vscode = acquireVsCodeApi();
		const body = document.body;
		const selectLabel = body.dataset.select;
		const navigateLabel = body.dataset.navigate;
		const selectedLabel = body.dataset.selected;
		const menuButton = document.getElementById('browser-menu');
		const panel = document.getElementById('browser-menu-panel');
		const modeLabel = document.getElementById('mode');
		const fileLabel = document.getElementById('file');
		const selection = document.getElementById('selection');
		const empty = document.getElementById('empty');
		const iframe = document.getElementById('preview');
		let mode = 'select';
		let hovered = null;
		let scrollX = 0;
		let scrollY = 0;

		function rememberScroll() {
			try {
				scrollX = iframe.contentWindow ? iframe.contentWindow.scrollX : 0;
				scrollY = iframe.contentWindow ? iframe.contentWindow.scrollY : 0;
			} catch (error) {
				scrollX = 0;
				scrollY = 0;
			}
		}

		function closeMenu() {
			panel.classList.remove('open');
			menuButton.setAttribute('aria-expanded', 'false');
		}

		function describe(el) {
			if (!el || !el.tagName) return '';
			const tag = el.tagName.toLowerCase();
			if (tag === 'html' || tag === 'body') return tag;
			const id = el.id ? '#' + el.id : '';
			const classes = Array.from(el.classList || []).filter(name => name !== 'kuunda-preview-hover').map(name => '.' + name).join('');
			return tag + id + classes;
		}

		function applyMode(doc) {
			doc.documentElement.classList.toggle('kuunda-select-mode', mode === 'select');
		}

		function arm() {
			const doc = iframe.contentDocument;
			if (!doc || !doc.documentElement || doc.documentElement.dataset.kuundaArmed === '1') return;
			doc.documentElement.dataset.kuundaArmed = '1';
			applyMode(doc);
			doc.addEventListener('mouseover', event => {
				if (mode !== 'select') return;
				const target = event.target;
				if (!target || !target.classList || target === doc.documentElement || target === doc.body) return;
				if (hovered && hovered !== target) hovered.classList.remove('kuunda-preview-hover');
				hovered = target;
				target.classList.add('kuunda-preview-hover');
			}, true);
			doc.addEventListener('click', event => {
				const target = event.target && event.target.nodeType === 1 ? event.target : (event.target && event.target.parentElement);
				const anchor = target && target.closest ? target.closest('a[href]') : null;
				if (mode === 'select') {
					event.preventDefault();
					event.stopPropagation();
					selection.textContent = target ? (selectedLabel + ' ' + describe(target)) : '';
					return;
				}
				if (!anchor) return;
				const href = anchor.getAttribute('href');
				if (!href || href.startsWith('#')) return;
				event.preventDefault();
				vscode.postMessage({ type: 'open', href });
			}, true);
		}

		function setMode(next) {
			mode = next;
			modeLabel.textContent = next === 'select' ? selectLabel : navigateLabel;
			panel.querySelector('[data-mode="select"]').setAttribute('aria-checked', next === 'select' ? 'true' : 'false');
			panel.querySelector('[data-mode="navigate"]').setAttribute('aria-checked', next === 'navigate' ? 'true' : 'false');
			const doc = iframe.contentDocument;
			if (doc) applyMode(doc);
			vscode.postMessage({ type: 'mode', mode: next });
			closeMenu();
		}

		menuButton.addEventListener('click', event => {
			event.stopPropagation();
			panel.classList.toggle('open');
			menuButton.setAttribute('aria-expanded', panel.classList.contains('open') ? 'true' : 'false');
		});
		panel.addEventListener('click', event => {
			const item = event.target.closest('button');
			if (!item) return;
			if (item.dataset.mode) setMode(item.dataset.mode);
			if (item.dataset.action === 'reload') {
				closeMenu();
				vscode.postMessage({ type: 'reload' });
			}
		});
		document.addEventListener('click', event => {
			if (!menuButton.parentElement.contains(event.target)) closeMenu();
		});
		document.addEventListener('keydown', event => {
			if (event.key === 'Escape') closeMenu();
		});
		window.addEventListener('message', event => {
			const message = event.data;
			if (!message || message.type !== 'render') return;
			fileLabel.textContent = message.file || '';
			selection.textContent = '';
			hovered = null;
			if (!message.html) {
				iframe.hidden = true;
				iframe.removeAttribute('srcdoc');
				empty.hidden = false;
				return;
			}
			empty.hidden = true;
			iframe.hidden = false;
			rememberScroll();
			iframe.onload = () => {
				arm();
				try {
					iframe.contentWindow.scrollTo(scrollX, scrollY);
				} catch (error) {
					/* The preview document controls its own scroll. */
				}
			};
			iframe.srcdoc = message.html;
		});
		vscode.postMessage({ type: 'ready', mode });
	</script>
</body>
</html>`;
}

function escapeText(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(value: string): string {
	return escapeText(value).replace(/"/g, '&quot;');
}
