/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import { Disposable, DisposableStore, MutableDisposable } from '../../../../base/common/lifecycle.js';
import { dirname, isEqualOrParent } from '../../../../base/common/resources.js';
import { URI } from '../../../../base/common/uri.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { ITextModel } from '../../../../editor/common/model.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { FileChangesEvent, IFileService } from '../../../../platform/files/common/files.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { SIDE_GROUP } from '../../../services/editor/common/editorService.js';
import { asWebviewUri, webviewGenericCspSource } from '../../webview/common/webview.js';
import { IWebviewWorkbenchService } from '../../webviewPanel/browser/webviewWorkbenchService.js';
import { WebviewInput } from '../../webviewPanel/browser/webviewEditorInput.js';
import { kuundaPreviewLocalize } from '../common/kuundaPreviewNls.js';
import { buildPreviewHtml, collectLocalAssets, isLivePreviewPath, isLocalPreviewUrl, pickPreviewEntry, PREVIEW_ENTRY_CANDIDATES } from '../common/previewDocument.js';
import { previewShellHtml } from './previewShell.js';

export interface IKuundaPreviewService {
	readonly _serviceBrand: undefined;
	open(options?: { readonly preserveFocus?: boolean; readonly auto?: boolean }): Promise<void>;
}

export const IKuundaPreviewService = createDecorator<IKuundaPreviewService>('kuundaPreviewService');

const VIEW_TYPE = 'kuunda.preview';

export class KuundaPreviewService extends Disposable implements IKuundaPreviewService {
	declare readonly _serviceBrand: undefined;

	private readonly session = this._register(new MutableDisposable<DisposableStore>());
	private input: WebviewInput | undefined;
	private current: URI | undefined;
	private assetUris: URI[] = [];
	private ready = false;
	private autoOpened = false;
	private listening = false;
	private hooked = new Set<string>();
	private nonce = generateUuid();
	private renderToken = 0;
	private timer: ReturnType<typeof setTimeout> | undefined;
	private mode: 'select' | 'navigate' = 'select';

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
		@IModelService private readonly modelService: IModelService,
		@IWebviewWorkbenchService private readonly webviewWorkbenchService: IWebviewWorkbenchService,
		@IEditorGroupsService private readonly editorGroupsService: IEditorGroupsService,
		@INotificationService private readonly notificationService: INotificationService,
	) {
		super();
	}

	async open(options?: { readonly preserveFocus?: boolean; readonly auto?: boolean }): Promise<void> {
		if (options?.auto && this.autoOpened) {
			return;
		}
		const folders = this.workspaceContextService.getWorkspace().folders;
		if (!folders.length) {
			if (!options?.auto) {
				this.notificationService.info(kuundaPreviewLocalize('kuunda.preview.noFolder'));
			}
			return;
		}
		this.autoOpened = true;
		const preserveFocus = options?.preserveFocus ?? false;
		if (this.input && !this.input.isDisposed()) {
			this.reveal(preserveFocus);
			await this.render();
			return;
		}
		const title = this.titleFor(this.mode);
		this.ready = false;
		this.nonce = generateUuid();
		this.input = this.webviewWorkbenchService.openWebview({
			providedViewType: VIEW_TYPE,
			title,
			options: { retainContextWhenHidden: true },
			contentOptions: this.contentOptions(),
			extension: undefined,
		}, VIEW_TYPE, title, { group: SIDE_GROUP, preserveFocus });
		this.input.setName(title);
		this.ensureListeners();
		const input = this.input;
		const store = new DisposableStore();
		this.session.value = store;
		store.add(input.onWillDispose(() => {
			if (this.input === input) {
				this.input = undefined;
				this.ready = false;
				this.assetUris = [];
			}
		}));
		store.add(input.webview.onMessage(event => {
			void this.onMessage(event.message);
		}));
		input.webview.setHtml(previewShellHtml({
			menu: kuundaPreviewLocalize('kuunda.preview.menu'),
			selectElement: kuundaPreviewLocalize('kuunda.preview.selectElement'),
			navigate: kuundaPreviewLocalize('kuunda.preview.navigate'),
			reload: kuundaPreviewLocalize('kuunda.preview.reload'),
			live: kuundaPreviewLocalize('kuunda.preview.live'),
			selected: kuundaPreviewLocalize('kuunda.preview.selected'),
			empty: kuundaPreviewLocalize('kuunda.preview.empty'),
			frameTitle: kuundaPreviewLocalize('kuunda.preview.selectElement'),
		}, this.nonce, webviewGenericCspSource));
	}

	private contentOptions() {
		return {
			allowScripts: true,
			allowForms: true,
			localResourceRoots: this.workspaceContextService.getWorkspace().folders.map(folder => folder.uri),
		};
	}

	private ensureListeners(): void {
		if (this.listening) {
			return;
		}
		this.listening = true;
		this._register(this.fileService.onDidFilesChange(event => this.onFiles(event)));
		this._register(this.modelService.onModelAdded(model => this.hookModel(model)));
		for (const model of this.modelService.getModels()) {
			this.hookModel(model);
		}
	}

	private hookModel(model: ITextModel): void {
		const key = model.uri.toString();
		if (this.hooked.has(key) || !this.isPreviewResource(model.uri)) {
			return;
		}
		this.hooked.add(key);
		this._register(model.onDidChangeContent(() => this.schedule()));
		this._register(model.onWillDispose(() => this.hooked.delete(key)));
	}

	private isPreviewResource(uri: URI): boolean {
		const path = uri.path;
		if (!isLivePreviewPath(path) || path.includes('/node_modules/') || path.includes('/.git/')) {
			return false;
		}
		return !!this.workspaceContextService.getWorkspaceFolder(uri);
	}

	private onFiles(event: FileChangesEvent): void {
		if (!this.input) {
			return;
		}
		const watched = this.current ? [this.current, ...this.assetUris] : this.assetUris;
		if (watched.some(uri => event.contains(uri))) {
			this.schedule();
		}
	}

	private schedule(): void {
		if (!this.input) {
			return;
		}
		if (this.timer) {
			clearTimeout(this.timer);
		}
		this.timer = setTimeout(() => {
			this.timer = undefined;
			void this.render();
		}, 200);
	}

	private async onMessage(message: { type?: string; href?: string; mode?: string }): Promise<void> {
		if (message?.type === 'ready') {
			this.ready = true;
			this.mode = 'select';
			this.applyTitle();
			await this.render();
			return;
		}
		if (message?.type === 'reload') {
			await this.render();
			return;
		}
		if (message?.type === 'mode' && (message.mode === 'select' || message.mode === 'navigate')) {
			this.mode = message.mode;
			this.applyTitle();
			return;
		}
		if (message?.type === 'open' && typeof message.href === 'string') {
			const next = this.resolveLocal(message.href, true);
			if (next) {
				this.current = next;
				await this.render();
			}
		}
	}

	private applyTitle(): void {
		const title = this.titleFor(this.mode);
		this.input?.setName(title);
	}

	private titleFor(mode: 'select' | 'navigate'): string {
		const tool = mode === 'select'
			? kuundaPreviewLocalize('kuunda.preview.selectElement')
			: kuundaPreviewLocalize('kuunda.preview.navigate');
		return kuundaPreviewLocalize('kuunda.preview.titleMode', tool);
	}

	private reveal(preserveFocus: boolean): void {
		if (!this.input) {
			return;
		}
		const group = this.editorGroupsService.groups.find(candidate => candidate.contains(this.input!));
		this.webviewWorkbenchService.revealWebview(this.input, group ?? SIDE_GROUP, preserveFocus);
	}

	private async render(): Promise<void> {
		if (!this.ready || !this.input || this.input.isDisposed()) {
			return;
		}
		const token = ++this.renderToken;
		this.input.webview.contentOptions = this.contentOptions();
		const current = await this.ensureCurrent();
		if (token !== this.renderToken || !this.input) {
			return;
		}
		if (!current) {
			this.assetUris = [];
			await this.input.webview.postMessage({ type: 'render', html: null, file: '' });
			return;
		}
		const raw = await this.readText(current);
		if (token !== this.renderToken || !this.input) {
			return;
		}
		if (raw === undefined) {
			this.assetUris = [];
			await this.input.webview.postMessage({ type: 'render', html: null, file: '' });
			return;
		}
		const assets = collectLocalAssets(raw);
		const styles: Record<string, string> = {};
		const scripts: Record<string, string> = {};
		const assetUris: URI[] = [];
		for (const href of assets.styles) {
			const uri = this.resolveLocal(href, false);
			if (!uri) {
				continue;
			}
			assetUris.push(uri);
			const css = await this.readText(uri);
			if (css !== undefined) {
				styles[href] = css;
			}
		}
		for (const src of assets.scripts) {
			const uri = this.resolveLocal(src, false);
			if (!uri) {
				continue;
			}
			assetUris.push(uri);
			const code = await this.readText(uri);
			if (code !== undefined) {
				scripts[src] = code;
			}
		}
		if (token !== this.renderToken || !this.input) {
			return;
		}
		this.assetUris = assetUris;
		const html = buildPreviewHtml({
			html: raw,
			baseHref: this.baseHref(current),
			nonce: this.nonce,
			version: String(Date.now()),
			styles,
			scripts,
		});
		await this.input.webview.postMessage({
			type: 'render',
			html,
			file: current.path.split('/').pop() ?? '',
		});
	}

	private async ensureCurrent(): Promise<URI | undefined> {
		if (this.current && await this.stillThere(this.current)) {
			return this.current;
		}
		for (const folder of this.workspaceContextService.getWorkspace().folders) {
			const entry = await this.findEntry(folder.uri);
			if (entry) {
				this.current = entry;
				return entry;
			}
		}
		this.current = undefined;
		return undefined;
	}

	private async findEntry(folder: URI): Promise<URI | undefined> {
		const existing: string[] = [];
		for (const relative of PREVIEW_ENTRY_CANDIDATES) {
			const uri = URI.joinPath(folder, ...relative.split('/'));
			if (await this.fileService.exists(uri)) {
				existing.push(relative);
			}
		}
		try {
			const stat = await this.fileService.resolve(folder);
			for (const child of stat.children ?? []) {
				if (!child.isDirectory && /\.html?$/i.test(child.name)) {
					existing.push(child.name);
				}
			}
		} catch {
			// Preferred filenames above still work when the folder cannot be listed.
		}
		const picked = pickPreviewEntry(existing);
		return picked ? URI.joinPath(folder, ...picked.split('/')) : undefined;
	}

	private async stillThere(uri: URI): Promise<boolean> {
		if (this.modelService.getModel(uri)) {
			return true;
		}
		try {
			return await this.fileService.exists(uri);
		} catch {
			return false;
		}
	}

	private async readText(uri: URI): Promise<string | undefined> {
		const model = this.modelService.getModel(uri);
		if (model) {
			return model.getValue();
		}
		try {
			return (await this.fileService.readFile(uri)).value.toString();
		} catch {
			return undefined;
		}
	}

	private resolveLocal(raw: string, htmlOnly: boolean): URI | undefined {
		if (!this.current || !isLocalPreviewUrl(raw)) {
			return undefined;
		}
		const clean = raw.trim().split('#')[0].split('?')[0];
		if (htmlOnly && !/\.html?$/i.test(clean)) {
			return undefined;
		}
		const folder = this.workspaceContextService.getWorkspaceFolder(this.current)?.uri;
		if (!folder) {
			return undefined;
		}
		const base = clean.startsWith('/') ? folder : dirname(this.current);
		const relative = clean.replace(/^\/+/, '');
		const target = URI.joinPath(base, ...relative.split('/'));
		return isEqualOrParent(target, folder) ? target : undefined;
	}

	private baseHref(file: URI): string {
		const href = asWebviewUri(dirname(file)).toString(true);
		return href.endsWith('/') ? href : `${href}/`;
	}

	override dispose(): void {
		if (this.timer) {
			clearTimeout(this.timer);
		}
		super.dispose();
	}
}

registerSingleton(IKuundaPreviewService, KuundaPreviewService, InstantiationType.Delayed);
