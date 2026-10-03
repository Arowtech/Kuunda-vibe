/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import {
	STRICT_OFFLINE_DEFAULT,
	decideExternalSend,
	formatDataDisclosure,
	formatRefundPolicy,
	formatDataSubjectRights,
	describeLicenseSplit,
} from './legalPolicy.js';
import { kuundaLegalLocale } from './kuundaLegalNls.js';

const OFFLINE_KEY = 'kuunda.legal.strictOffline';
const FIRST_RUN_KEY = 'kuunda.legal.disclosureSeen';

export interface IKuundaLegalService {
	readonly _serviceBrand: undefined;
	readonly onDidChange: Event<void>;
	isStrictOffline(): boolean;
	setStrictOffline(enabled: boolean): void;
	hasSeenFirstRunNotice(): boolean;
	markFirstRunNoticeSeen(): void;
	decideSend(feature: string, provider?: string): ReturnType<typeof decideExternalSend>;
	formatPanel(): string;
}

export const IKuundaLegalService = createDecorator<IKuundaLegalService>('kuundaLegalService');

export class KuundaLegalService extends Disposable implements IKuundaLegalService {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidChange = this._register(new Emitter<void>());
	readonly onDidChange = this._onDidChange.event;

	constructor(
		@IStorageService private readonly storageService: IStorageService,
	) {
		super();
	}

	isStrictOffline(): boolean {
		const raw = this.storageService.get(OFFLINE_KEY, StorageScope.APPLICATION);
		if (raw === undefined) {
			return STRICT_OFFLINE_DEFAULT;
		}
		return raw === '1' || raw === 'true';
	}

	setStrictOffline(enabled: boolean): void {
		this.storageService.store(OFFLINE_KEY, enabled ? '1' : '0', StorageScope.APPLICATION, StorageTarget.USER);
		this._onDidChange.fire();
	}

	hasSeenFirstRunNotice(): boolean {
		const raw = this.storageService.get(FIRST_RUN_KEY, StorageScope.APPLICATION);
		return raw === '1' || raw === 'true';
	}

	markFirstRunNoticeSeen(): void {
		this.storageService.store(FIRST_RUN_KEY, '1', StorageScope.APPLICATION, StorageTarget.USER);
	}

	decideSend(feature: string, provider?: string): ReturnType<typeof decideExternalSend> {
		return decideExternalSend({
			strictOffline: this.isStrictOffline(),
			feature,
			provider,
		});
	}

	formatPanel(): string {
		const locale = kuundaLegalLocale();
		const split = describeLicenseSplit();
		return [
			formatDataDisclosure({ locale, strictOffline: this.isStrictOffline() }).trimEnd(),
			'',
			formatRefundPolicy(locale).trimEnd(),
			'',
			formatDataSubjectRights(locale).trimEnd(),
			'',
			locale === 'fr'
				? `Licence publique : ${split.publicLicense} (cœur éditeur ${split.inheritedEditorCore}). Composants commerciaux : dépôt privé ${split.proprietaryRepo}. Agrégateurs de paiement remplaçables.`
				: `Public license: ${split.publicLicense} (editor core ${split.inheritedEditorCore}). Commercial components: private repo ${split.proprietaryRepo}. Payment aggregators are pluggable.`,
		].join('\n') + '\n';
	}
}

registerSingleton(IKuundaLegalService, KuundaLegalService, InstantiationType.Delayed);
