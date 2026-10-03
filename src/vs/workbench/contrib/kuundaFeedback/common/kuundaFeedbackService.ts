/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { IKuundaLegalService } from '../../kuundaLegal/common/kuundaLegalService.js';
import { DEFAULT_API_BASE_URL } from '../../kuundaBilling/common/creditPolicy.js';
import { fetchWithTimeout } from '../../kuundaAi/common/networkPolicy.js';
import {
	FEEDBACK_PATH,
	decideFeedbackSend,
	formatFeedbackError,
	prioritizeBacklog,
	recordUsageSignal,
	sanitizeFeedbackPayload,
	type FeedbackReceipt,
} from './feedbackPolicy.js';
import { kuundaFeedbackLocale, kuundaFeedbackLocalize } from './kuundaFeedbackNls.js';

const RECEIPTS_KEY = 'kuunda.feedback.receipts';

export interface IKuundaFeedbackService {
	readonly _serviceBrand: undefined;
	readonly onDidChange: Event<void>;
	submit(input: { category?: string; severity?: number; title?: string; body?: string; consent?: boolean }): Promise<{ ok: boolean; message: string }>;
	formatPanel(): string;
}

export const IKuundaFeedbackService = createDecorator<IKuundaFeedbackService>('kuundaFeedbackService');

export class KuundaFeedbackService extends Disposable implements IKuundaFeedbackService {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidChange = this._register(new Emitter<void>());
	readonly onDidChange = this._onDidChange.event;

	constructor(
		@IStorageService private readonly storageService: IStorageService,
		@IProductService private readonly productService: IProductService,
		@IKuundaLegalService private readonly legalService: IKuundaLegalService,
	) {
		super();
	}

	async submit(input: { category?: string; severity?: number; title?: string; body?: string; consent?: boolean }): Promise<{ ok: boolean; message: string }> {
		const locale = kuundaFeedbackLocale();
		const prepared = sanitizeFeedbackPayload({
			...input,
			strictOffline: this.legalService.isStrictOffline(),
			quality: this.productService.quality,
			version: this.productService.version,
			commit: this.productService.commit,
			platform: `${process.platform}-${process.arch}`,
		});
		if (!prepared.ok) {
			return { ok: false, message: formatFeedbackError(locale, prepared.error) };
		}
		if (!this.legalService.decideSend('feedback').ok) {
			return { ok: false, message: formatFeedbackError(locale, 'strict_offline') };
		}
		try {
			const response = await fetchWithTimeout(`${DEFAULT_API_BASE_URL}${FEEDBACK_PATH}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
				body: JSON.stringify(prepared.payload),
			});
			if (!response.ok) {
				return { ok: false, message: formatFeedbackError(locale) };
			}
			const body = await response.json() as { id?: string };
			this.storeReceipt({
				id: String(body.id || `local-${Date.now()}`),
				category: prepared.payload.category,
				severity: prepared.payload.severity,
				title: prepared.payload.title,
			});
			this._onDidChange.fire();
			return { ok: true, message: kuundaFeedbackLocalize('kuunda.feedback.sent') };
		} catch {
			return { ok: false, message: formatFeedbackError(locale) };
		}
	}

	formatPanel(): string {
		const send = decideFeedbackSend({
			strictOffline: this.legalService.isStrictOffline(),
			consent: true,
		});
		const ranked = prioritizeBacklog(this.receipts());
		void recordUsageSignal();
		const header = [
			kuundaFeedbackLocalize('kuunda.feedback.panel.intro'),
			kuundaFeedbackLocalize('kuunda.feedback.panel.telemetry'),
			send.ok
				? kuundaFeedbackLocalize('kuunda.feedback.panel.open')
				: kuundaFeedbackLocalize('kuunda.feedback.panel.closed', send.error),
			kuundaFeedbackLocalize('kuunda.feedback.panel.note'),
			'',
			kuundaFeedbackLocalize('kuunda.feedback.panel.priority'),
		];
		const rows = ranked.length
			? ranked.map((row) => `- ${row.category} / ${row.severity} (${row.score}) ${row.title}`)
			: [`- ${kuundaFeedbackLocalize('kuunda.feedback.panel.empty')}`];
		return [...header, ...rows, ''].join('\n');
	}

	private receipts(): FeedbackReceipt[] {
		try {
			const raw = this.storageService.get(RECEIPTS_KEY, StorageScope.APPLICATION);
			const parsed = raw ? JSON.parse(raw) as FeedbackReceipt[] : [];
			return Array.isArray(parsed) ? parsed.slice(-50) : [];
		} catch {
			return [];
		}
	}

	private storeReceipt(receipt: FeedbackReceipt): void {
		const next = [...this.receipts(), receipt].slice(-50);
		this.storageService.store(RECEIPTS_KEY, JSON.stringify(next), StorageScope.APPLICATION, StorageTarget.USER);
	}
}

registerSingleton(IKuundaFeedbackService, KuundaFeedbackService, InstantiationType.Delayed);
