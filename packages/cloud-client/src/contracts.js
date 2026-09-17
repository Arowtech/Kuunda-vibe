/**
 * Public contracts for Kuunda Vibe ↔ kuunda-vibe-cloud.
 * These types are the Apache-2.0 "link by name" surface. No secrets, no
 * GeniusPay HMAC, no operator credentials, no signing private keys.
 *
 * @typedef {'development' | 'staging' | 'production'} PlatformEnvironment
 *
 * @typedef {'ok' | 'low' | 'empty'} CreditAlertLevel
 *
 * @typedef {object} CreditsBalance
 * @property {string} userId
 * @property {number} remaining
 * @property {number} includedQuota
 * @property {string} planId
 * @property {CreditAlertLevel} [alert]
 *
 * @typedef {object} BillingPlan
 * @property {string} id
 * @property {string} name
 * @property {'included' | 'topup'} [kind]
 * @property {number} [includedQuota]
 * @property {{ amount: number, currency: string }} [price]
 *
 * @typedef {object} TransactionSummary
 * @property {string} id
 * @property {string} status
 * @property {number} amount
 * @property {string} currency
 * @property {string} createdAt
 * @property {string} [failureCode]
 *
 * @typedef {object} CheckoutResult
 * @property {string} checkoutUrl
 * @property {string} [planId]
 * @property {number} [amount]
 * @property {string} [currency]
 *
 * @typedef {object} ICreditsClient
 * @property {(userId: string) => Promise<CreditsBalance>} getBalance
 * @property {(userId: string) => Promise<CreditsBalance>} signup
 * @property {(userId: string, amount: number, reason?: string) => Promise<CreditsBalance>} consume
 *
 * @typedef {object} IBillingClient
 * @property {() => Promise<BillingPlan[]>} listPlans
 * @property {(userId: string) => Promise<TransactionSummary[]>} listTransactions
 * @property {(userId: string, planId: string) => Promise<CheckoutResult>} startCheckout
 *
 * @typedef {object} ProvisioningRequest
 * @property {string} userId
 * @property {string} displayName
 * @property {string} [projectId]
 * @property {string} [projectType]
 * @property {boolean} [replace]
 *
 * @typedef {object} ProvisioningResult
 * @property {string} projectId
 * @property {string} kuundaProjectRef
 * @property {'sandbox' | 'production'} env
 * @property {string} [url]
 * @property {string} [anonKey]
 * @property {Array<{ name: string, rowCount?: number }>} [tables]
 *
 * @typedef {object} IKuundaProvisioningClient
 * @property {(req: ProvisioningRequest) => Promise<ProvisioningResult>} provisionProject
 * @property {(projectId: string) => Promise<{ kuundaProjectRef: string, tables: Array<{ name: string, rowCount?: number }> }>} listProjectTables
 *
 * @typedef {'google_play' | 'app_store'} PublishTarget
 *
 * @typedef {'queued' | 'running' | 'succeeded' | 'failed' | 'pending_ci'} PublishJobStatus
 *
 * @typedef {object} PublishJobRequest
 * @property {string} userId
 * @property {PublishTarget[]} targets
 * @property {string} version
 * @property {string} packageId
 * @property {boolean} [googlePlayConfigured]
 * @property {boolean} [appStoreConfigured]
 * @property {boolean} [signatureReady]
 *
 * @typedef {object} PublishJob
 * @property {string} id
 * @property {PublishJobStatus} status
 * @property {PublishTarget[]} targets
 * @property {string} [version]
 * @property {string} [packageId]
 * @property {string} [failureCode]
 *
 * @typedef {object} IPublishClient
 * @property {(req: PublishJobRequest) => Promise<PublishJob>} enqueuePublishJob
 * @property {(jobId: string, userId: string) => Promise<PublishJob>} getPublishJob
 * @property {(jobId: string, userId: string) => Promise<{ logs: string[] }>} getPublishLogs
 *
 * @typedef {object} IFeedbackClient
 * @property {(body: object) => Promise<{ ok: boolean, id: string }>} submitFeedback
 *
 * @typedef {object} UpdateArtifact
 * @property {Uint8Array} bytes
 * @property {Uint8Array} signature
 * @property {Uint8Array} publicKey
 *
 * @typedef {object} IUpdateIntegrityVerifier
 * @property {(artifact: UpdateArtifact) => Promise<boolean>} verify
 */

export const DEFAULT_API_BASE_URL = 'https://api.ide.kuunda-cloud.com';
export const DEFAULT_UPDATES_BASE_URL = 'https://updates.ide.kuunda-cloud.com';
export const DEFAULT_ACCOUNT_URL = 'https://app.ide.kuunda-cloud.com/app/';

export const PAYMENT_FAILURE_CODES = Object.freeze([
	'insufficient_funds',
	'timeout',
	'declined',
	'canceled',
	'unknown',
]);

/**
 * UX alert only (not a private tariff). Empty / last 20% of included quota.
 * @param {number} remaining
 * @param {number} includedQuota
 * @returns {CreditAlertLevel}
 */
export function creditAlertLevel(remaining, includedQuota) {
	if (remaining <= 0) {
		return 'empty';
	}
	if (includedQuota > 0 && remaining / includedQuota <= 0.2) {
		return 'low';
	}
	return 'ok';
}

/**
 * @param {string | undefined} code
 */
export function classifyPaymentFailure(code) {
	if (code === 'insufficient_funds' || code === 'timeout' || code === 'declined' || code === 'canceled') {
		return code;
	}
	return 'unknown';
}
