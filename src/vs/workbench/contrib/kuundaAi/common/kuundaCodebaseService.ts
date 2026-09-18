/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IDirectoryStrService } from '../../void/common/directoryStrService.js';
import { createCodebaseIndex, formatCodebaseContext, type CodebaseHit } from './codebaseIndex.js';

export type KuundaCodebaseHit = CodebaseHit;

export interface IKuundaCodebaseService {
	readonly _serviceBrand: undefined;
	search(query: string, limit?: number): Promise<KuundaCodebaseHit[]>;
	reindex(): Promise<number>;
	formatContext(hits: KuundaCodebaseHit[]): string;
}

export const IKuundaCodebaseService = createDecorator<IKuundaCodebaseService>('kuundaCodebaseService');

const TEXT_EXT = /\.(ts|tsx|js|jsx|mjs|cjs|json|md|py|go|rs|java|kt|cs|cpp|c|h|css|html|sql|yml|yaml|toml|sh)$/i;
const MAX_FILES = 250;
const MAX_BYTES = 32 * 1024;

export class KuundaCodebaseService extends Disposable implements IKuundaCodebaseService {
	declare readonly _serviceBrand: undefined;
	private readonly index = createCodebaseIndex();
	private indexed = false;
	private inflight: Promise<number> | undefined;

	constructor(
		@IDirectoryStrService private readonly directoryStrService: IDirectoryStrService,
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
	) {
		super();
	}

	async search(query: string, limit = 8): Promise<KuundaCodebaseHit[]> {
		await this.ensureIndex();
		return this.index.search(query, { limit });
	}

	async reindex(): Promise<number> {
		this.indexed = false;
		this.inflight = undefined;
		return this.ensureIndex();
	}

	formatContext(hits: KuundaCodebaseHit[]): string {
		return formatCodebaseContext(hits);
	}

	private async ensureIndex(): Promise<number> {
		if (this.indexed) {
			return this.index.size();
		}
		if (this.inflight) {
			return this.inflight;
		}
		this.inflight = this.buildIndex();
		try {
			const n = await this.inflight;
			this.indexed = true;
			return n;
		} catch (err) {
			this.inflight = undefined;
			throw err;
		}
	}

	private async buildIndex(): Promise<number> {
		const folders = this.workspaceContextService.getWorkspace().folders;
		const docs: { path: string; content: string }[] = [];
		for (const folder of folders) {
			if (docs.length >= MAX_FILES) {
				break;
			}
			const uris = await this.directoryStrService.getAllURIsInDirectory(folder.uri, { maxResults: MAX_FILES });
			for (const uri of uris) {
				if (docs.length >= MAX_FILES) {
					break;
				}
				if (!TEXT_EXT.test(uri.path)) {
					continue;
				}
				try {
					const file = await this.fileService.readFile(uri);
					docs.push({ path: uri.fsPath, content: file.value.toString().slice(0, MAX_BYTES) });
				} catch {
					// skip unreadable files
				}
			}
		}
		this.index.replaceAll(docs);
		return this.index.size();
	}
}

registerSingleton(IKuundaCodebaseService, KuundaCodebaseService, InstantiationType.Delayed);
