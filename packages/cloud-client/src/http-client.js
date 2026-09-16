import { DEFAULT_API_BASE_URL } from './contracts.js';

/**
 * HTTP client with no embedded secrets. The caller injects a bearer token
 * obtained at runtime (never from a committed file).
 *
 * @param {object} options
 * @param {string} [options.baseUrl]
 * @param {() => Promise<string | null> | string | null} [options.getAccessToken]
 * @param {typeof fetch} [options.fetchImpl]
 */
export function createPlatformClient(options = {}) {
	const baseUrl = (options.baseUrl ?? DEFAULT_API_BASE_URL).replace(/\/$/, '');
	const fetchImpl = options.fetchImpl ?? globalThis.fetch;
	const getAccessToken = options.getAccessToken ?? (async () => null);

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
		const response = await fetchImpl(`${baseUrl}${path}`, { ...init, headers });
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
		/** @type {import('./contracts.js').IBillingClient['listPlans']} */
		listPlans() {
			return request('/v1/billing/plans');
		},
		/** @type {import('./contracts.js').IBillingClient['listTransactions']} */
		listTransactions(userId) {
			return request(`/v1/billing/transactions?userId=${encodeURIComponent(userId)}`);
		},
		/** @type {import('./contracts.js').IKuundaProvisioningClient['provisionProject']} */
		provisionProject(body) {
			return request('/v1/provisioning/projects', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(body)
			});
		}
	};
}
