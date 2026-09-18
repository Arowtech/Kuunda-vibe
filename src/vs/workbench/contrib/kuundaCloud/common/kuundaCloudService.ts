/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { URI } from '../../../../base/common/uri.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { dirname, joinPath } from '../../../../base/common/resources.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IKuundaAccountService } from '../../kuundaAccount/common/kuundaAccountService.js';
import { IKuundaProjectService } from '../../kuundaProject/common/kuundaProjectService.js';
import { PROJECT_MANIFEST_PATH, type ProjectManifest } from '../../kuundaProject/common/projectType.js';
import {
	CLOUD_CLIENT_PATH,
	CLOUD_ENV_PATH,
	CLOUD_LOCAL_PATH,
	DEFAULT_API_BASE_URL,
	decideCloudProvisioning,
	formatCloudContext,
	formatCloudPanel,
	mergeGitignore,
	parseCloudSettings,
	persistableAnonKey,
	publicCloudRecord,
	redactCloudPayload,
	resolveCloudRecordAfterDecision,
	sanitizeProjectRef,
	scaffoldCloudFiles,
	serializeManifestWithCloud,
	type CloudFile,
	type CloudRecord,
	type CloudTable,
} from './cloudProvision.js';
import { classifyNetworkError, fetchWithTimeout } from '../../kuundaAi/common/networkPolicy.js';
import { IKuundaLegalService } from '../../kuundaLegal/common/kuundaLegalService.js';

export type CloudProvisionInput = {
	type?: string;
	name?: string;
	enabled?: boolean;
	replace?: boolean;
};

export type CloudProvisionResult = {
	ok: true;
	action: 'skip' | 'reuse' | 'pending_user' | 'pending_api' | 'provision';
	cloud: CloudRecord;
	tables: CloudTable[];
	network?: 'timeout' | 'offline';
} | { ok: false; error: string };

export type CloudPublicStatus = {
	available: true;
	enabled: boolean;
	projectRef?: string;
	env?: string;
	action?: string;
};

export interface IKuundaCloudService {
	readonly _serviceBrand: undefined;
	readonly onDidChange: Event<void>;
	provisionFolder(folder: URI, input?: CloudProvisionInput): Promise<CloudProvisionResult>;
	setEnabled(folder: URI, enabled: boolean): Promise<CloudProvisionResult>;
	replace(folder: URI): Promise<CloudProvisionResult>;
	needsStudioLink(): Promise<boolean>;
	retryUnlinkedFolders(): Promise<CloudProvisionResult[]>;
	formatPanel(): Promise<string>;
	formatContext(): Promise<string>;
	lastPublicStatus(): CloudPublicStatus;
}

export const IKuundaCloudService = createDecorator<IKuundaCloudService>('kuundaCloudService');

type ProvisionApiResult = {
	projectId?: string;
	kuundaProjectRef?: string;
	env?: string;
	url?: string;
	anonKey?: string;
	tables?: CloudTable[];
};

export class KuundaCloudService extends Disposable implements IKuundaCloudService {
	declare readonly _serviceBrand: undefined;

	private snapshot: CloudPublicStatus = { available: true, enabled: true };
	private tables: CloudTable[] = [];
	private readonly inflight = new Map<string, Promise<CloudProvisionResult>>();
	private retryChain: Promise<CloudProvisionResult[]> = Promise.resolve([]);
	private readonly _onDidChange = this._register(new Emitter<void>());
	readonly onDidChange = this._onDidChange.event;

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IKuundaProjectService private readonly projectService: IKuundaProjectService,
		@IKuundaAccountService private readonly accountService: IKuundaAccountService,
		@IKuundaLegalService private readonly legalService: IKuundaLegalService,
	) {
		super();
		void this.refreshSnapshot();
		this._register(this.accountService.onDidChangeSession(() => {
			void this.refreshSnapshot();
		}));
	}

	lastPublicStatus(): CloudPublicStatus {
		return { ...this.snapshot };
	}

	async formatContext(): Promise<string> {
		const rows = await this.projectService.listWorkspaceManifests();
		return rows.map((row) => formatCloudContext(parseCloudSettings(row.manifest))).filter(Boolean).join('\n');
	}

	async formatPanel(): Promise<string> {
		const target = await this.primaryFolder();
		if (!target) {
			return formatCloudPanel({ cloud: { enabled: true }, tables: [] });
		}
		const state = await this.readState(target.folder);
		let tables = this.tables;
		if (state.cloud.projectRef) {
			tables = this.safeTables(await this.fetchTables(state.cloud.projectRef)) ?? tables;
			this.tables = tables;
		}
		this.remember(state.cloud, this.actionFor(state.cloud), tables);
		return formatCloudPanel({ cloud: state.cloud, tables });
	}

	async needsStudioLink(): Promise<boolean> {
		if (!this.legalService.decideSend('kuunda_cloud').ok) {
			return false;
		}
		if (await this.hasLiveSession()) {
			return false;
		}
		const rows = await this.projectService.listWorkspaceManifests();
		return rows.some((row) => {
			const cloud = parseCloudSettings(row.manifest);
			return cloud.enabled !== false && !cloud.projectRef;
		});
	}

	async retryUnlinkedFolders(): Promise<CloudProvisionResult[]> {
		const run = this.retryChain.then(() => this.retryUnlinkedFoldersNow(), () => this.retryUnlinkedFoldersNow());
		this.retryChain = run.then(() => [], () => []);
		return run;
	}

	private async retryUnlinkedFoldersNow(): Promise<CloudProvisionResult[]> {
		if (!(await this.hasLiveSession())) {
			return [];
		}
		const rows = await this.projectService.listWorkspaceManifests();
		const results: CloudProvisionResult[] = [];
		for (const row of rows) {
			const cloud = parseCloudSettings(row.manifest);
			if (cloud.enabled === false || cloud.projectRef) {
				continue;
			}
			results.push(await this.provisionFolder(row.folder, {
				enabled: true,
				type: row.manifest.type,
				name: row.manifest.name,
			}));
		}
		return results;
	}

	async setEnabled(folder: URI, enabled: boolean): Promise<CloudProvisionResult> {
		if (!enabled) {
			const state = await this.readState(folder);
			if (!state.manifest) {
				return { ok: false, error: 'write_failed' };
			}
			const cloud = publicCloudRecord({ ...state.cloud, enabled: false });
			try {
				await this.writeManifest(folder, state.manifest, cloud);
				this.remember(cloud, 'skip', this.tables);
				return { ok: true, action: 'skip', cloud, tables: this.tables };
			} catch {
				return { ok: false, error: 'write_failed' };
			}
		}
		return this.provisionFolder(folder, { enabled: true });
	}

	async replace(folder: URI): Promise<CloudProvisionResult> {
		return this.provisionFolder(folder, { enabled: true, replace: true });
	}

	async provisionFolder(folder: URI, input: CloudProvisionInput = {}): Promise<CloudProvisionResult> {
		const key = folder.toString();
		const previous = this.inflight.get(key);
		if (previous && !input.replace) {
			return previous;
		}
		const task = (async () => {
			if (previous) {
				await previous.catch(() => undefined);
			}
			return this.provisionFolderNow(folder, input);
		})().finally(() => {
			if (this.inflight.get(key) === task) {
				this.inflight.delete(key);
			}
		});
		this.inflight.set(key, task);
		return task;
	}

	private async provisionFolderNow(folder: URI, input: CloudProvisionInput = {}): Promise<CloudProvisionResult> {
		if (!this.legalService.decideSend('kuunda_cloud').ok) {
			return { ok: false, error: 'strict_offline' };
		}
		try {
			const state = await this.readState(folder);
			const enabled = input.enabled ?? state.cloud.enabled ?? true;
			const userId = this.sessionUserId();
			const hasSession = await this.hasLiveSession();
			const alreadyProvisioned = Boolean(state.cloud.projectRef) && !input.replace;
			const name = input.name || state.manifest?.name || folder.path.replace(/\\/g, '/').split('/').filter(Boolean).pop() || 'project';
			const type = input.type || state.manifest?.type || 'other';
			let decision = decideCloudProvisioning({
				enabled,
				userId,
				hasSession,
				alreadyProvisioned,
			});
			let api: ProvisionApiResult | undefined;
			let tables: CloudTable[] = alreadyProvisioned && state.cloud.projectRef
				? (this.safeTables(await this.fetchTables(state.cloud.projectRef)) ?? [{ name: 'items', rowCount: 0 }])
				: [];
			let network: 'timeout' | 'offline' | undefined;
			if (decision.action === 'provision') {
				try {
					api = await this.callProvision({
						userId: userId!,
						displayName: name,
						projectType: type,
						replace: input.replace,
					});
					const ref = sanitizeProjectRef(api.kuundaProjectRef || api.projectId);
					if (!ref) {
						api = undefined;
						decision = { ok: true, action: 'pending_api', enabled: true };
					} else {
						api = { ...api, kuundaProjectRef: ref, projectId: ref };
						tables = this.safeTables(api.tables);
					}
				} catch (error) {
					const code = classifyNetworkError(error);
					const msg = String((error as { message?: unknown })?.message || error || '');
					if (/platform_http_401|platform_http_403/.test(msg)) {
						decision = { ok: true, action: 'pending_user', enabled: true };
					} else {
						if (code === 'timeout') {
							network = 'timeout';
						} else if (code === 'offline') {
							network = 'offline';
						}
						decision = { ok: true, action: 'pending_api', enabled: true };
					}
				}
			}
			const cloud = resolveCloudRecordAfterDecision({
				decision,
				api,
				previous: state.cloud,
			});
			const existingGitignore = await this.readText(folder, '.gitignore');
			const scaffold = scaffoldCloudFiles({
				type,
				enabled: cloud.enabled,
				projectRef: cloud.projectRef,
				env: cloud.env,
				url: cloud.url,
				anonKey: persistableAnonKey(api?.anonKey),
				existingGitignore,
			});
			const overwriteSecrets = decision.action === 'provision';
			await this.writeScaffold(folder, scaffold.files, overwriteSecrets);
			if (state.manifest) {
				await this.writeManifest(folder, state.manifest, cloud);
			}
			this.tables = tables;
			this.remember(cloud, decision.action, tables);
			return { ok: true, action: decision.action, cloud, tables, network };
		} catch {
			return { ok: false, error: 'write_failed' };
		}
	}

	private remember(cloud: CloudRecord, action: string, tables: CloudTable[]): void {
		this.tables = tables;
		this.snapshot = redactCloudPayload({
			available: true,
			enabled: cloud.enabled !== false,
			projectRef: cloud.projectRef,
			env: cloud.env,
			action,
		}) as CloudPublicStatus;
		this._onDidChange.fire();
	}

	private async refreshSnapshot(): Promise<void> {
		const target = await this.primaryFolder();
		if (!target) {
			return;
		}
		const state = await this.readState(target.folder);
		this.remember(state.cloud, this.actionFor(state.cloud), this.tables);
	}

	private actionFor(cloud: CloudRecord): string {
		if (cloud.projectRef) {
			return 'reuse';
		}
		return this.sessionUserId() ? 'pending_api' : 'pending_user';
	}

	private sessionUserId(): string | undefined {
		return this.accountService.getSession()?.userId?.trim() || undefined;
	}

	private async hasLiveSession(): Promise<boolean> {
		const userId = this.sessionUserId();
		if (!userId) {
			return false;
		}
		return Boolean((await this.accountService.getAccessToken())?.trim());
	}

	private async primaryFolder(): Promise<{ folder: URI; manifest: ProjectManifest } | undefined> {
		const rows = await this.projectService.listWorkspaceManifests();
		return rows[0];
	}

	private async readState(folder: URI): Promise<{ manifest?: ProjectManifest; cloud: CloudRecord }> {
		const manifest = await this.projectService.readManifest(folder);
		let raw: string | undefined;
		try {
			raw = await this.readText(folder, PROJECT_MANIFEST_PATH);
		} catch {
			raw = undefined;
		}
		const cloud = parseCloudSettings(raw ?? manifest);
		return { manifest, cloud };
	}

	private async writeManifest(folder: URI, manifest: ProjectManifest, cloud: CloudRecord): Promise<void> {
		await this.writeFile(folder, PROJECT_MANIFEST_PATH, serializeManifestWithCloud(manifest, cloud), true);
	}

	private async writeScaffold(folder: URI, files: CloudFile[], overwriteSecrets: boolean): Promise<void> {
		for (const file of files) {
			const isSecret = file.path === CLOUD_ENV_PATH || file.path === CLOUD_LOCAL_PATH;
			const exists = await this.fileService.exists(this.uriFromRelative(folder, file.path));
			if (exists && file.path === CLOUD_CLIENT_PATH) {
				continue;
			}
			if (exists && isSecret && !overwriteSecrets) {
				continue;
			}
			if (file.path === '.gitignore' && exists) {
				const current = await this.readText(folder, '.gitignore');
				const merged = mergeGitignore(current);
				await this.writeFile(folder, '.gitignore', merged.content, true);
				continue;
			}
			await this.writeFile(folder, file.path, file.content, true);
		}
	}

	private async callProvision(body: { userId: string; displayName: string; projectType: string; replace?: boolean }): Promise<ProvisionApiResult> {
		const response = await fetchWithTimeout(`${DEFAULT_API_BASE_URL}/v1/provisioning/projects`, {
			method: 'POST',
			headers: await this.platformHeaders(true),
			body: JSON.stringify({ ...body, env: 'sandbox' }),
		});
		if (!response.ok) {
			throw new Error(`platform_http_${response.status}`);
		}
		return await response.json() as ProvisionApiResult;
	}

	private async fetchTables(projectRef: string): Promise<CloudTable[] | undefined> {
		if (!this.legalService.decideSend('kuunda_cloud').ok) {
			return undefined;
		}
		try {
			const response = await fetchWithTimeout(`${DEFAULT_API_BASE_URL}/v1/provisioning/projects/${encodeURIComponent(projectRef)}/tables`, {
				headers: await this.platformHeaders(false),
			});
			if (!response.ok) {
				return undefined;
			}
			const data = await response.json() as { tables?: CloudTable[] };
			return Array.isArray(data.tables) ? this.safeTables(data.tables) : undefined;
		} catch {
			return undefined;
		}
	}

	private safeTables(tables: CloudTable[] | undefined): CloudTable[] {
		if (!Array.isArray(tables)) {
			return [{ name: 'items', rowCount: 0 }];
		}
		const rows = tables
			.map((table) => ({
				name: String(table?.name || ''),
				rowCount: typeof table?.rowCount === 'number' && Number.isFinite(table.rowCount) ? Math.max(0, Math.floor(table.rowCount)) : 0,
			}))
			.filter((table) => /^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(table.name))
			.slice(0, 50);
		return rows.length ? rows : [{ name: 'items', rowCount: 0 }];
	}

	private async platformHeaders(json: boolean): Promise<Record<string, string>> {
		const headers: Record<string, string> = { Accept: 'application/json' };
		if (json) {
			headers['Content-Type'] = 'application/json';
		}
		const token = await this.accountService.getAccessToken();
		if (token) {
			headers.Authorization = `Bearer ${token}`;
		}
		return headers;
	}

	private async readText(folder: URI, rel: string): Promise<string> {
		const uri = this.uriFromRelative(folder, rel);
		if (!(await this.fileService.exists(uri))) {
			return '';
		}
		return (await this.fileService.readFile(uri)).value.toString();
	}

	private async writeFile(folder: URI, rel: string, content: string, overwrite: boolean): Promise<void> {
		const uri = this.uriFromRelative(folder, rel);
		const dir = dirname(uri);
		if (!(await this.fileService.exists(dir))) {
			await this.fileService.createFolder(dir);
		}
		await this.fileService.writeFile(uri, VSBuffer.fromString(content));
		void overwrite;
	}

	private uriFromRelative(root: URI, rel: string): URI {
		return joinPath(root, ...rel.split('/').filter(Boolean));
	}
}

registerSingleton(IKuundaCloudService, KuundaCloudService, InstantiationType.Delayed);
