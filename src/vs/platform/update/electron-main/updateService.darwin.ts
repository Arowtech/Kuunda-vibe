/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
// Modified 2026-09-17 by Arowtech: download + Ed25519 file verify. Do not trust Squirrel/autoUpdater.

import { tmpdir } from 'os';
import * as fs from 'fs';
import { CancellationToken } from '../../../base/common/cancellation.js';
import { hash } from '../../../base/common/hash.js';
import * as path from '../../../base/common/path.js';
import { URI } from '../../../base/common/uri.js';
import { checksum } from '../../../base/node/crypto.js';
import { IConfigurationService } from '../../configuration/common/configuration.js';
import { IEnvironmentMainService } from '../../environment/electron-main/environmentMainService.js';
import { IFileService } from '../../files/common/files.js';
import { ILifecycleMainService, IRelaunchHandler, IRelaunchOptions } from '../../lifecycle/electron-main/lifecycleMainService.js';
import { ILogService } from '../../log/common/log.js';
import { INativeHostMainService } from '../../native/electron-main/nativeHostMainService.js';
import { IProductService } from '../../product/common/productService.js';
import { asJson, IRequestService } from '../../request/common/request.js';
import { ITelemetryService } from '../../telemetry/common/telemetry.js';
import { AvailableForDownload, IUpdate, State, StateType, UpdateType } from '../common/update.js';
import { AbstractUpdateService, createUpdateURL, UpdateErrorClassification } from './abstractUpdateService.js';
import { formatUpdateIntegrityError, inspectUpdateManifest } from '../common/packagingPolicy.js';
import { assertKuundaSignedFile } from './kuundaUpdateIntegrity.js';

export class DarwinUpdateService extends AbstractUpdateService implements IRelaunchHandler {

	private availableUpdatePath: string | undefined;

	constructor(
		@ILifecycleMainService lifecycleMainService: ILifecycleMainService,
		@IConfigurationService configurationService: IConfigurationService,
		@ITelemetryService private readonly telemetryService: ITelemetryService,
		@IEnvironmentMainService environmentMainService: IEnvironmentMainService,
		@IRequestService requestService: IRequestService,
		@ILogService logService: ILogService,
		@IFileService private readonly fileService: IFileService,
		@INativeHostMainService private readonly nativeHostMainService: INativeHostMainService,
		@IProductService productService: IProductService
	) {
		super(lifecycleMainService, configurationService, environmentMainService, requestService, logService, productService);

		lifecycleMainService.setRelaunchHandler(this);
	}

	handleRelaunch(options?: IRelaunchOptions): boolean {
		if (options?.addArgs || options?.removeArgs) {
			return false; // we cannot apply an update and restart with different args
		}

		if (this.state.type !== StateType.Ready) {
			return false; // we only handle the relaunch when we have a pending update
		}

		this.logService.trace('update#handleRelaunch(): running raw#quitAndInstall()');
		this.doQuitAndInstall();

		return true;
	}

	protected buildUpdateFeedUrl(quality: string): string | undefined {
		let assetID: string;
		if (!this.productService.darwinUniversalAssetId) {
			assetID = process.arch === 'x64' ? 'darwin' : 'darwin-arm64';
		} else {
			assetID = this.productService.darwinUniversalAssetId;
		}
		// Unsigned internal builds cannot use Electron's Squirrel feed API.
		return createUpdateURL(assetID, quality, this.productService);
	}

	protected doCheckForUpdates(context: any): void {
		if (!this.url) {
			this.setState(State.Idle(UpdateType.Archive));
			return;
		}
		this.setState(State.CheckingForUpdates(context));
		this.requestService.request({ url: this.url }, CancellationToken.None)
			.then<IUpdate | null>(asJson)
			.then(update => {
				if (!update || !update.url || !update.version || !update.productVersion) {
					this.setState(State.Idle(UpdateType.Archive));
					return;
				}
				const signed = inspectUpdateManifest(update);
				if (!signed.ok) {
					throw new Error(formatUpdateIntegrityError());
				}
				this.setState(State.AvailableForDownload(update));
			})
			.then(undefined, err => this.onError(String(err?.message || err)));
	}

	protected override async doDownloadUpdate(state: AvailableForDownload): Promise<void> {
		const update = state.update;
		const signed = inspectUpdateManifest(update);
		if (!signed.ok || !update.url) {
			throw new Error(formatUpdateIntegrityError());
		}

		this.setState(State.Downloading);
		const cachePath = path.join(tmpdir(), `kuunda-${this.productService.quality}-${process.arch}`);
		await fs.promises.mkdir(cachePath, { recursive: true });
		const packagePath = path.join(cachePath, `KuundaUpdate-${update.version}.zip`);

		const context = await this.requestService.request({ url: update.url }, CancellationToken.None);
		await this.fileService.writeFile(URI.file(packagePath), context.stream);
		await checksum(packagePath, signed.sha256hash);
		await assertKuundaSignedFile({
			filePath: packagePath,
			sha256hash: signed.sha256hash,
			signature: signed.signature,
			publicKey: this.productService.kuundaUpdatePublicKey,
		});

		this.availableUpdatePath = packagePath;
		this.setState(State.Ready(update));
	}

	private onError(err: string): void {
		this.telemetryService.publicLog2<{ messageHash: string }, UpdateErrorClassification>('update:error', { messageHash: String(hash(String(err))) });
		this.logService.error('UpdateService error:', err);

		const message = (this.state.type === StateType.CheckingForUpdates && this.state.explicit) ? err : undefined;
		this.setState(State.Idle(UpdateType.Archive, message));
	}

	protected override doQuitAndInstall(): void {
		this.logService.trace('update#quitAndInstall(): opening verified package');
		if (!this.availableUpdatePath) {
			return;
		}
		this.nativeHostMainService.openExternal(undefined, URI.file(this.availableUpdatePath).toString(true));
	}
}
