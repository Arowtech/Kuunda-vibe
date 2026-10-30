/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { URI } from '../../../../base/common/uri.js';
import { dirname } from '../../../../base/common/resources.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IPathService } from '../../../services/path/common/pathService.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import {
	PROJECT_SKILLS_DIR,
	SKILL_FILE_NAME,
	SKILLS_DIR_NAME,
	SkillPromptEntry,
	SkillScope,
	formatSkills,
	parseSkillFile,
	sanitizeSkillId,
	starterSkill,
} from './skillPolicy.js';

export type SkillView = {
	key: string;
	id: string;
	name: string;
	description: string;
	scope: SkillScope;
	location: string;
	enabled: boolean;
};

export type SkillServiceState = {
	skills: SkillView[];
	error?: string;
};

export type SkillWriteResult = { ok: true } | { ok: false; error: string };

export interface IKuundaSkillService {
	readonly _serviceBrand: undefined;
	readonly onDidChangeState: Event<void>;
	readonly state: SkillServiceState;
	refresh(): Promise<void>;
	setEnabled(key: string, enabled: boolean): Promise<void>;
	revealUserFolder(): Promise<void>;
	createUserSkill(name: string): Promise<SkillWriteResult>;
	formatContext(): Promise<string>;
}

export const IKuundaSkillService = createDecorator<IKuundaSkillService>('kuundaSkillService');

const STATE_FILE = 'skills-state.json';
const README_NAME = 'README.md';
const README = `# Kuunda skills

Each folder that contains \`${SKILL_FILE_NAME}\` is a skill. Turn skills on or off in Kuunda Vibe settings, Skills tab.

Project skills live in the open workspace at \`${PROJECT_SKILLS_DIR}/<name>/${SKILL_FILE_NAME}\`.
`;

type StoredSkillState = { disabled?: unknown };

export class KuundaSkillService extends Disposable implements IKuundaSkillService {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidChangeState = this._register(new Emitter<void>());
	readonly onDidChangeState = this._onDidChangeState.event;

	state: SkillServiceState = { skills: [] };
	private entries: SkillPromptEntry[] = [];
	private loaded = false;

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IPathService private readonly pathService: IPathService,
		@IProductService private readonly productService: IProductService,
		@IEditorService private readonly editorService: IEditorService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
	) {
		super();
		this._register(this.workspaceContextService.onDidChangeWorkspaceFolders(() => {
			void this.refresh();
		}));
		void this.refresh();
	}

	async refresh(): Promise<void> {
		try {
			const disabled = await this.readDisabled();
			const found = await this.collect(disabled);
			this.entries = found.entries;
			this.state = { skills: found.views };
		} catch {
			this.entries = [];
			this.state = { skills: [], error: 'skills_unavailable' };
		}
		this.loaded = true;
		this._onDidChangeState.fire();
	}

	async setEnabled(key: string, enabled: boolean): Promise<void> {
		const safe = String(key || '').trim();
		if (!safe || !this.state.skills.some((skill) => skill.key === safe)) {
			return;
		}
		const disabled = new Set(await this.readDisabled());
		if (enabled) {
			disabled.delete(safe);
		} else {
			disabled.add(safe);
		}
		await this.writeDisabled([...disabled]);
		await this.refresh();
	}

	async revealUserFolder(): Promise<void> {
		const folder = await this.userSkillsDir();
		await this.fileService.createFolder(folder);
		const readme = URI.joinPath(folder, README_NAME);
		if (!(await this.fileService.exists(readme))) {
			await this.fileService.writeFile(readme, VSBuffer.fromString(README));
		}
		await this.editorService.openEditor({ resource: readme, options: { pinned: true } });
	}

	async createUserSkill(name: string): Promise<SkillWriteResult> {
		const id = sanitizeSkillId(name);
		if (!id) {
			return { ok: false, error: 'name_required' };
		}
		try {
			const folder = URI.joinPath(await this.userSkillsDir(), id);
			const file = URI.joinPath(folder, SKILL_FILE_NAME);
			if (await this.fileService.exists(file)) {
				return { ok: false, error: 'already_exists' };
			}
			await this.fileService.createFolder(folder);
			await this.fileService.writeFile(file, VSBuffer.fromString(starterSkill(id)));
			await this.editorService.openEditor({ resource: file, options: { pinned: true } });
			await this.refresh();
			return { ok: true };
		} catch {
			return { ok: false, error: 'write_failed' };
		}
	}

	async formatContext(): Promise<string> {
		if (!this.loaded) {
			await this.refresh();
		}
		return formatSkills(this.entries);
	}

	private async collect(disabled: Set<string>): Promise<{ views: SkillView[]; entries: SkillPromptEntry[] }> {
		const views: SkillView[] = [];
		const entries: SkillPromptEntry[] = [];
		const userDir = await this.userSkillsDir();
		await this.readDir(userDir, 'user', 'User', disabled, views, entries);
		for (const folder of this.workspaceContextService.getWorkspace().folders) {
			const dir = URI.joinPath(folder.uri, '.kuunda', SKILLS_DIR_NAME);
			await this.readDir(dir, 'project', folder.name, disabled, views, entries);
		}
		views.sort((a, b) => a.scope.localeCompare(b.scope) || a.name.localeCompare(b.name));
		return { views, entries };
	}

	private async readDir(dir: URI, scope: SkillScope, location: string, disabled: Set<string>, views: SkillView[], entries: SkillPromptEntry[]): Promise<void> {
		let stat;
		try {
			stat = await this.fileService.resolve(dir);
		} catch {
			return;
		}
		for (const child of stat.children || []) {
			if (!child.isDirectory) {
				continue;
			}
			const id = sanitizeSkillId(child.name);
			if (!id || id !== child.name.toLowerCase()) {
				continue;
			}
			const file = URI.joinPath(child.resource, SKILL_FILE_NAME);
			let raw = '';
			try {
				raw = (await this.fileService.readFile(file)).value.toString();
			} catch {
				continue;
			}
			const parsed = parseSkillFile(raw);
			if (!parsed) {
				continue;
			}
			const key = scope === 'user' ? `user:${id}` : `project:${location}:${id}`;
			const enabled = !disabled.has(key);
			const name = parsed.name || id;
			views.push({
				key,
				id,
				name,
				description: parsed.description,
				scope,
				location,
				enabled,
			});
			entries.push({
				key,
				title: `${location}/${name}`,
				description: parsed.description,
				body: parsed.body,
				enabled,
			});
		}
	}

	private async userSkillsDir(): Promise<URI> {
		const home = await this.pathService.userHome();
		return URI.joinPath(home, this.productService.dataFolderName, SKILLS_DIR_NAME);
	}

	private async stateUri(): Promise<URI> {
		const home = await this.pathService.userHome();
		return URI.joinPath(home, this.productService.dataFolderName, STATE_FILE);
	}

	private async readDisabled(): Promise<Set<string>> {
		try {
			const raw = (await this.fileService.readFile(await this.stateUri())).value.toString();
			const data = JSON.parse(raw) as StoredSkillState;
			const list = Array.isArray(data.disabled) ? data.disabled : [];
			return new Set(list.map((item) => String(item || '').trim()).filter((item) => isSkillKey(item)));
		} catch {
			return new Set();
		}
	}

	private async writeDisabled(disabled: string[]): Promise<void> {
		const uri = await this.stateUri();
		await this.fileService.createFolder(dirname(uri));
		const body = `${JSON.stringify({ disabled: [...new Set(disabled)].sort() }, null, '\t')}\n`;
		await this.fileService.writeFile(uri, VSBuffer.fromString(body));
	}
}

function isSkillKey(value: string): boolean {
	return /^(user|project):/.test(value) && value.length <= 200 && !/[\r\n\0]/.test(value);
}

registerSingleton(IKuundaSkillService, KuundaSkillService, InstantiationType.Delayed);
