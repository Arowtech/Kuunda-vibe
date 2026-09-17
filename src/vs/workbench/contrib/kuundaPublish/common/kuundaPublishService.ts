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
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IKuundaBillingService } from '../../kuundaBilling/common/kuundaBillingService.js';
import { IKuundaProjectService } from '../../kuundaProject/common/kuundaProjectService.js';
import { type ProjectManifest } from '../../kuundaProject/common/projectType.js';
import { DEFAULT_API_BASE_URL, mergeGitignore } from '../../kuundaCloud/common/cloudProvision.js';
import {
	PUBLISH_ASC_P8_PATH,
	PUBLISH_GITIGNORE_ENTRIES,
	PUBLISH_KEYSTORE_PATH,
	PUBLISH_LOCAL_PATH,
	PUBLISH_PLAY_JSON_PATH,
	PUBLISH_WORKFLOW_PATH,
	buildPublishRequest,
	decidePublish,
	formatPublishContext,
	formatPublishPanel,
	inspectPlayServiceAccount,
	inspectAppStoreP8,
	inspectAppStoreIds,
	inspectKeystore,
	isPublishPanelVisible,
	parsePublishLocal,
	persistablePublishLocal,
	publicPublishJob,
	redactPublishLog,
	redactPublishPayload,
	sanitizeJobId,
	sanitizePublishError,
	scaffoldPublishFiles,
	validatePublishMetadata,
	verifyPublishFiles,
	type PublicPublishJob,
	type PublishLocal,
} from './publishPolicy.js';
import { classifyNetworkError, fetchWithTimeout } from '../../kuundaAi/common/networkPolicy.js';
import { IKuundaLegalService } from '../../kuundaLegal/common/kuundaLegalService.js';

export type PublishWriteResult = { ok: true } | { ok: false; error: string; target?: string };

export type PublishStartResult =
	| { ok: true; action: 'enqueue' | 'pending_ci'; job: PublicPublishJob }
	| { ok: false; error: string; target?: string };

export type PublishPublicStatus = {
	available: true;
	visible: boolean;
	jobStatus?: string;
	targets?: string[];
};

export interface IKuundaPublishService {
	readonly _serviceBrand: undefined;
	readonly onDidChange: Event<void>;
	isPanelVisible(): boolean;
	lastPublicStatus(): PublishPublicStatus;
	formatPanel(): Promise<string>;
	formatContext(): Promise<string>;
	refreshVisibility(): Promise<void>;
	configurePlay(folder: URI, source: URI): Promise<PublishWriteResult>;
	configureAppStore(folder: URI, source: URI, ids: { keyId: string; issuerId: string }): Promise<PublishWriteResult>;
	configureSignature(folder: URI, source: URI): Promise<PublishWriteResult>;
	setMetadata(folder: URI, metadata: { version: string; packageId: string }): Promise<PublishWriteResult>;
	prepareFolder(folder: URI): Promise<PublishWriteResult>;
	startPublish(folder: URI): Promise<PublishStartResult>;
}

export const IKuundaPublishService = createDecorator<IKuundaPublishService>('kuundaPublishService');

export class KuundaPublishService extends Disposable implements IKuundaPublishService {
	declare readonly _serviceBrand: undefined;

	private snapshot: PublishPublicStatus = { available: true, visible: false };
	private job: PublicPublishJob | undefined;
	private logs: string[] = [];
	private readonly _onDidChange = this._register(new Emitter<void>());
	readonly onDidChange = this._onDidChange.event;

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IKuundaProjectService private readonly projectService: IKuundaProjectService,
		@IKuundaBillingService private readonly billingService: IKuundaBillingService,
		@IWorkspaceContextService workspaceContextService: IWorkspaceContextService,
		@IKuundaLegalService private readonly legalService: IKuundaLegalService,
	) {
		super();
		this._register(workspaceContextService.onDidChangeWorkspaceFolders(() => {
			void this.refreshVisibility();
		}));
		void this.refreshVisibility();
	}

	isPanelVisible(): boolean {
		return this.snapshot.visible;
	}

	lastPublicStatus(): PublishPublicStatus {
		return { ...this.snapshot };
	}

	async formatContext(): Promise<string> {
		const rows = await this.projectService.listWorkspaceManifests();
		return rows.map((row) => formatPublishContext({ manifest: row.manifest, job: this.job })).filter(Boolean).join('\n');
	}

	async formatPanel(): Promise<string> {
		const target = await this.primaryMobile();
		if (!target) {
			return formatPublishPanel({ manifest: { type: 'website' } });
		}
		const state = await this.readState(target.folder);
		await this.refreshJobLogs(state.local.lastJobId);
		this.remember(state.manifest, this.job);
		return formatPublishPanel({ manifest: state.manifest, local: state.local, job: this.job, logs: this.logs });
	}

	async refreshVisibility(): Promise<void> {
		const rows = await this.projectService.listWorkspaceManifests();
		const mobile = rows.find((row) => isPublishPanelVisible(row.manifest));
		this.snapshot = redactPublishPayload({
			available: true,
			visible: Boolean(mobile),
			jobStatus: this.job?.status,
			targets: mobile?.manifest.publishTargets,
		}) as PublishPublicStatus;
		this._onDidChange.fire();
	}

	async configurePlay(folder: URI, source: URI): Promise<PublishWriteResult> {
		try {
			const text = await this.readUriText(source);
			const inspected = inspectPlayServiceAccount(text);
			if (!inspected.ok) {
				return inspected;
			}
			const state = await this.requireMobile(folder);
			if (!state.ok) {
				return state;
			}
			await this.ensureScaffold(folder);
			await this.copyFile(source, folder, PUBLISH_PLAY_JSON_PATH);
			await this.writeLocal(folder, {
				...state.local,
				googlePlay: { configured: true, clientEmail: inspected.clientEmail },
			});
			this.remember(state.manifest, this.job);
			return { ok: true };
		} catch {
			return { ok: false, error: 'write_failed' };
		}
	}

	async configureAppStore(folder: URI, source: URI, ids: { keyId: string; issuerId: string }): Promise<PublishWriteResult> {
		try {
			const text = await this.readUriText(source);
			const inspected = inspectAppStoreP8(text);
			if (!inspected.ok) {
				return inspected;
			}
			const storeIds = inspectAppStoreIds(ids);
			if (!storeIds.ok) {
				return storeIds;
			}
			const state = await this.requireMobile(folder);
			if (!state.ok) {
				return state;
			}
			await this.ensureScaffold(folder);
			await this.copyFile(source, folder, PUBLISH_ASC_P8_PATH);
			await this.writeLocal(folder, {
				...state.local,
				appStore: { configured: true, keyId: storeIds.keyId, issuerId: storeIds.issuerId },
			});
			this.remember(state.manifest, this.job);
			return { ok: true };
		} catch {
			return { ok: false, error: 'write_failed' };
		}
	}

	async configureSignature(folder: URI, source: URI): Promise<PublishWriteResult> {
		try {
			const bytes = await this.fileService.readFile(source);
			const inspected = inspectKeystore(bytes.value.byteLength);
			if (!inspected.ok) {
				return inspected;
			}
			const state = await this.requireMobile(folder);
			if (!state.ok) {
				return state;
			}
			await this.ensureScaffold(folder);
			await this.copyFile(source, folder, PUBLISH_KEYSTORE_PATH);
			await this.writeLocal(folder, { ...state.local, signatureReady: true });
			this.remember(state.manifest, this.job);
			return { ok: true };
		} catch {
			return { ok: false, error: 'write_failed' };
		}
	}

	async setMetadata(folder: URI, metadata: { version: string; packageId: string }): Promise<PublishWriteResult> {
		try {
			const meta = validatePublishMetadata(metadata);
			if (!meta.ok) {
				return meta;
			}
			const state = await this.requireMobile(folder);
			if (!state.ok) {
				return state;
			}
			await this.ensureScaffold(folder);
			await this.writeLocal(folder, { ...state.local, version: meta.version, packageId: meta.packageId });
			this.remember(state.manifest, this.job);
			return { ok: true };
		} catch {
			return { ok: false, error: 'write_failed' };
		}
	}

	async prepareFolder(folder: URI): Promise<PublishWriteResult> {
		try {
			const state = await this.readState(folder);
			if (!state.manifest || !isPublishPanelVisible(state.manifest)) {
				return { ok: true };
			}
			await this.ensureScaffold(folder);
			this.remember(state.manifest, this.job);
			return { ok: true };
		} catch {
			return { ok: false, error: 'write_failed' };
		}
	}

	async startPublish(folder: URI): Promise<PublishStartResult> {
		if (!this.legalService.decideSend('publish').ok) {
			return { ok: false, error: 'strict_offline' };
		}
		try {
			const state = await this.requireMobile(folder);
			if (!state.ok) {
				return state;
			}
			const credentials = {
				googlePlay: state.local.googlePlay.configured === true,
				appStore: state.local.appStore.configured === true,
			};
			const decision = decidePublish({
				type: state.manifest.type,
				publishTargets: state.manifest.publishTargets,
				credentials,
				metadata: { version: state.local.version, packageId: state.local.packageId },
				signatureReady: state.local.signatureReady,
			});
			if (!decision.ok) {
				return decision;
			}
			const request = buildPublishRequest({
				userId: this.billingService.getUserId(),
				decision,
				credentials,
				signatureReady: state.local.signatureReady,
			});
			if (!request.ok) {
				return request;
			}
			const files = {
				playJson: await this.fileExists(folder, PUBLISH_PLAY_JSON_PATH),
				appStoreKey: await this.fileExists(folder, PUBLISH_ASC_P8_PATH),
				keystore: await this.fileExists(folder, PUBLISH_KEYSTORE_PATH),
			};
			const present = verifyPublishFiles({ publishTargets: state.manifest.publishTargets, files });
			if (!present.ok) {
				return present;
			}
			await this.ensureScaffold(folder);
			const api = await this.callEnqueue(request.body);
			let job: PublicPublishJob;
			if (api.ok) {
				job = api.job;
			} else {
				return { ok: false, error: api.error };
			}
			this.job = job;
			await this.writeLocal(folder, { ...state.local, lastJobId: job.id });
			this.remember(state.manifest, job);
			return { ok: true, action: job.status === 'pending_ci' ? 'pending_ci' : 'enqueue', job };
		} catch {
			return { ok: false, error: 'write_failed' };
		}
	}

	private async requireMobile(folder: URI): Promise<{ ok: true; manifest: ProjectManifest; local: PublishLocal } | { ok: false; error: string }> {
		const state = await this.readState(folder);
		if (!state.manifest || !isPublishPanelVisible(state.manifest)) {
			return { ok: false, error: 'not_mobile' };
		}
		return { ok: true, manifest: state.manifest, local: state.local };
	}

	private remember(manifest: ProjectManifest | undefined, job: PublicPublishJob | undefined): void {
		this.job = job;
		this.snapshot = redactPublishPayload({
			available: true,
			visible: isPublishPanelVisible(manifest),
			jobStatus: job?.status,
			targets: manifest?.publishTargets,
		}) as PublishPublicStatus;
		this._onDidChange.fire();
	}

	private async refreshJobLogs(jobId: string | undefined): Promise<void> {
		if (!this.legalService.decideSend('publish').ok) {
			return;
		}
		const id = sanitizeJobId(jobId);
		const userId = this.billingService.getUserId();
		if (!id || !userId) {
			return;
		}
		try {
			const jobResponse = await fetchWithTimeout(`${DEFAULT_API_BASE_URL}/v1/publishing/jobs/${encodeURIComponent(id)}?userId=${encodeURIComponent(userId)}`, {
				headers: { Accept: 'application/json' },
			});
			if (jobResponse.ok) {
				const parsed = publicPublishJob(await jobResponse.json());
				if (parsed) {
					this.job = parsed;
				}
			}
			const logsResponse = await fetchWithTimeout(`${DEFAULT_API_BASE_URL}/v1/publishing/jobs/${encodeURIComponent(id)}/logs?userId=${encodeURIComponent(userId)}`, {
				headers: { Accept: 'application/json' },
			});
			if (logsResponse.ok) {
				const data = await logsResponse.json() as { logs?: unknown };
				this.logs = Array.isArray(data.logs) ? data.logs.map(redactPublishLog).filter(Boolean).slice(-50) : this.logs;
			}
		} catch {
			// offline panel still shows last local logs
		}
	}

	private async callEnqueue(body: Record<string, unknown>): Promise<{ ok: true; job: PublicPublishJob } | { ok: false; error: string }> {
		try {
			const response = await fetchWithTimeout(`${DEFAULT_API_BASE_URL}/v1/publishing/jobs`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
				body: JSON.stringify(body),
			});
			let data: { error?: unknown } | undefined;
			try {
				data = await response.json() as { error?: unknown };
			} catch {
				data = undefined;
			}
			if (!response.ok) {
				if (response.status >= 400 && response.status < 500 && data && data.error) {
					return { ok: false, error: sanitizePublishError(data.error) };
				}
				return { ok: false, error: 'unreachable' };
			}
			const job = publicPublishJob(data);
			if (!job) {
				return { ok: false, error: 'unreachable' };
			}
			return { ok: true, job };
		} catch (error) {
			const code = classifyNetworkError(error);
			return { ok: false, error: code === 'timeout' || code === 'offline' ? code : 'unreachable' };
		}
	}

	private async primaryMobile(): Promise<{ folder: URI; manifest: ProjectManifest } | undefined> {
		const rows = await this.projectService.listWorkspaceManifests();
		return rows.find((row) => isPublishPanelVisible(row.manifest));
	}

	private async readState(folder: URI): Promise<{ manifest?: ProjectManifest; local: PublishLocal }> {
		const manifest = await this.projectService.readManifest(folder);
		const raw = await this.readText(folder, PUBLISH_LOCAL_PATH);
		return { manifest, local: parsePublishLocal(raw) };
	}

	private async writeLocal(folder: URI, local: PublishLocal): Promise<void> {
		await this.writeFile(folder, PUBLISH_LOCAL_PATH, persistablePublishLocal(local));
	}

	private async ensureScaffold(folder: URI): Promise<void> {
		const existingGitignore = await this.readText(folder, '.gitignore');
		const scaffold = scaffoldPublishFiles({ existingGitignore });
		for (const file of scaffold.files) {
			const exists = await this.fileService.exists(this.uriFromRelative(folder, file.path));
			if (file.path === PUBLISH_LOCAL_PATH && exists) {
				continue;
			}
			if (file.path === PUBLISH_WORKFLOW_PATH && exists) {
				continue;
			}
			if (file.path === '.gitignore' && exists) {
				const current = await this.readText(folder, '.gitignore');
				const merged = mergeGitignore(current, PUBLISH_GITIGNORE_ENTRIES);
				await this.writeFile(folder, '.gitignore', merged.content);
				continue;
			}
			await this.writeFile(folder, file.path, file.content);
		}
	}

	private async copyFile(source: URI, folder: URI, rel: string): Promise<void> {
		const bytes = await this.fileService.readFile(source);
		const dest = this.uriFromRelative(folder, rel);
		const dir = dirname(dest);
		if (!(await this.fileService.exists(dir))) {
			await this.fileService.createFolder(dir);
		}
		await this.fileService.writeFile(dest, bytes.value);
	}

	private async fileExists(folder: URI, rel: string): Promise<boolean> {
		return this.fileService.exists(this.uriFromRelative(folder, rel));
	}

	private async readUriText(uri: URI): Promise<string> {
		return (await this.fileService.readFile(uri)).value.toString();
	}

	private async readText(folder: URI, rel: string): Promise<string> {
		const uri = this.uriFromRelative(folder, rel);
		if (!(await this.fileService.exists(uri))) {
			return '';
		}
		return (await this.fileService.readFile(uri)).value.toString();
	}

	private async writeFile(folder: URI, rel: string, content: string): Promise<void> {
		const uri = this.uriFromRelative(folder, rel);
		const dir = dirname(uri);
		if (!(await this.fileService.exists(dir))) {
			await this.fileService.createFolder(dir);
		}
		await this.fileService.writeFile(uri, VSBuffer.fromString(content));
	}

	private uriFromRelative(root: URI, rel: string): URI {
		return joinPath(root, ...rel.split('/').filter(Boolean));
	}
}

registerSingleton(IKuundaPublishService, KuundaPublishService, InstantiationType.Delayed);

