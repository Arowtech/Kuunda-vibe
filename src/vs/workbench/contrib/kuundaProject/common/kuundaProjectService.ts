/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { dirname, joinPath } from '../../../../base/common/resources.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import {
	PROJECT_MANIFEST_PATH,
	decideDestination,
	decideProjectCreate,
	formatProjectContext,
	parseProjectManifest,
	scaffoldProjectFiles,
	selectFilesToWrite,
	type MobilePublishOption,
	type ProjectManifest,
	type ProjectType,
	type ScaffoldFile,
} from './projectType.js';

export type CreateProjectInput = {
	type: ProjectType;
	name: string;
	parent: URI;
	publishOption?: MobilePublishOption;
};

export type CreateProjectResult =
	| { ok: true; folder: URI; manifest: ProjectManifest; written: string[]; skipped: string[] }
	| { ok: false; error: string };

export interface IKuundaProjectService {
	readonly _serviceBrand: undefined;
	create(input: CreateProjectInput): Promise<CreateProjectResult>;
	readManifest(folder: URI): Promise<ProjectManifest | undefined>;
	listWorkspaceManifests(): Promise<Array<{ folderName: string; folder: URI; manifest: ProjectManifest }>>;
	formatContext(): Promise<string>;
}

export const IKuundaProjectService = createDecorator<IKuundaProjectService>('kuundaProjectService');

export class KuundaProjectService extends Disposable implements IKuundaProjectService {
	declare readonly _serviceBrand: undefined;

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
	) {
		super();
	}

	async create(input: CreateProjectInput): Promise<CreateProjectResult> {
		const decided = decideProjectCreate({
			type: input.type,
			publishOption: input.publishOption,
			name: input.name,
		});
		if (!decided.ok) {
			return decided;
		}
		const parentKind = await this.kindOf(input.parent);
		const folder = joinPath(input.parent, decided.name);
		const folderKind = parentKind === 'missing' || parentKind === 'file' ? 'missing' : await this.kindOf(folder);
		const manifestState = await this.manifestState(folder);
		const destination = decideDestination({
			parentKind,
			folderKind,
			manifestExists: manifestState !== 'missing',
			manifestValid: manifestState === 'valid',
		});
		if (!destination.ok) {
			return destination;
		}
		const scaffold = scaffoldProjectFiles({
			type: decided.type,
			name: decided.name,
			publishTargets: decided.publishTargets,
		});
		if (!scaffold.ok) {
			return scaffold;
		}
		try {
			if (folderKind === 'missing') {
				await this.fileService.createFolder(folder);
			}
			const existingPaths = await this.existingRelativePaths(folder, scaffold.files);
			const { written, skipped } = selectFilesToWrite(scaffold.files, existingPaths);
			for (const file of written) {
				const uri = this.uriFromRelative(folder, file.path);
				const dir = dirname(uri);
				if (!(await this.fileService.exists(dir))) {
					await this.fileService.createFolder(dir);
				}
				await this.fileService.writeFile(uri, VSBuffer.fromString(file.content));
			}
			return {
				ok: true,
				folder,
				manifest: {
					version: 1,
					type: decided.type,
					name: decided.name,
					publishTargets: decided.publishTargets,
				},
				written: written.map((file) => file.path),
				skipped,
			};
		} catch {
			return { ok: false, error: 'write_failed' };
		}
	}

	async readManifest(folder: URI): Promise<ProjectManifest | undefined> {
		const uri = this.uriFromRelative(folder, PROJECT_MANIFEST_PATH);
		if (!(await this.fileService.exists(uri))) {
			return undefined;
		}
		try {
			const raw = (await this.fileService.readFile(uri)).value.toString();
			const parsed = parseProjectManifest(raw);
			return parsed.ok ? parsed.manifest : undefined;
		} catch {
			return undefined;
		}
	}

	async listWorkspaceManifests(): Promise<Array<{ folderName: string; folder: URI; manifest: ProjectManifest }>> {
		const rows: Array<{ folderName: string; folder: URI; manifest: ProjectManifest }> = [];
		for (const folder of this.workspaceContextService.getWorkspace().folders) {
			const manifest = await this.readManifest(folder.uri);
			if (manifest) {
				rows.push({ folderName: folder.name, folder: folder.uri, manifest });
			}
		}
		return rows;
	}

	async formatContext(): Promise<string> {
		return formatProjectContext(await this.listWorkspaceManifests());
	}

	private async manifestState(folder: URI): Promise<'missing' | 'valid' | 'invalid'> {
		const uri = this.uriFromRelative(folder, PROJECT_MANIFEST_PATH);
		if (!(await this.fileService.exists(uri))) {
			return 'missing';
		}
		try {
			const raw = (await this.fileService.readFile(uri)).value.toString();
			return parseProjectManifest(raw).ok ? 'valid' : 'invalid';
		} catch {
			return 'invalid';
		}
	}

	private uriFromRelative(root: URI, rel: string): URI {
		return joinPath(root, ...rel.split('/').filter(Boolean));
	}

	private async kindOf(uri: URI): Promise<'missing' | 'folder' | 'file'> {
		if (!(await this.fileService.exists(uri))) {
			return 'missing';
		}
		try {
			const stat = await this.fileService.resolve(uri);
			return stat.isDirectory ? 'folder' : 'file';
		} catch {
			return 'missing';
		}
	}

	private async existingRelativePaths(folder: URI, files: ScaffoldFile[]): Promise<string[]> {
		const existing: string[] = [];
		for (const file of files) {
			const uri = this.uriFromRelative(folder, file.path);
			if (await this.fileService.exists(uri)) {
				existing.push(file.path);
			}
		}
		return existing;
	}
}

registerSingleton(IKuundaProjectService, KuundaProjectService, InstantiationType.Delayed);
