/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

export const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
export const NETWORK_ERROR_CODES = ['timeout', 'offline', 'http', 'unknown'] as const;
export type NetworkErrorCode = typeof NETWORK_ERROR_CODES[number];

export function classifyNetworkError(error: unknown, extras: { status?: number } = {}): NetworkErrorCode {
	if (typeof extras.status === 'number' && extras.status >= 400) {
		if (extras.status === 408 || extras.status === 504 || extras.status === 524) {
			return 'timeout';
		}
		return 'http';
	}
	const name = error && typeof error === 'object' && 'name' in error ? String((error as { name?: unknown }).name) : '';
	const code = error && typeof error === 'object' && 'code' in error ? String((error as { code?: unknown }).code) : '';
	const message = String((error && typeof error === 'object' && 'message' in error ? (error as { message?: unknown }).message : error) || '');
	if (
		name === 'AbortError' ||
		code === 'timeout' ||
		code === 'ETIMEDOUT' ||
		/platform_timeout|aborted|timed?\s*out/i.test(message)
	) {
		return 'timeout';
	}
	if (
		code === 'offline' ||
		code === 'ENOTFOUND' ||
		code === 'ECONNREFUSED' ||
		code === 'EAI_AGAIN' ||
		/platform_offline|failed to fetch|networkerror|offline|fetch failed/i.test(message)
	) {
		return 'offline';
	}
	if (code === 'http' || /platform_http_/i.test(message)) {
		return 'http';
	}
	return 'unknown';
}

export function createTimeoutSignal(timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS, parent?: AbortSignal): { signal: AbortSignal; dispose(): void } {
	const controller = new AbortController();
	const ms = Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_REQUEST_TIMEOUT_MS;
	const timer = setTimeout(() => controller.abort(), ms);
	if (parent) {
		if (parent.aborted) {
			controller.abort();
		} else {
			parent.addEventListener('abort', () => controller.abort(), { once: true });
		}
	}
	return {
		signal: controller.signal,
		dispose() {
			clearTimeout(timer);
		},
	};
}

export async function fetchWithTimeout(url: string | URL, init: RequestInit = {}, options: { timeoutMs?: number; fetchImpl?: typeof fetch } = {}): Promise<Response> {
	const fetchImpl = options.fetchImpl ?? globalThis.fetch;
	if (typeof fetchImpl !== 'function') {
		throw Object.assign(new Error('platform_offline'), { code: 'offline' });
	}
	const timeoutMs = Number.isFinite(options.timeoutMs) && options.timeoutMs > 0
		? options.timeoutMs
		: DEFAULT_REQUEST_TIMEOUT_MS;
	const timeout = createTimeoutSignal(timeoutMs, init.signal ?? undefined);
	let timer: ReturnType<typeof setTimeout> | undefined;
	const aborted = new Promise<Response>((_, reject) => {
		const fail = () => {
			reject(Object.assign(new Error('platform_timeout'), { name: 'AbortError', code: 'timeout' }));
		};
		if (timeout.signal.aborted) {
			fail();
			return;
		}
		timer = setTimeout(fail, timeoutMs);
		timeout.signal.addEventListener('abort', fail, { once: true });
	});
	try {
		return await Promise.race([
			fetchImpl(url, { ...init, signal: timeout.signal }),
			aborted,
		]);
	} catch (error) {
		const code = classifyNetworkError(error);
		const wrapped = Object.assign(
			new Error(code === 'timeout' ? 'platform_timeout' : code === 'offline' ? 'platform_offline' : 'platform_network'),
			{ code, cause: error },
		);
		throw wrapped;
	} finally {
		clearTimeout(timer);
		timeout.dispose();
	}
}
