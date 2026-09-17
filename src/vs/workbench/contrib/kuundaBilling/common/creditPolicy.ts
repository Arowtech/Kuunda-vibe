/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

export const DEFAULT_API_BASE_URL = 'https://api.ide.kuunda-cloud.com';
export const DEFAULT_ACCOUNT_URL = 'https://app.ide.kuunda-cloud.com/app/';

export type CreditAlertLevel = 'ok' | 'low' | 'empty';
export type PaymentFailureCode = 'insufficient_funds' | 'timeout' | 'declined' | 'canceled' | 'unknown';

export type CreditsBalance = {
	userId: string;
	remaining: number;
	includedQuota: number;
	planId: string;
	alert?: CreditAlertLevel;
};

export type BillingPlan = {
	id: string;
	name: string;
	kind?: 'included' | 'topup';
	includedQuota?: number;
	price?: { amount: number; currency: string };
};

export type TransactionSummary = {
	id: string;
	status: string;
	amount: number;
	currency: string;
	createdAt: string;
	failureCode?: string;
};

export type CheckoutResult = {
	checkoutUrl: string;
	planId?: string;
	amount?: number;
	currency?: string;
};

export function creditAlertLevel(remaining: number, includedQuota: number): CreditAlertLevel {
	if (remaining <= 0) {
		return 'empty';
	}
	if (includedQuota > 0 && remaining / includedQuota <= 0.2) {
		return 'low';
	}
	return 'ok';
}

export function classifyPaymentFailure(code: string | undefined): PaymentFailureCode {
	if (code === 'insufficient_funds' || code === 'timeout' || code === 'declined' || code === 'canceled') {
		return code;
	}
	return 'unknown';
}
