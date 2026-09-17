/**
 * Public contracts for Kuunda Vibe ↔ kuunda-vibe-cloud.
 * These types are the Apache-2.0 "link by name" surface. No secrets, no
 * GeniusPay HMAC, no operator credentials, no signing private keys.
 *
 * @typedef {'development' | 'staging' | 'production'} PlatformEnvironment
 *
 * @typedef {object} CreditsBalance
 * @property {string} userId
 * @property {number} remaining
 * @property {number} includedQuota
 * @property {string} planId
 *
 * @typedef {object} BillingPlan
 * @property {string} id
 * @property {string} name
 *
 * @typedef {object} TransactionSummary
 * @property {string} id
 * @property {string} status
 * @property {number} amount
 * @property {string} currency
 * @property {string} createdAt
 *
 * @typedef {object} ICreditsClient
 * @property {(userId: string) => Promise<CreditsBalance>} getBalance
 *
 * @typedef {object} IBillingClient
 * @property {() => Promise<BillingPlan[]>} listPlans
 * @property {(userId: string) => Promise<TransactionSummary[]>} listTransactions
 *
 * @typedef {object} ProvisioningRequest
 * @property {string} projectId
 * @property {string} displayName
 *
 * @typedef {object} ProvisioningResult
 * @property {string} projectId
 * @property {string} kuundaProjectRef
 * @property {'sandbox' | 'production'} env
 *
 * @typedef {object} IKuundaProvisioningClient
 * @property {(req: ProvisioningRequest) => Promise<ProvisioningResult>} provisionProject
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
