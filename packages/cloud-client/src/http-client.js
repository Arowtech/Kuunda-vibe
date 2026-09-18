import { DEFAULT_API_BASE_URL } from './contracts.js';
import { DEFAULT_REQUEST_TIMEOUT_MS, fetchWithTimeout } from '../../kuunda-ai/src/network-policy.js';

/**
 * HTTP client with no embedded secrets. The caller injects a bearer token
 * obtained at runtime (never from a committed file).
 *
 * @param {object} options
 * @param {string} [options.baseUrl]
 * @param {() => Promise<string | null> | string | null} [options.getAccessToken]
 * @param {typeof fetch} [options.fetchImpl]
 * @param {number} [options.timeoutMs]
 */
export function createPlatformClient(options = {}) {
	const baseUrl = (options.baseUrl ?? DEFAULT_API_BASE_URL).replace(/\/$/, '');
	const fetchImpl = options.fetchImpl ?? globalThis.fetch;
	const getAccessToken = options.getAccessToken ?? (async () => null);
	const timeoutMs = options.timeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;

	if (typeof fetchImpl !== 'function') {
		throw new Error('fetch is required');
	}

	/**
	 * @param {string} path
	 * @param {RequestInit} [init]
	 */
	async function request(path, init = {}) {
		const token = await getAccessToken();
		const headers = new Headers(init.headers);
		headers.set('Accept', 'application/json');
		if (token) {
			headers.set('Authorization', `Bearer ${token}`);
		}
		const response = await fetchWithTimeout(`${baseUrl}${path}`, { ...init, headers }, { timeoutMs, fetchImpl });
		if (!response.ok) {
			throw new Error(`platform_http_${response.status}`);
		}
		if (response.status === 204) {
			return null;
		}
		return response.json();
	}

	return {
		baseUrl,
		/** @type {import('./contracts.js').ICreditsClient['getBalance']} */
		getBalance(userId) {
			return request(`/v1/credits/${encodeURIComponent(userId)}`);
		},
		/** @type {import('./contracts.js').ICreditsClient['signup']} */
		signup(userId) {
			return request('/v1/credits/signup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId }),
			});
		},
		/** @type {import('./contracts.js').ICreditsClient['consume']} */
		consume(userId, amount, reason) {
			return request('/v1/credits/consume', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId, amount, reason }),
			});
		},
		/** @type {import('./contracts.js').IBillingClient['listPlans']} */
		listPlans() {
			return request('/v1/billing/plans');
		},
		/** @type {import('./contracts.js').IBillingClient['listTransactions']} */
		listTransactions(userId) {
			return request(`/v1/billing/transactions?userId=${encodeURIComponent(userId)}`);
		},
		/** @type {import('./contracts.js').IBillingClient['startCheckout']} */
		startCheckout(userId, planId) {
			return request('/v1/billing/checkout', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ userId, planId }),
			});
		},
		/** @type {import('./contracts.js').IKuundaProvisioningClient['provisionProject']} */
		provisionProject(body) {
			return request('/v1/provisioning/projects', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
		},
		/** @type {import('./contracts.js').IKuundaProvisioningClient['listProjectTables']} */
		listProjectTables(projectId) {
			return request(`/v1/provisioning/projects/${encodeURIComponent(projectId)}/tables`);
		},
		/** @type {import('./contracts.js').IPublishClient['enqueuePublishJob']} */
		enqueuePublishJob(body) {
			return request('/v1/publishing/jobs', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});
		},
		/** @type {import('./contracts.js').IPublishClient['getPublishJob']} */
		getPublishJob(jobId, userId) {
			return request(`/v1/publishing/jobs/${encodeURIComponent(jobId)}?userId=${encodeURIComponent(userId)}`);
		},
		/** @type {import('./contracts.js').IPublishClient['getPublishLogs']} */
		getPublishLogs(jobId, userId) {
			return request(`/v1/publishing/jobs/${encodeURIComponent(jobId)}/logs?userId=${encodeURIComponent(userId)}`);
		},
		/** @type {import('./contracts.js').IFeedbackClient['submitFeedback']} */
		submitFeedback(body) {
			return request('/v1/feedback', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});
		},
		/** @type {import('./contracts.js').IAuthClient['signupAccount']} */
		signupAccount(body) {
			return request('/v1/auth/signup', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});
		},
		/** @type {import('./contracts.js').IAuthClient['loginAccount']} */
		loginAccount(body) {
			return request('/v1/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});
		},
		/** @type {import('./contracts.js').IAuthClient['startOAuth']} */
		startOAuth(body) {
			return request('/v1/auth/oauth/start', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});
		},
		/** @type {import('./contracts.js').IAuthClient['finishOAuth']} */
		finishOAuth(body) {
			return request('/v1/auth/oauth/finish', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});
		},
		/** @type {import('./contracts.js').IAuthClient['startDevice']} */
		startDevice() {
			return request('/v1/auth/device/start', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ client: 'ide' }),
			});
		},
		/** @type {import('./contracts.js').IAuthClient['pollDevice']} */
		pollDevice(body) {
			return request('/v1/auth/device/poll', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});
		},
		/** @type {import('./contracts.js').IAuthClient['refreshSession']} */
		refreshSession(body) {
			return request('/v1/auth/refresh', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body),
			});
		},
		/** @type {import('./contracts.js').IAuthClient['logoutSession']} */
		logoutSession() {
			return request('/v1/auth/logout', { method: 'POST' });
		},
		/** @type {import('./contracts.js').IAuthClient['getAccountMe']} */
		getAccountMe() {
			return request('/v1/account/me');
		},
		/** @type {import('./contracts.js').IAuthClient['getAccountUsage']} */
		getAccountUsage() {
			return request('/v1/account/usage');
		},
		/** @type {import('./contracts.js').IAuthClient['listAccountSessions']} */
		listAccountSessions() {
			return request('/v1/account/sessions');
		},
		/** @type {import('./contracts.js').IAuthClient['revokeAccountSession']} */
		revokeAccountSession(sessionId) {
			return request(`/v1/account/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
		},
		/** @type {import('./contracts.js').IAuthClient['createWebHandoff']} */
		createWebHandoff() {
			return request('/v1/auth/web-handoff', { method: 'POST' });
		},
	};
}
