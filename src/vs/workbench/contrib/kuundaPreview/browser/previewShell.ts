/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

export interface PreviewShellText {
	readonly back: string;
	readonly forward: string;
	readonly reload: string;
	readonly address: string;
	readonly selectElement: string;
	readonly selectHint: string;
	readonly picked: string;
	readonly pickFailed: string;
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
		html, body { position: fixed; inset: 0; width: 100%; height: 100%; margin: 0; padding: 0 !important; overflow: hidden; box-sizing: border-box; scrollbar-width: none; }
		html::-webkit-scrollbar, body::-webkit-scrollbar { width: 0; height: 0; display: none; }
		body { display: flex; flex-direction: column; background: var(--vscode-editor-background); color: var(--vscode-foreground); font-family: var(--vscode-font-family); font-size: 13px; }
		img, video { max-width: none; max-height: none; }
		[hidden] { display: none !important; }
		.chrome { flex: 0 0 40px; display: flex; align-items: center; gap: 2px; height: 40px; padding: 0 8px; background: var(--vscode-editorGroupHeader-tabsBackground, var(--vscode-sideBar-background)); border-bottom: 1px solid var(--vscode-widget-border, var(--vscode-panel-border)); }
		.icon-btn { width: 28px; height: 28px; display: inline-flex; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 6px; background: transparent; color: var(--vscode-icon-foreground, var(--vscode-foreground)); cursor: pointer; }
		.icon-btn svg { width: 16px; height: 16px; display: block; }
		.icon-btn:hover:not(:disabled) { background: var(--vscode-toolbar-hoverBackground); }
		.icon-btn:disabled { opacity: .35; cursor: default; }
		.icon-btn:focus-visible, .address:focus-visible { outline: 1px solid var(--vscode-focusBorder); outline-offset: 1px; }
		.icon-btn.on { background: var(--vscode-toolbar-activeBackground, var(--vscode-toolbar-hoverBackground)); color: var(--vscode-button-background, var(--vscode-foreground)); }
		.address-form { flex: 1; min-width: 0; display: flex; margin: 0 6px; }
		.address { width: 100%; height: 26px; box-sizing: border-box; border: 1px solid var(--vscode-input-border, transparent); border-radius: 6px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); padding: 0 10px; font: 12px/26px var(--vscode-font-family); }
		.hint { margin: 0; padding: 5px 12px; font-size: 12px; line-height: 16px; color: var(--vscode-descriptionForeground); background: var(--vscode-editorWidget-background); border-bottom: 1px solid var(--vscode-widget-border, var(--vscode-panel-border)); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
		.stage { position: relative; flex: 1 1 auto; min-width: 0; min-height: 0; overflow: hidden; background: #fff; }
		iframe { position: absolute; inset: 0; width: 100%; height: 100%; border: 0; display: block; background: #fff; }
		.empty { margin: 0; padding: 24px; color: var(--vscode-descriptionForeground); }
	</style>
</head>
<body
	data-hint="${escapeAttr(text.selectHint)}"
	data-picked="${escapeAttr(text.picked)}"
	data-failed="${escapeAttr(text.pickFailed)}">
	<header class="chrome">
		<button type="button" class="icon-btn" id="back" title="${escapeAttr(text.back)}" aria-label="${escapeAttr(text.back)}" disabled>${iconBack()}</button>
		<button type="button" class="icon-btn" id="forward" title="${escapeAttr(text.forward)}" aria-label="${escapeAttr(text.forward)}" disabled>${iconForward()}</button>
		<button type="button" class="icon-btn" id="reload" title="${escapeAttr(text.reload)}" aria-label="${escapeAttr(text.reload)}">${iconReload()}</button>
		<form id="address-form" class="address-form">
			<input id="address" class="address" type="text" spellcheck="false" autocomplete="off" aria-label="${escapeAttr(text.address)}">
		</form>
		<button type="button" class="icon-btn" id="select-element" title="${escapeAttr(text.selectElement)}" aria-label="${escapeAttr(text.selectElement)}" aria-pressed="false">${iconSelect()}</button>
	</header>
	<p class="hint" id="hint" hidden></p>
	<div class="stage">
		<p class="empty" id="empty">${escapeText(text.empty)}</p>
		<iframe id="preview" title="${escapeAttr(text.frameTitle)}" hidden></iframe>
	</div>
	<script nonce="${nonce}">
		const vscode = acquireVsCodeApi();
		const hintLabel = document.body.dataset.hint;
		const pickedLabel = document.body.dataset.picked;
		const failedLabel = document.body.dataset.failed;
		const back = document.getElementById('back');
		const forward = document.getElementById('forward');
		const reload = document.getElementById('reload');
		const selectButton = document.getElementById('select-element');
		const addressForm = document.getElementById('address-form');
		const address = document.getElementById('address');
		const hint = document.getElementById('hint');
		const empty = document.getElementById('empty');
		const iframe = document.getElementById('preview');
		let mode = 'navigate';
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

		function describe(el) {
			if (!el || !el.tagName) return '';
			const tag = el.tagName.toLowerCase();
			if (tag === 'html' || tag === 'body') return tag;
			const id = el.id ? '#' + el.id : '';
			const classes = classNames(el).map(name => '.' + name).join('');
			return tag + id + classes;
		}

		function markerOf(el) {
			if (!el || !el.getAttribute) return '';
			const names = ['src', 'href', 'alt', 'aria-label', 'name', 'placeholder'];
			for (const name of names) {
				const value = el.getAttribute(name);
				if (!value || value.length < 2 || value.length > 160) continue;
				const clean = value.split('?')[0].split('#')[0];
				if (clean && clean.indexOf('kuundaPreview') < 0) return clean.slice(0, 120);
			}
			return '';
		}

		function classNames(el) {
			const raw = el.getAttribute ? (el.getAttribute('class') || '') : '';
			return raw.split(/\\s+/).filter(name => name && name !== 'kuunda-preview-hover');
		}

		function applyMode(doc) {
			doc.documentElement.classList.toggle('kuunda-select-mode', mode === 'select');
		}

		function showHint(text) {
			hint.hidden = !text;
			hint.textContent = text || '';
		}

		function setMode(next) {
			mode = next;
			const on = next === 'select';
			selectButton.setAttribute('aria-pressed', on ? 'true' : 'false');
			selectButton.classList.toggle('on', on);
			showHint(on ? hintLabel : '');
			const doc = iframe.contentDocument;
			if (doc) applyMode(doc);
			if (hovered) {
				hovered.classList.remove('kuunda-preview-hover');
				hovered = null;
			}
		}

		function arm() {
			const doc = iframe.contentDocument;
			if (!doc || !doc.documentElement || doc.documentElement.dataset.kuundaArmed === '1') return;
			doc.documentElement.dataset.kuundaArmed = '1';
			applyMode(doc);
			doc.addEventListener('keydown', event => {
				if (event.key === 'Escape' && mode === 'select') {
					event.preventDefault();
					setMode('navigate');
				}
			}, true);
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
					if (!target || target === doc.documentElement || target === doc.body) return;
					event.preventDefault();
					event.stopPropagation();
					showHint(describe(target));
					vscode.postMessage({
						type: 'element',
						tag: target.tagName.toLowerCase(),
						id: target.id || '',
						classes: classNames(target).join(' '),
						text: (target.innerText || target.textContent || '').replace(/\\s+/g, ' ').trim().slice(0, 80),
						marker: markerOf(target)
					});
					return;
				}
				if (!anchor) return;
				const href = anchor.getAttribute('href');
				if (!href || href.startsWith('#')) return;
				event.preventDefault();
				vscode.postMessage({ type: 'open', href });
			}, true);
		}

		function applyNav(message) {
			back.disabled = !message.canBack;
			forward.disabled = !message.canForward;
			if (document.activeElement !== address && typeof message.file === 'string') address.value = message.file;
		}

		back.addEventListener('click', () => vscode.postMessage({ type: 'back' }));
		forward.addEventListener('click', () => vscode.postMessage({ type: 'forward' }));
		reload.addEventListener('click', () => vscode.postMessage({ type: 'reload' }));
		selectButton.addEventListener('click', () => setMode(mode === 'select' ? 'navigate' : 'select'));
		addressForm.addEventListener('submit', event => {
			event.preventDefault();
			const href = address.value.trim();
			if (href) vscode.postMessage({ type: 'open', href });
		});
		document.addEventListener('keydown', event => {
			if (event.key === 'Escape' && mode === 'select') setMode('navigate');
		});
		window.addEventListener('message', event => {
			const message = event.data;
			if (!message) return;
			if (message.type === 'nav') {
				applyNav(message);
				return;
			}
			if (message.type === 'picked') {
				showHint(message.ok ? pickedLabel : failedLabel);
				return;
			}
			if (message.type !== 'render') return;
			applyNav(message);
			if (hovered) hovered = null;
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
		vscode.postMessage({ type: 'ready' });
	</script>
</body>
</html>`;
}

function iconBack(): string {
	return '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3.5 5.5 8 10 12.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

function iconForward(): string {
	return '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

function iconReload(): string {
	return '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 8a5 5 0 1 1-1.4-3.4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/><path d="M12.8 2.2v3.1H9.7" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
}

function iconSelect(): string {
	return '<svg viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M3.2 1.6 13 7.4l-4.1.8 2.5 4.6-1.7.9-2.5-4.6-3.4 2.8z"/></svg>';
}

function escapeText(value: string): string {
	return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttr(value: string): string {
	return escapeText(value).replace(/"/g, '&quot;');
}
