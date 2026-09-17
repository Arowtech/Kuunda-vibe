/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { isEqual } from '../../../../base/common/resources.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IMainProcessService } from '../../../../platform/ipc/common/mainProcessService.js';
import { ProxyChannel } from '../../../../base/parts/ipc/common/ipc.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { EndOfLinePreference, ITextModel } from '../../../../editor/common/model.js';
import { ISCMService } from '../../scm/common/scm.js';
import { IVoidModelService } from '../../void/common/voidModelService.js';
import { IVoidSCMService } from '../../void/common/voidSCMTypes.js';
import { canonicalizeFsPath, folderNameOf, formatWorkspaceRoots } from './workspaceRoots.js';
import { resolveAgentCwd } from './terminalAccess.js';
import { PROJECT_RULE_FILENAMES, ProjectRuleFile, formatProjectRules } from './projectRules.js';
import { GitSnapshot, formatMultiRepoGit } from './gitSnapshot.js';

export interface IKuundaWorkspaceService {
	readonly _serviceBrand: undefined;
	workspaceFolderPaths(): string[];
	resolveAgentCwd(cwd: string | null | undefined, command?: string): ReturnType<typeof resolveAgentCwd>;
	getCachedRulesText(): string;
	ensureRules(): Promise<string>;
	refreshRules(): Promise<string>;
	loadGitSnapshots(): Promise<GitSnapshot[]>;
	formatGitContext(): Promise<string>;
	formatDevContext(): Promise<string>;
}

export const IKuundaWorkspaceService = createDecorator<IKuundaWorkspaceService>('kuundaWorkspaceService');

export class KuundaWorkspaceService extends Disposable implements IKuundaWorkspaceService {
	declare readonly _serviceBrand: undefined;

	private cachedRules = '';
	private rulesReady = false;
	private readonly voidSCM: IVoidSCMService;

	constructor(
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
		@IFileService private readonly fileService: IFileService,
		@IVoidModelService private readonly voidModelService: IVoidModelService,
		@IModelService private readonly modelService: IModelService,
		@ISCMService private readonly scmService: ISCMService,
		@IMainProcessService mainProcessService: IMainProcessService,
	) {
		super();
		this.voidSCM = ProxyChannel.toService<IVoidSCMService>(mainProcessService.getChannel('void-channel-scm'));
		this._register(this.workspaceContextService.onDidChangeWorkspaceFolders(() => {
			this.primeRuleModels();
			void this.refreshRules();
		}));
		this._register(this.fileService.onDidFilesChange((e) => {
			const folders = this.workspaceContextService.getWorkspace().folders;
			const hit = folders.some((folder) => PROJECT_RULE_FILENAMES.some((name) => {
				const uri = this.ruleUri(folder.uri, name);
				return e.contains(uri);
			}));
			if (hit) {
				void this.refreshRules();
			}
		}));
		this._register(this.modelService.onModelAdded((model) => this.watchRuleModel(model)));
		this._register(this.modelService.onModelRemoved((model) => {
			if (this.isProjectRuleUri(model.uri)) {
				this.rulesReady = false;
			}
		}));
		for (const model of this.modelService.getModels()) {
			this.watchRuleModel(model);
		}
		this.primeRuleModels();
		void this.refreshRules();
	}

	workspaceFolderPaths(): string[] {
		return this.workspaceContextService.getWorkspace().folders.map((folder) => folder.uri.fsPath);
	}

	resolveAgentCwd(cwd: string | null | undefined, command?: string): ReturnType<typeof resolveAgentCwd> {
		return resolveAgentCwd({ cwd, workspaceFolders: this.workspaceFolderPaths(), command });
	}

	getCachedRulesText(): string {
		return this.cachedRules;
	}

	async ensureRules(): Promise<string> {
		if (!this.rulesReady) {
			return this.refreshRules();
		}
		return this.cachedRules;
	}

	async refreshRules(): Promise<string> {
		const files: ProjectRuleFile[] = [];
		for (const folder of this.workspaceContextService.getWorkspace().folders) {
			for (const fileName of PROJECT_RULE_FILENAMES) {
				const uri = this.ruleUri(folder.uri, fileName);
				let content = '';
				const editorModel = this.modelService.getModel(uri);
				if (editorModel) {
					content = editorModel.getValue(EndOfLinePreference.LF);
				} else {
					const { model } = this.voidModelService.getModel(uri);
					if (model) {
						content = model.getValue(EndOfLinePreference.LF);
					} else if (await this.fileService.exists(uri)) {
						try {
							content = (await this.fileService.readFile(uri)).value.toString();
						} catch {
							content = '';
						}
					}
				}
				if (content.trim()) {
					files.push({ folderName: folder.name, fileName, content });
				}
			}
		}
		this.cachedRules = formatProjectRules(files);
		this.rulesReady = true;
		return this.cachedRules;
	}

	async loadGitSnapshots(): Promise<GitSnapshot[]> {
		const snapshots: GitSnapshot[] = [];
		for (const root of this.collectGitRoots()) {
			const path = root.folderPath;
			const [branch, stat, log, status] = await Promise.all([
				this.voidSCM.gitBranch(path).catch(() => ''),
				this.voidSCM.gitStat(path).catch(() => ''),
				this.voidSCM.gitLog(path).catch(() => ''),
				this.voidSCM.gitStatus(path).catch(() => ''),
			]);
			if (branch || stat || log || status) {
				snapshots.push({
					folderName: root.folderName,
					folderPath: path,
					branch,
					stat,
					log,
					status,
				});
			}
		}
		return snapshots;
	}

	async formatGitContext(): Promise<string> {
		return formatMultiRepoGit(await this.loadGitSnapshots());
	}

	async formatDevContext(): Promise<string> {
		const parts = [
			formatWorkspaceRoots(this.workspaceFolderPaths()),
			await this.formatGitContext(),
		].filter(Boolean);
		return parts.join('\n\n');
	}

	private collectGitRoots(): Array<{ folderName: string; folderPath: string }> {
		const seen = new Set<string>();
		const out: Array<{ folderName: string; folderPath: string }> = [];
		const add = (folderPath: string, folderName: string) => {
			const key = canonicalizeFsPath(folderPath).toLowerCase();
			if (!key || seen.has(key)) {
				return;
			}
			seen.add(key);
			out.push({ folderPath, folderName });
		};
		for (const repo of this.scmService.repositories) {
			const uri = repo.provider.rootUri;
			if (uri) {
				add(uri.fsPath, folderNameOf(uri.fsPath));
			}
		}
		for (const folder of this.workspaceContextService.getWorkspace().folders) {
			add(folder.uri.fsPath, folder.name);
		}
		return out;
	}

	private ruleUri(folder: URI, fileName: string): URI {
		return URI.joinPath(folder, ...fileName.split('/'));
	}

	private isProjectRuleUri(uri: URI): boolean {
		return this.workspaceContextService.getWorkspace().folders.some((folder) =>
			PROJECT_RULE_FILENAMES.some((name) => isEqual(this.ruleUri(folder.uri, name), uri))
		);
	}

	private watchRuleModel(model: ITextModel): void {
		if (!this.isProjectRuleUri(model.uri)) {
			return;
		}
		this.rulesReady = false;
		this._register(model.onDidChangeContent(() => {
			this.rulesReady = false;
		}));
	}

	private primeRuleModels(): void {
		for (const folder of this.workspaceContextService.getWorkspace().folders) {
			for (const fileName of PROJECT_RULE_FILENAMES) {
				const uri = this.ruleUri(folder.uri, fileName);
				void this.fileService.exists(uri).then((exists) => {
					if (exists) {
						return this.voidModelService.initializeModel(uri);
					}
					return undefined;
				});
			}
		}
	}
}

registerSingleton(IKuundaWorkspaceService, KuundaWorkspaceService, InstantiationType.Delayed);
