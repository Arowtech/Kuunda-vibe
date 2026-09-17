/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { BillingPlan, CheckoutResult, CreditAlertLevel, CreditsBalance, DEFAULT_API_BASE_URL, DEFAULT_ACCOUNT_URL, TransactionSummary, creditAlertLevel } from './creditPolicy.js';
import { kuundaBillingLocalize, paymentFailureMessage } from './kuundaBillingNls.js';

const USER_KEY = 'kuunda.billing.userId';

export interface IKuundaBillingService {
	readonly _serviceBrand: undefined;
	readonly onDidChangeBalance: Event<CreditsBalance | undefined>;
	readonly accountUrl: string;
	getUserId(): string | undefined;
	setUserId(userId: string): Promise<void>;
	getBalance(): Promise<CreditsBalance | undefined>;
	listPlans(): Promise<BillingPlan[]>;
	listTransactions(): Promise<TransactionSummary[]>;
	startCheckout(planId: string): Promise<CheckoutResult | undefined>;
	ensureCanRunAgent(): Promise<{ ok: boolean; message?: string }>;
	recordUsage(amount?: number): Promise<void>;
	lastBalance(): CreditsBalance | undefined;
}

export const IKuundaBillingService = createDecorator<IKuundaBillingService>('kuundaBillingService');

export class KuundaBillingService extends Disposable implements IKuundaBillingService {
	declare readonly _serviceBrand: undefined;
	readonly accountUrl = DEFAULT_ACCOUNT_URL;

	private balance: CreditsBalance | undefined;
	private lastAlert: CreditAlertLevel | undefined;
	private lastFailureId: string | undefined;
	private readonly _onDidChangeBalance = this._register(new Emitter<CreditsBalance | undefined>());
	readonly onDidChangeBalance = this._onDidChangeBalance.event;

	constructor(
		@IStorageService private readonly storageService: IStorageService,
		@INotificationService private readonly notificationService: INotificationService,
	) {
		super();
	}

	getUserId(): string | undefined {
		const value = this.storageService.get(USER_KEY, StorageScope.APPLICATION);
		return value?.trim() || undefined;
	}

	async setUserId(userId: string): Promise<void> {
		this.storageService.store(USER_KEY, userId.trim(), StorageScope.APPLICATION, StorageTarget.USER);
		this.lastAlert = undefined;
		this.lastFailureId = undefined;
		await this.getBalance();
	}

	lastBalance(): CreditsBalance | undefined {
		return this.balance;
	}

	async getBalance(): Promise<CreditsBalance | undefined> {
		const userId = this.getUserId();
		if (!userId) {
			this.balance = undefined;
			this.lastAlert = undefined;
			this._onDidChangeBalance.fire(undefined);
			return undefined;
		}
		try {
			const response = await fetch(`${DEFAULT_API_BASE_URL}/v1/credits/${encodeURIComponent(userId)}`, {
				headers: { Accept: 'application/json' },
			});
			if (!response.ok) {
				throw new Error(`platform_http_${response.status}`);
			}
			const raw = await response.json() as CreditsBalance;
			const alert = raw.alert ?? creditAlertLevel(raw.remaining, raw.includedQuota);
			this.balance = { ...raw, alert };
			this._onDidChangeBalance.fire(this.balance);
			this.notifyAlertOnce(alert);
			await this.notifyLatestPaymentFailure();
			return this.balance;
		} catch {
			return this.balance;
		}
	}

	async listPlans(): Promise<BillingPlan[]> {
		try {
			const response = await fetch(`${DEFAULT_API_BASE_URL}/v1/billing/plans`, {
				headers: { Accept: 'application/json' },
			});
			if (!response.ok) {
				return [];
			}
			const raw = await response.json();
			return Array.isArray(raw) ? raw as BillingPlan[] : [];
		} catch {
			return [];
		}
	}

	async listTransactions(): Promise<TransactionSummary[]> {
		const userId = this.getUserId();
		if (!userId) {
			return [];
		}
		try {
			const response = await fetch(`${DEFAULT_API_BASE_URL}/v1/billing/transactions?userId=${encodeURIComponent(userId)}`, {
				headers: { Accept: 'application/json' },
			});
			if (!response.ok) {
				return [];
			}
			const raw = await response.json();
			return Array.isArray(raw) ? raw as TransactionSummary[] : [];
		} catch {
			return [];
		}
	}

	async startCheckout(planId: string): Promise<CheckoutResult | undefined> {
		const userId = this.getUserId();
		if (!userId) {
			return undefined;
		}
		try {
			const response = await fetch(`${DEFAULT_API_BASE_URL}/v1/billing/checkout`, {
				method: 'POST',
				headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId, planId }),
			});
			if (!response.ok) {
				return undefined;
			}
			return await response.json() as CheckoutResult;
		} catch {
			return undefined;
		}
	}

	async ensureCanRunAgent(): Promise<{ ok: boolean; message?: string }> {
		const userId = this.getUserId();
		if (!userId) {
			return { ok: true };
		}
		const balance = await this.getBalance();
		if (balance && balance.remaining <= 0) {
			return { ok: false, message: kuundaBillingLocalize('kuunda.billing.alert.empty') };
		}
		return { ok: true };
	}

	async recordUsage(amount = 1): Promise<void> {
		const userId = this.getUserId();
		if (!userId) {
			return;
		}
		try {
			const response = await fetch(`${DEFAULT_API_BASE_URL}/v1/credits/consume`, {
				method: 'POST',
				headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId, amount, reason: 'agent_usage' }),
			});
			if (response.status === 402) {
				this.notifyAlertOnce('empty');
				if (this.balance) {
					this.balance = { ...this.balance, remaining: 0, alert: 'empty' };
					this._onDidChangeBalance.fire(this.balance);
				}
				return;
			}
			if (!response.ok) {
				return;
			}
			const raw = await response.json() as CreditsBalance;
			const alert = raw.alert ?? creditAlertLevel(raw.remaining, raw.includedQuota);
			this.balance = { ...raw, alert };
			this._onDidChangeBalance.fire(this.balance);
			this.notifyAlertOnce(alert);
		} catch {
			// Best-effort: agent still works if the platform is unreachable.
		}
	}

	private notifyAlertOnce(alert: CreditAlertLevel): void {
		if (alert === this.lastAlert) {
			return;
		}
		this.lastAlert = alert;
		if (alert === 'low') {
			this.notificationService.notify({ severity: Severity.Warning, message: kuundaBillingLocalize('kuunda.billing.alert.low') });
		} else if (alert === 'empty') {
			this.notificationService.notify({ severity: Severity.Warning, message: kuundaBillingLocalize('kuunda.billing.alert.empty') });
		}
	}

	private async notifyLatestPaymentFailure(): Promise<void> {
		const rows = await this.listTransactions();
		if (rows.length === 0) {
			return;
		}
		const latest = rows[0];
		if (latest.status !== 'failed') {
			return;
		}
		if (latest.id && latest.id === this.lastFailureId) {
			return;
		}
		this.lastFailureId = latest.id;
		this.notificationService.notify({
			severity: Severity.Warning,
			message: paymentFailureMessage(latest.failureCode),
		});
	}
}

registerSingleton(IKuundaBillingService, KuundaBillingService, InstantiationType.Delayed);
