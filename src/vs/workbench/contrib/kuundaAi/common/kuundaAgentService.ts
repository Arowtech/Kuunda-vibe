/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { BackgroundJob, collectCheckpointPaths, createBackgroundJob, transitionBackgroundJob } from './backgroundJob.js';
import { DEFAULT_TOOL_PERMISSIONS, PermissionLevel, PRODUCTION_ADJACENT_DEFAULT } from './permissionPolicy.js';
import { AGENT_PROVIDERS } from './agentProviders.js';
import { TERMINAL_TOOL_NAMES } from './terminalAccess.js';

const POLICY_STORAGE_KEY = 'kuunda.agent.policyOverrides';
const PRODUCTION_ADJACENT_KEY = 'kuunda.agent.productionAdjacent';

export interface IKuundaAgentService {
	readonly _serviceBrand: undefined;
	readonly onDidChangeJobs: Event<void>;
	readonly supportedProviders: readonly string[];
	listJobs(): BackgroundJob[];
	getJob(id: string): BackgroundJob | undefined;
	jobForThread(threadId: string): BackgroundJob | undefined;
	enqueue(prompt: string, threadId: string): BackgroundJob;
	markRunning(id: string): void;
	settleThread(threadId: string, result: { changedPaths?: string[]; error?: string | null }): void;
	cancelThread(threadId: string): void;
	review(id: string): void;
	getPolicyOverrides(): { [toolName: string]: PermissionLevel };
	isProductionAdjacent(): boolean;
	setProductionAdjacent(enabled: boolean): void;
	setToolPermission(toolName: string, level: PermissionLevel): void;
	setTerminalAccess(level: PermissionLevel): void;
	listPermissionTools(): string[];
}

export const IKuundaAgentService = createDecorator<IKuundaAgentService>('kuundaAgentService');

export class KuundaAgentService extends Disposable implements IKuundaAgentService {
	declare readonly _serviceBrand: undefined;
	readonly supportedProviders = AGENT_PROVIDERS;

	private readonly jobs = new Map<string, BackgroundJob>();
	private policyOverrides: { [toolName: string]: PermissionLevel } = {};
	private readonly _onDidChangeJobs = this._register(new Emitter<void>());
	readonly onDidChangeJobs = this._onDidChangeJobs.event;

	constructor(
		@IStorageService private readonly storageService: IStorageService,
	) {
		super();
		const raw = this.storageService.get(POLICY_STORAGE_KEY, StorageScope.APPLICATION);
		if (raw) {
			try {
				const parsed = JSON.parse(raw) as { [toolName: string]: PermissionLevel };
				if (parsed && typeof parsed === 'object') {
					this.policyOverrides = parsed;
				}
			} catch {
				this.policyOverrides = {};
			}
		}
	}

	listJobs(): BackgroundJob[] {
		return [...this.jobs.values()];
	}

	getJob(id: string): BackgroundJob | undefined {
		return this.jobs.get(id);
	}

	jobForThread(threadId: string): BackgroundJob | undefined {
		return this.listJobs().find((job) => job.threadId === threadId);
	}

	enqueue(prompt: string, threadId: string): BackgroundJob {
		const job = createBackgroundJob({
			id: generateUuid(),
			prompt,
			threadId,
			now: new Date().toISOString(),
		});
		this.jobs.set(job.id, job);
		this._onDidChangeJobs.fire();
		return job;
	}

	markRunning(id: string): void {
		const job = this.jobs.get(id);
		if (!job) {
			return;
		}
		this.jobs.set(id, transitionBackgroundJob(job, { type: 'start' }));
		this._onDidChangeJobs.fire();
	}

	settleThread(threadId: string, result: { changedPaths?: string[]; error?: string | null }): void {
		const job = this.jobForThread(threadId);
		if (!job || job.status !== 'running') {
			return;
		}
		const next = result.error
			? transitionBackgroundJob(job, { type: 'fail', error: result.error })
			: transitionBackgroundJob(job, { type: 'complete', changedPaths: result.changedPaths || [] });
		this.jobs.set(job.id, next);
		this._onDidChangeJobs.fire();
	}

	cancelThread(threadId: string): void {
		const job = this.jobForThread(threadId);
		if (!job) {
			return;
		}
		this.jobs.set(job.id, transitionBackgroundJob(job, { type: 'cancel' }));
		this._onDidChangeJobs.fire();
	}

	review(id: string): void {
		const job = this.jobs.get(id);
		if (!job) {
			return;
		}
		this.jobs.set(id, transitionBackgroundJob(job, { type: 'review' }));
		this._onDidChangeJobs.fire();
	}

	getPolicyOverrides(): { [toolName: string]: PermissionLevel } {
		return { ...this.policyOverrides };
	}

	isProductionAdjacent(): boolean {
		const raw = this.storageService.get(PRODUCTION_ADJACENT_KEY, StorageScope.APPLICATION);
		if (raw === '0' || raw === 'false') {
			return false;
		}
		if (raw === '1' || raw === 'true') {
			return true;
		}
		return PRODUCTION_ADJACENT_DEFAULT;
	}

	setProductionAdjacent(enabled: boolean): void {
		this.storageService.store(PRODUCTION_ADJACENT_KEY, enabled ? '1' : '0', StorageScope.APPLICATION, StorageTarget.USER);
		this._onDidChangeJobs.fire();
	}

	setToolPermission(toolName: string, level: PermissionLevel): void {
		this.policyOverrides = { ...this.policyOverrides, [toolName]: level };
		this.storageService.store(POLICY_STORAGE_KEY, JSON.stringify(this.policyOverrides), StorageScope.APPLICATION, StorageTarget.USER);
		this._onDidChangeJobs.fire();
	}

	setTerminalAccess(level: PermissionLevel): void {
		for (const toolName of TERMINAL_TOOL_NAMES) {
			this.setToolPermission(toolName, level);
		}
	}

	listPermissionTools(): string[] {
		return Object.keys(DEFAULT_TOOL_PERMISSIONS);
	}
}

export { collectCheckpointPaths };

registerSingleton(IKuundaAgentService, KuundaAgentService, InstantiationType.Delayed);
