/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
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
	OAuthProvider,
	classifyAuthError,
	isAuthCallbackUri,
	isStrongPassword,
	isValidEmail,
	parseAccountProfile,
	parseAccountSessions,
	parseAuthCallbackQuery,
	parseAuthTokens,
	parseDeviceStart,
	parseUsageSnapshot,
	redirectUriForProtocol,
} from './accountPolicy.js';

const ACCESS_KEY = 'kuunda.account.accessToken';
const REFRESH_KEY = 'kuunda.account.refreshToken';
const PROFILE_KEY = 'kuunda.account.profile';

export type AccountAuthResult = { ok: true; profile: AccountProfile } | { ok: false; error: AuthErrorCode };

export interface IKuundaAccountService {
	readonly _serviceBrand: undefined;
	readonly onDidChangeSession: Event<AccountProfile | undefined>;
	getSession(): AccountProfile | undefined;
	getAccessToken(): Promise<string | undefined>;
	signInEmail(email: string, password: string): Promise<AccountAuthResult>;
	signUpEmail(email: string, password: string, displayName?: string): Promise<AccountAuthResult>;
	startOAuth(provider: OAuthProvider): Promise<AccountAuthResult | { ok: true; authorizationUrl: string }>;
	completeOAuthCallback(query: string | undefined): Promise<AccountAuthResult>;
	isAuthCallback(uri: { scheme?: string; authority?: string }): boolean;
	startDevicePairing(): Promise<{ ok: true; device: DeviceAuthStart } | { ok: false; error: AuthErrorCode }>;
	pollDevicePairing(deviceCode: string): Promise<AccountAuthResult | { ok: true; pending: true }>;
	refreshProfile(): Promise<AccountProfile | undefined>;
	loadUsage(): Promise<AccountUsageSnapshot | undefined>;
	listSessions(): Promise<AccountDeviceSession[]>;
	revokeSession(sessionId: string): Promise<AccountAuthResult | { ok: true }>;
	createWebHandoff(): Promise<{ ok: true; url: string } | { ok: false; error: AuthErrorCode }>;
	signOut(everywhere?: boolean): Promise<void>;
}

export const IKuundaAccountService = createDecorator<IKuundaAccountService>('kuundaAccountService');

type PendingOAuth = { provider: OAuthProvider; verifier: string; state: string };

export class KuundaAccountService extends Disposable implements IKuundaAccountService {
	declare readonly _serviceBrand: undefined;

	private profile: AccountProfile | undefined;
	private pendingOAuth: PendingOAuth | undefined;
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

	async getAccessToken(): Promise<string | undefined> {
		const token = await this.secretStorageService.get(ACCESS_KEY);
		return token?.trim() || undefined;
	}

	isAuthCallback(uri: { scheme?: string; authority?: string }): boolean {
		return isAuthCallbackUri(uri, this.productService.urlProtocol);
	}

	async signInEmail(email: string, password: string): Promise<AccountAuthResult> {
		const gate = this.gateCredentials(email, password);
		if (gate) {
			return gate;
		}
		return this.postSession('/v1/auth/login', { email: email.trim(), password });
	}

	async signUpEmail(email: string, password: string, displayName?: string): Promise<AccountAuthResult> {
		const gate = this.gateCredentials(email, password);
		if (gate) {
			return gate;
		}
		return this.postSession('/v1/auth/signup', { email: email.trim(), password, displayName: displayName?.trim() || undefined });
	}

	async startOAuth(provider: OAuthProvider): Promise<AccountAuthResult | { ok: true; authorizationUrl: string }> {
		const blocked = this.blocked();
		if (blocked) {
			return blocked;
		}
		try {
			const pkce = await createPkce();
			this.pendingOAuth = { provider, verifier: pkce.verifier, state: pkce.state };
			const raw = await this.request('/v1/auth/oauth/start', {
				method: 'POST',
				json: {
					provider,
					redirectUri: redirectUriForProtocol(this.productService.urlProtocol),
					codeChallenge: pkce.challenge,
					state: pkce.state,
				},
			});
			const authorizationUrl = String((raw as { authorizationUrl?: unknown })?.authorizationUrl || (raw as { url?: unknown })?.url || '').trim();
			if (!authorizationUrl) {
				return { ok: false, error: 'unavailable' };
			}
			return { ok: true, authorizationUrl };
		} catch (error) {
			return { ok: false, error: classifyAuthError(error) };
		}
	}

	async completeOAuthCallback(query: string | undefined): Promise<AccountAuthResult> {
		const parsed = parseAuthCallbackQuery(query);
		if (parsed.error) {
			this.pendingOAuth = undefined;
			return { ok: false, error: classifyAuthError(parsed.error) };
		}
		const pending = this.pendingOAuth;
		if (!pending || !parsed.code || parsed.state !== pending.state) {
			return { ok: false, error: 'expired' };
		}
		this.pendingOAuth = undefined;
		return this.postSession('/v1/auth/oauth/finish', {
			provider: pending.provider,
			code: parsed.code,
			codeVerifier: pending.verifier,
			state: pending.state,
		});
	}

	async startDevicePairing(): Promise<{ ok: true; device: DeviceAuthStart } | { ok: false; error: AuthErrorCode }> {
		const blocked = this.blocked();
		if (blocked) {
			return blocked;
		}
		try {
			const raw = await this.request('/v1/auth/device/start', { method: 'POST', json: { client: 'ide' } });
			const device = parseDeviceStart(raw);
			if (!device) {
				return { ok: false, error: 'unavailable' };
			}
			return { ok: true, device };
		} catch (error) {
			return { ok: false, error: classifyAuthError(error) };
		}
	}

	async pollDevicePairing(deviceCode: string): Promise<AccountAuthResult | { ok: true; pending: true }> {
		try {
			const raw = await this.request('/v1/auth/device/poll', { method: 'POST', json: { deviceCode } });
			if (raw && typeof raw === 'object' && (raw as { pending?: unknown }).pending === true) {
				return { ok: true, pending: true };
			}
			const session = parseAuthTokens(raw);
			if (!session) {
				return { ok: true, pending: true };
			}
			await this.persistSession(session);
			return { ok: true, profile: session.profile };
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

	private gateCredentials(email: string, password: string): AccountAuthResult | undefined {
		const blocked = this.blocked();
		if (blocked) {
			return blocked;
		}
		if (!isValidEmail(email)) {
			return { ok: false, error: 'invalid_email' };
		}
		if (!isStrongPassword(password)) {
			return { ok: false, error: 'weak_password' };
		}
		return undefined;
	}

	private blocked(): { ok: false; error: AuthErrorCode } | undefined {
		if (!this.legalService.decideSend('auth').ok) {
			return { ok: false, error: 'strict_offline' };
		}
		return undefined;
	}

	private async postSession(path: string, json: object): Promise<AccountAuthResult> {
		try {
			const session = parseAuthTokens(await this.request(path, { method: 'POST', json }));
			if (!session) {
				return { ok: false, error: 'unavailable' };
			}
			await this.persistSession(session);
			return { ok: true, profile: session.profile };
		} catch (error) {
			return { ok: false, error: classifyAuthError(error) };
		}
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
		this.pendingOAuth = undefined;
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
		}
		const response = await fetchWithTimeout(`${DEFAULT_API_BASE_URL}${path}`, {
			method: init.method ?? 'GET',
			headers,
			body: init.json !== undefined ? JSON.stringify(init.json) : undefined,
		});
		if (!response.ok) {
			const network = classifyNetworkError(new Error(`platform_http_${response.status}`), { status: response.status });
			if (network === 'timeout') {
				throw new Error('platform_timeout');
			}
			throw new Error(`platform_http_${response.status}`);
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

async function createPkce(): Promise<{ verifier: string; challenge: string; state: string }> {
	const verifierBytes = crypto.getRandomValues(new Uint8Array(32));
	const stateBytes = crypto.getRandomValues(new Uint8Array(16));
	const verifier = toBase64Url(verifierBytes);
	const state = toBase64Url(stateBytes);
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
	return { verifier, challenge: toBase64Url(new Uint8Array(digest)), state };
}
