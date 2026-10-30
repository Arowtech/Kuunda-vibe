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
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { asWebviewUri, webviewGenericCspSource } from '../../webview/common/webview.js';
import { IWebviewWorkbenchService } from '../../webviewPanel/browser/webviewWorkbenchService.js';
import { WebviewInput } from '../../webviewPanel/browser/webviewEditorInput.js';
import { IChatThreadService } from '../../void/browser/chatThreadService.js';
import { VOID_VIEW_CONTAINER_ID } from '../../void/browser/sidebarPane.js';
import { kuundaPreviewLocalize } from '../common/kuundaPreviewNls.js';
import { buildPreviewHtml, collectLocalAssets, findElementRange, isLivePreviewPath, isLocalPreviewUrl, pickPreviewEntry, PREVIEW_ENTRY_CANDIDATES } from '../common/previewDocument.js';
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
	private history: URI[] = [];
	private historyIndex = -1;

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
		@IModelService private readonly modelService: IModelService,
		@IWebviewWorkbenchService private readonly webviewWorkbenchService: IWebviewWorkbenchService,
		@IEditorGroupsService private readonly editorGroupsService: IEditorGroupsService,
		@INotificationService private readonly notificationService: INotificationService,
		@IChatThreadService private readonly chatThreadService: IChatThreadService,
		@IViewsService private readonly viewsService: IViewsService,
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
		const title = kuundaPreviewLocalize('kuunda.preview.title');
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
			back: kuundaPreviewLocalize('kuunda.preview.back'),
			forward: kuundaPreviewLocalize('kuunda.preview.forward'),
			reload: kuundaPreviewLocalize('kuunda.preview.reload'),
			address: kuundaPreviewLocalize('kuunda.preview.address'),
			selectElement: kuundaPreviewLocalize('kuunda.preview.selectElement'),
			selectHint: kuundaPreviewLocalize('kuunda.preview.selectHint'),
			picked: kuundaPreviewLocalize('kuunda.preview.picked'),
			pickFailed: kuundaPreviewLocalize('kuunda.preview.pickFailed'),
			empty: kuundaPreviewLocalize('kuunda.preview.empty'),
			frameTitle: kuundaPreviewLocalize('kuunda.preview.title'),
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

	private async onMessage(message: { type?: string; href?: string; tag?: string; id?: string; classes?: string; text?: string; marker?: string }): Promise<void> {
		if (message?.type === 'ready') {
			this.ready = true;
			await this.render();
			return;
		}
		if (message?.type === 'reload') {
			await this.render();
			return;
		}
		if (message?.type === 'back') {
			await this.go(-1);
			return;
		}
		if (message?.type === 'forward') {
			await this.go(1);
			return;
		}
		if (message?.type === 'element') {
			await this.addElementToChat(message);
			return;
		}
		if (message?.type === 'open' && typeof message.href === 'string') {
			const next = this.resolveLocal(message.href, true);
			if (next) {
				this.note(next);
				await this.render();
			} else {
				await this.postNav();
			}
		}
	}

	private async go(step: -1 | 1): Promise<void> {
		const next = this.historyIndex + step;
		if (next < 0 || next >= this.history.length) {
			return;
		}
		this.historyIndex = next;
		this.current = this.history[next];
		await this.render();
	}

	private async addElementToChat(message: { tag?: string; id?: string; classes?: string; text?: string; marker?: string }): Promise<void> {
		const file = this.current;
		const raw = file ? await this.readText(file) : undefined;
		const range = file && raw ? findElementRange(raw, {
			id: typeof message.id === 'string' ? message.id.slice(0, 200) : '',
			tag: typeof message.tag === 'string' ? message.tag : '',
			classes: typeof message.classes === 'string' ? message.classes.slice(0, 400) : '',
			text: typeof message.text === 'string' ? message.text.slice(0, 80) : '',
			marker: typeof message.marker === 'string' ? message.marker.slice(0, 160) : '',
		}) : undefined;
		if (!file || !range) {
			await this.postPicked(false);
			return;
		}
		try {
			const threadId = this.chatThreadService.state.currentThreadId;
			if (!threadId || !this.chatThreadService.state.allThreads[threadId]) {
				this.chatThreadService.openNewThread();
			}
			this.chatThreadService.addNewStagingSelection({
				type: 'CodeSelection',
				uri: file,
				language: this.modelService.getModel(file)?.getLanguageId() || 'html',
				range,
				state: { wasAddedAsCurrentFile: false },
			});
			await this.viewsService.openViewContainer(VOID_VIEW_CONTAINER_ID, true);
			await this.chatThreadService.focusCurrentChat();
			await this.postPicked(true);
		} catch {
			await this.postPicked(false);
		}
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
			await this.input.webview.postMessage({ type: 'render', html: null, ...this.navState() });
			return;
		}
		const raw = await this.readText(current);
		if (token !== this.renderToken || !this.input) {
			return;
		}
		if (raw === undefined) {
			this.assetUris = [];
			await this.input.webview.postMessage({ type: 'render', html: null, ...this.navState() });
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
			...this.navState(),
		});
	}

	private navState(): { canBack: boolean; canForward: boolean; file: string } {
		return {
			canBack: this.historyIndex > 0,
			canForward: this.historyIndex >= 0 && this.historyIndex < this.history.length - 1,
			file: this.current ? this.displayPath(this.current) : '',
		};
	}

	private async postNav(): Promise<void> {
		await this.input?.webview.postMessage({ type: 'nav', ...this.navState() });
	}

	private async postPicked(ok: boolean): Promise<void> {
		await this.input?.webview.postMessage({ type: 'picked', ok });
	}

	private seed(uri: URI): void {
		if (this.historyIndex < 0) {
			this.history = [uri];
			this.historyIndex = 0;
		} else if (this.history[this.historyIndex]?.toString() !== uri.toString()) {
			this.history[this.historyIndex] = uri;
		}
		this.current = uri;
	}

	private note(uri: URI): void {
		const current = this.history[this.historyIndex];
		if (current?.toString() === uri.toString()) {
			this.current = uri;
			return;
		}
		this.history = this.history.slice(0, Math.max(this.historyIndex, -1) + 1);
		this.history.push(uri);
		this.historyIndex = this.history.length - 1;
		this.current = uri;
	}

	private displayPath(uri: URI): string {
		const folder = this.workspaceContextService.getWorkspaceFolder(uri);
		if (!folder) {
			return uri.path;
		}
		const relative = uri.path.slice(folder.uri.path.length) || '/';
		return relative.startsWith('/') ? relative : `/${relative}`;
	}

	private async ensureCurrent(): Promise<URI | undefined> {
		if (this.current && await this.stillThere(this.current)) {
			this.seed(this.current);
			return this.current;
		}
		for (const folder of this.workspaceContextService.getWorkspace().folders) {
			const entry = await this.findEntry(folder.uri);
			if (entry) {
				this.seed(entry);
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
