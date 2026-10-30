/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { isMacintosh, isWindows } from '../../../../base/common/platform.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { ISecretStorageService } from '../../../../platform/secrets/common/secrets.js';
import { IProductService } from '../../../../platform/product/common/productService.js';
import { classifyNetworkError, fetchWithTimeout } from '../../kuundaAi/common/networkPolicy.js';
import { IKuundaLegalService } from '../../kuundaLegal/common/kuundaLegalService.js';
import {
	AccountDeviceSession,
	AccountProfile,
	AccountUsageSnapshot,
	AuthErrorCode,
	DEFAULT_API_BASE_URL,
	DeviceAuthStart,
	classifyAuthError,
	isAuthCallbackUri,
	parseAccountProfile,
	parseAccountSessions,
	parseAuthCallbackQuery,
	parseAuthTokens,
	parseDeviceStart,
	parseUsageSnapshot,
} from './accountPolicy.js';

const ACCESS_KEY = 'kuunda.account.accessToken';
const REFRESH_KEY = 'kuunda.account.refreshToken';
const PROFILE_KEY = 'kuunda.account.profile';
const DEVICE_ID_KEY = 'kuunda.account.deviceId';

export type AccountAuthResult = { ok: true; profile: AccountProfile } | { ok: false; error: AuthErrorCode };

export interface IKuundaAccountService {
	readonly _serviceBrand: undefined;
	readonly onDidChangeSession: Event<AccountProfile | undefined>;
	getSession(): AccountProfile | undefined;
	/** The server resolved this session to the same user id as the web account. */
	relinkUserId(userId: string): void;
	getAccessToken(): Promise<string | undefined>;
	/**
	 * Handles a `kuunda-vibe://auth/...` deep link fired by the website after the
	 * user signs in there. Returns `pending` when the session is not ready yet.
	 */
	completeWebCallback(query: string | undefined): Promise<AccountAuthResult | { ok: true; pending: true }>;
	isAuthCallback(uri: { scheme?: string; authority?: string }): boolean;
	hasPendingDevicePairing(): boolean;
	startDevicePairing(): Promise<{ ok: true; device: DeviceAuthStart } | { ok: false; error: AuthErrorCode }>;
	pollDevicePairing(pairingId: string): Promise<AccountAuthResult | { ok: true; pending: true }>;
	refreshProfile(): Promise<AccountProfile | undefined>;
	loadUsage(): Promise<AccountUsageSnapshot | undefined>;
	listSessions(): Promise<AccountDeviceSession[]>;
	revokeSession(sessionId: string): Promise<AccountAuthResult | { ok: true }>;
	createWebHandoff(): Promise<{ ok: true; url: string } | { ok: false; error: AuthErrorCode }>;
	signOut(everywhere?: boolean): Promise<void>;
}

export const IKuundaAccountService = createDecorator<IKuundaAccountService>('kuundaAccountService');

type PendingDevice = { pairingId: string; challenge: string; expiresAt: number };

export class KuundaAccountService extends Disposable implements IKuundaAccountService {
	declare readonly _serviceBrand: undefined;

	private profile: AccountProfile | undefined;
	private pendingDevice: PendingDevice | undefined;
	private readonly _onDidChangeSession = this._register(new Emitter<AccountProfile | undefined>());
	readonly onDidChangeSession = this._onDidChangeSession.event;

	constructor(
		@IStorageService private readonly storageService: IStorageService,
		@ISecretStorageService private readonly secretStorageService: ISecretStorageService,
		@IProductService private readonly productService: IProductService,
		@IKuundaLegalService private readonly legalService: IKuundaLegalService,
	) {
		super();
		this.profile = this.readCachedProfile();
		void this.restore();
	}

	getSession(): AccountProfile | undefined {
		return this.profile;
	}

	relinkUserId(userId: string): void {
		const next = userId.trim();
		if (!this.profile || !next || this.profile.userId === next) {
			return;
		}
		this.profile = { ...this.profile, userId: next };
		this.storageService.store(PROFILE_KEY, JSON.stringify(this.profile), StorageScope.APPLICATION, StorageTarget.USER);
		this._onDidChangeSession.fire(this.profile);
	}

	async getAccessToken(): Promise<string | undefined> {
		const token = await this.secretStorageService.get(ACCESS_KEY);
		return token?.trim() || undefined;
	}

	isAuthCallback(uri: { scheme?: string; authority?: string }): boolean {
		return isAuthCallbackUri(uri, this.productService.urlProtocol);
	}

	hasPendingDevicePairing(): boolean {
		return !!this.pendingDevice && this.pendingDevice.expiresAt > Date.now();
	}

	async completeWebCallback(query: string | undefined): Promise<AccountAuthResult | { ok: true; pending: true }> {
		const parsed = parseAuthCallbackQuery(query);
		if (parsed.error) {
			this.pendingDevice = undefined;
			return { ok: false, error: classifyAuthError(parsed.error) };
		}
		const pending = this.pendingDevice;
		if (!pending || pending.expiresAt <= Date.now()) {
			return { ok: false, error: 'expired' };
		}
		// The site may echo the pairing id back; the challenge never leaves this device.
		const code = parsed.deviceCode || parsed.code;
		if (code && code !== pending.pairingId) {
			return { ok: false, error: 'expired' };
		}
		return this.pollDevicePairing(pending.pairingId);
	}

	async startDevicePairing(): Promise<{ ok: true; device: DeviceAuthStart } | { ok: false; error: AuthErrorCode }> {
		const blocked = this.blocked();
		if (blocked) {
			return blocked;
		}
		try {
			const challenge = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
			const platform = isWindows ? 'windows' : isMacintosh ? 'macos' : 'linux';
			const raw = await this.request('/v1/auth/device-pairing/start', {
				method: 'POST',
				json: { deviceId: await this.deviceId(), label: `Kuunda Vibe (${platform})`, platform, challenge },
			});
			const device = parseDeviceStart(raw);
			if (!device) {
				return { ok: false, error: 'unavailable' };
			}
			this.pendingDevice = { pairingId: device.pairingId, challenge, expiresAt: Date.now() + device.expiresIn * 1000 };
			return { ok: true, device };
		} catch (error) {
			return { ok: false, error: classifyAuthError(error) };
		}
	}

	async pollDevicePairing(pairingId: string): Promise<AccountAuthResult | { ok: true; pending: true }> {
		const blocked = this.blocked();
		if (blocked) {
			return blocked;
		}
		const pending = this.pendingDevice;
		if (!pending || pending.pairingId !== pairingId) {
			return { ok: false, error: 'expired' };
		}
		if (pending.expiresAt <= Date.now()) {
			this.pendingDevice = undefined;
			return { ok: false, error: 'expired' };
		}
		try {
			const raw = await this.request('/v1/auth/device-pairing/poll', { method: 'POST', json: { pairingId, challenge: pending.challenge } });
			const status = String((raw as { status?: unknown })?.status || '');
			if (status === 'pending') {
				return { ok: true, pending: true };
			}
			if (status === 'approved') {
				const session = parseAuthTokens(raw);
				if (!session) {
					return { ok: true, pending: true };
				}
				this.pendingDevice = undefined;
				await this.persistSession(session);
				void this.refreshProfile();
				return { ok: true, profile: session.profile };
			}
			this.pendingDevice = undefined;
			return { ok: false, error: status === 'denied' ? 'oauth_denied' : 'expired' };
		} catch (error) {
			const code = classifyAuthError(error);
			if (code === 'invalid_email' || code === 'expired') {
				return { ok: true, pending: true };
			}
			return { ok: false, error: code };
		}
	}

	async refreshProfile(): Promise<AccountProfile | undefined> {
		if (!this.legalService.decideSend('auth').ok) {
			return this.profile;
		}
		try {
			const raw = await this.request('/v1/account/me');
			const profile = parseAccountProfile(raw);
			if (profile.userId) {
				this.profile = profile;
				this.storageService.store(PROFILE_KEY, JSON.stringify(profile), StorageScope.APPLICATION, StorageTarget.USER);
				this._onDidChangeSession.fire(profile);
			}
			return this.profile;
		} catch (error) {
			if (String((error as Error).message || '').includes('401')) {
				await this.tryRefresh();
			}
			return this.profile;
		}
	}

	async loadUsage(): Promise<AccountUsageSnapshot | undefined> {
		if (!this.legalService.decideSend('auth').ok || !this.profile) {
			return undefined;
		}
		try {
			return parseUsageSnapshot(await this.request('/v1/account/usage'));
		} catch {
			return undefined;
		}
	}

	async listSessions(): Promise<AccountDeviceSession[]> {
		if (!this.profile) {
			return [];
		}
		try {
			return parseAccountSessions(await this.request('/v1/account/sessions'));
		} catch {
			return [];
		}
	}

	async revokeSession(sessionId: string): Promise<AccountAuthResult | { ok: true }> {
		try {
			await this.request(`/v1/account/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
			if (this.profile) {
				return { ok: true, profile: this.profile };
			}
			return { ok: true };
		} catch (error) {
			return { ok: false, error: classifyAuthError(error) };
		}
	}

	async createWebHandoff(): Promise<{ ok: true; url: string } | { ok: false; error: AuthErrorCode }> {
		const blocked = this.blocked();
		if (blocked) {
			return blocked;
		}
		try {
			const raw = await this.request('/v1/auth/web-handoff', { method: 'POST' });
			const url = String((raw as { url?: unknown })?.url || '').trim();
			if (!url) {
				return { ok: false, error: 'unavailable' };
			}
			return { ok: true, url };
		} catch (error) {
			return { ok: false, error: classifyAuthError(error) };
		}
	}

	async signOut(everywhere = false): Promise<void> {
		try {
			if (everywhere) {
				await this.request('/v1/auth/logout', { method: 'POST', json: { everywhere: true } });
			} else {
				await this.request('/v1/auth/logout', { method: 'POST' });
			}
		} catch {
			// Local sign-out still proceeds.
		}
		await this.clearLocal();
	}

	private async deviceId(): Promise<string> {
		const existing = this.storageService.get(DEVICE_ID_KEY, StorageScope.APPLICATION);
		if (existing) {
			return existing;
		}
		const id = generateUuid();
		this.storageService.store(DEVICE_ID_KEY, id, StorageScope.APPLICATION, StorageTarget.MACHINE);
		return id;
	}

	private blocked(): { ok: false; error: AuthErrorCode } | undefined {
		if (!this.legalService.decideSend('auth').ok) {
			return { ok: false, error: 'strict_offline' };
		}
		return undefined;
	}

	private async persistSession(session: { accessToken: string; refreshToken?: string; profile: AccountProfile }): Promise<void> {
		await this.secretStorageService.set(ACCESS_KEY, session.accessToken);
		if (session.refreshToken) {
			await this.secretStorageService.set(REFRESH_KEY, session.refreshToken);
		}
		this.profile = session.profile;
		this.storageService.store(PROFILE_KEY, JSON.stringify(session.profile), StorageScope.APPLICATION, StorageTarget.USER);
		this._onDidChangeSession.fire(session.profile);
	}

	private async clearLocal(): Promise<void> {
		await this.secretStorageService.delete(ACCESS_KEY);
		await this.secretStorageService.delete(REFRESH_KEY);
		this.storageService.remove(PROFILE_KEY, StorageScope.APPLICATION);
		this.profile = undefined;
		this.pendingDevice = undefined;
		this._onDidChangeSession.fire(undefined);
	}

	private readCachedProfile(): AccountProfile | undefined {
		const raw = this.storageService.get(PROFILE_KEY, StorageScope.APPLICATION);
		if (!raw) {
			return undefined;
		}
		try {
			const profile = parseAccountProfile(JSON.parse(raw));
			return profile.userId ? profile : undefined;
		} catch {
			return undefined;
		}
	}

	private async restore(): Promise<void> {
		const token = await this.getAccessToken();
		if (!token) {
			const refresh = await this.secretStorageService.get(REFRESH_KEY);
			if (refresh) {
				await this.tryRefresh();
			}
			return;
		}
		await this.refreshProfile();
	}

	private async tryRefresh(): Promise<void> {
		const refreshToken = await this.secretStorageService.get(REFRESH_KEY);
		if (!refreshToken) {
			await this.clearLocal();
			return;
		}
		try {
			const session = parseAuthTokens(await this.request('/v1/auth/refresh', { method: 'POST', json: { refreshToken } }));
			if (session) {
				await this.persistSession(session);
			}
		} catch {
			await this.clearLocal();
		}
	}

	private async request(path: string, init: { method?: string; json?: unknown } = {}): Promise<unknown> {
		const headers = new Headers({ Accept: 'application/json' });
		if (init.json !== undefined) {
			headers.set('Content-Type', 'application/json');
		}
		const token = await this.getAccessToken();
		if (token) {
			headers.set('Authorization', `Bearer ${token}`);
			// Device-bound sessions (5-part tokens) must prove the pairing to the API.
			const parts = token.split('.');
			if (parts.length === 5) {
				headers.set('X-Kuunda-Device', parts[2]);
			}
		}
		const response = await fetchWithTimeout(`${DEFAULT_API_BASE_URL}${path}`, {
			method: init.method ?? 'GET',
			headers,
			body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
		});
		if (!response.ok) {
			let detail = '';
			try {
				const data = await response.json() as { error?: unknown };
				const code = String(data?.error || '').trim().toLowerCase();
				if (/^[a-z0-9_]{1,64}$/.test(code)) {
					detail = `:${code}`;
				}
			} catch {
				detail = '';
			}
			const network = classifyNetworkError(new Error(`platform_http_${response.status}`), { status: response.status });
			if (network === 'timeout') {
				throw new Error('platform_timeout');
			}
			throw new Error(`platform_http_${response.status}${detail}`);
		}
		if (response.status === 204) {
			return null;
		}
		return response.json();
	}
}

registerSingleton(IKuundaAccountService, KuundaAccountService, InstantiationType.Delayed);

function toBase64Url(bytes: Uint8Array): string {
	let binary = '';
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}
