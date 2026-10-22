/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { URI } from '../../../../base/common/uri.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { dirname, joinPath } from '../../../../base/common/resources.js';
import { generateUuid } from '../../../../base/common/uuid.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IKuundaAccountService } from '../../kuundaAccount/common/kuundaAccountService.js';
import { IKuundaProjectService } from '../../kuundaProject/common/kuundaProjectService.js';
import { PROJECT_MANIFEST_PATH, type ProjectManifest } from '../../kuundaProject/common/projectType.js';
import {
	CLOUD_CLIENT_PATH,
	CLOUD_ENV_PATH,
	CLOUD_LOCAL_PATH,
	CLOUD_ACCOUNT_PREFIX,
	CLOUD_ACCOUNT_STORAGE_KEY,
	DEFAULT_API_BASE_URL,
	DEFAULT_CLOUD_PLAN,
	decideCloudProvisioning,
	formatCloudContext,
	formatCloudPanel,
	ROUTE_FAMILIES,
	sanitizeRouteMode,
	mergeGitignore,
	parseCloudSettings,
	parseGitRemote,
	persistableAnonKey,
	publicCloudRecord,
	redactCloudPayload,
	resolveCloudRecordAfterDecision,
	sanitizeLinkCode,
	sanitizeOwnerId,
	sanitizePlanId,
	sanitizeProjectRef,
	sanitizeRepoUrl,
	scaffoldCloudFiles,
	serializeManifestWithCloud,
	type CloudFile,
	type CloudRecord,
	type CloudRouteFamilyReport,
	type CloudRouteMode,
	type CloudRouteReport,
	type CloudTable,
} from './cloudProvision.js';
import { classifyNetworkError, fetchWithTimeout } from '../../kuundaAi/common/networkPolicy.js';
import { IKuundaLegalService } from '../../kuundaLegal/common/kuundaLegalService.js';

export type CloudProvisionInput = {
	type?: string;
	name?: string;
	enabled?: boolean;
	replace?: boolean;
};

export type CloudProvisionResult = {
	ok: true;
	action: 'skip' | 'reuse' | 'pending_user' | 'pending_api' | 'provision';
	cloud: CloudRecord;
	tables: CloudTable[];
	network?: 'timeout' | 'offline';
} | { ok: false; error: string };

export type CloudPublicStatus = {
	available: true;
	enabled: boolean;
	projectRef?: string;
	env?: string;
	plan?: string;
	action?: string;
};

/** Catalog entry returned by the Kuunda Cloud plan API. */
export type CloudPlan = {
	id: string;
	name?: string;
	price?: { amount?: number; currency?: string };
	current?: boolean;
};

/** One project in the account inventory held by Kuunda Cloud. */
export type CloudProjectRow = {
	projectRef: string;
	name?: string;
	type?: string;
	plan: string;
	env?: string;
	url?: string;
	/** Source location, so a fresh machine knows where to clone the code. */
	repo?: string;
	status: 'active' | 'archived';
};

export type CloudSyncResult = {
	ok: boolean;
	/** Local projects that just got a Cloud space. */
	linked: number;
	/** Inventory rows that this machine does not have a local folder for. */
	remoteOnly: number;
	/** Remote-only rows that are archived and can be restored. */
	archived: number;
	error?: string;
};

export interface IKuundaCloudService {
	readonly _serviceBrand: undefined;
	readonly onDidChange: Event<void>;
	provisionFolder(folder: URI, input?: CloudProvisionInput): Promise<CloudProvisionResult>;
	setEnabled(folder: URI, enabled: boolean): Promise<CloudProvisionResult>;
	replace(folder: URI): Promise<CloudProvisionResult>;
	/**
	 * Cloud is anonymous-first: users never create a Kuunda Cloud account, so this
	 * only reports whether a sign-in would still help (never blocks provisioning).
	 */
	needsStudioLink(): Promise<boolean>;
	retryUnlinkedFolders(): Promise<CloudProvisionResult[]>;
	formatPanel(): Promise<string>;
	formatContext(): Promise<string>;
	lastPublicStatus(): CloudPublicStatus;
	/**
	 * Main Kuunda Vibe account id: one per installation, created automatically.
	 * Never requires a Kuunda Cloud signup or a web account.
	 */
	accountId(): Promise<string>;
	/**
	 * Reconciles the whole install with the account inventory: pushes local projects
	 * that have no Cloud space yet, then adopts the plan/status the server reports.
	 */
	syncProjects(): Promise<CloudSyncResult>;
	lastSync(): CloudSyncResult | undefined;
	/** Aggregate of every project centralised under the account. */
	accountProjects(): Promise<CloudProjectRow[]>;
	/** Archived Cloud spaces recoverable by the user. */
	archivedProjects(): Promise<CloudProjectRow[]>;
	/** Archives the Cloud space of this project instead of destroying it. */
	archiveFolder(folder: URI): Promise<CloudProvisionResult>;
	/** Brings an archived Cloud space back. */
	restoreProject(projectRef: string): Promise<{ ok: true } | { ok: false; error: string }>;
	/** Starts a link so another machine can adopt this same account (no web account). */
	linkAccount(): Promise<{ ok: true; code: string } | { ok: false; error: string }>;
	/** Adopts the account of another machine, replacing the local one. */
	adoptAccount(code: string): Promise<{ ok: true } | { ok: false; error: string }>;
	/** Plan id stored on the project manifest (defaults to `standard`). */
	currentPlan(folder: URI): Promise<string>;
	listPlans(): Promise<CloudPlan[]>;
	/** Records `planId` on the project without contacting the platform. */
	setPlan(folder: URI, planId: string): Promise<CloudProvisionResult>;
	/**
	 * Asks the platform to move the project to `planId`. Paid plans return a hosted
	 * checkout URL to open in the browser; the plan is recorded locally either way.
	 */
	startPlanCheckout(folder: URI, planId: string): Promise<{ ok: true; checkoutUrl?: string } | { ok: false; error: string }>;
	/** Anonymous, install-scoped owner id used when the user is not signed in. */
	ownerId(): Promise<string>;
	/**
	 * Which route family is served by the spec, counted per profile across restarts.
	 * `legacyRemovable` is the evidence needed to delete the legacy fallback.
	 */
	routeReport(): CloudRouteReport;
	/** Clears the route evidence, e.g. after a platform change invalidates it. */
	resetRouteEvidence(): void;
}

export const IKuundaCloudService = createDecorator<IKuundaCloudService>('kuundaCloudService');

type ProvisionApiResult = {
	projectId?: string;
	kuundaProjectRef?: string;
	env?: string;
	url?: string;
	anonKey?: string;
	planId?: string;
	tables?: CloudTable[];
};

type RouteFlavor = 'spec' | 'legacy';

/** How long a route probe result is trusted before we re-check the spec routes. */
const ROUTE_PROBE_TTL = 10 * 60 * 1000;

/** `kuunda.cloud.legacyRoutes`: `auto` falls back to legacy, `off` never does. */
const ROUTE_MODE_SETTING = 'kuunda.cloud.legacyRoutes';

/** Route counters survive restarts: cross-session evidence is what makes removal safe. */
const ROUTE_EVIDENCE_STORAGE_KEY = 'kuunda.cloud.routeEvidence';

type RouteEvidence = { spec: number; legacy: number; lastRoute?: RouteFlavor };

export class KuundaCloudService extends Disposable implements IKuundaCloudService {
	declare readonly _serviceBrand: undefined;

	private snapshot: CloudPublicStatus = { available: true, enabled: true };
	private tables: CloudTable[] = [];
	private readonly inflight = new Map<string, Promise<CloudProvisionResult>>();
	private retryChain: Promise<CloudProvisionResult[]> = Promise.resolve([]);
	private syncState: CloudSyncResult | undefined;
	private remoteCache: CloudProjectRow[] = [];
	private syncChain: Promise<void> = Promise.resolve();
	private readonly routePreference = new Map<string, { route: RouteFlavor; at: number }>();
	private readonly specFamilies = new Set<string>();
	private readonly routeEvidence = new Map<string, RouteEvidence>();
	private routeEvidenceSince: number | undefined;
	private readonly _onDidChange = this._register(new Emitter<void>());
	readonly onDidChange = this._onDidChange.event;

	constructor(
		@IFileService private readonly fileService: IFileService,
		@IKuundaProjectService private readonly projectService: IKuundaProjectService,
		@IKuundaAccountService private readonly accountService: IKuundaAccountService,
		@IKuundaLegalService private readonly legalService: IKuundaLegalService,
		@IStorageService private readonly storageService: IStorageService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
	) {
		super();
		this.loadRouteEvidence();
		void this.refreshSnapshot();
		this._register(this.accountService.onDidChangeSession(() => {
			void this.refreshSnapshot();
		}));
	}

	async ownerId(): Promise<string> {
		return this.cloudOwnerId();
	}

	routeReport(): CloudRouteReport {
		const known = new Map<string, { family: string; spec: string; legacy: string }>();
		for (const entry of ROUTE_FAMILIES) {
			known.set(entry.family, { family: entry.family, spec: entry.spec, legacy: entry.legacy });
		}
		for (const family of this.routeEvidence.keys()) {
			// Counters stored by an older build may name a family we no longer know.
			if (!known.has(family)) {
				known.set(family, { family, spec: '(unknown)', legacy: '(unknown)' });
			}
		}
		const families: CloudRouteFamilyReport[] = [...known.values()]
			.map((entry) => {
				const calls = this.routeEvidence.get(entry.family);
				return {
					family: entry.family,
					specPath: entry.spec,
					legacyPath: entry.legacy,
					spec: calls ? calls.spec : 0,
					legacy: calls ? calls.legacy : 0,
					lastRoute: calls ? calls.lastRoute : undefined,
				};
			})
			.sort((a, b) => a.family.localeCompare(b.family));
		return {
			mode: this.routeMode(),
			generatedAt: Date.now(),
			since: this.routeEvidenceSince,
			spec: families.reduce((total, row) => total + row.spec, 0),
			legacy: families.reduce((total, row) => total + row.legacy, 0),
			families,
			legacyRemovable: families.length > 0 && families.every((row) => row.spec > 0 && row.legacy === 0),
		};
	}

	resetRouteEvidence(): void {
		this.routeEvidence.clear();
		this.routeEvidenceSince = undefined;
		try {
			this.storageService.remove(ROUTE_EVIDENCE_STORAGE_KEY, StorageScope.PROFILE);
		} catch {
			// Evidence is advisory: a storage failure must never break the client.
		}
	}

	private loadRouteEvidence(): void {
		try {
			const raw = this.storageService.get(ROUTE_EVIDENCE_STORAGE_KEY, StorageScope.PROFILE);
			if (!raw) {
				return;
			}
			const parsed = JSON.parse(raw) as { since?: unknown; families?: Record<string, { spec?: unknown; legacy?: unknown; lastRoute?: unknown }> };
			const since = Number(parsed && parsed.since);
			if (Number.isFinite(since) && since > 0) {
				this.routeEvidenceSince = since;
			}
			const families = parsed && parsed.families;
			if (!families || typeof families !== 'object') {
				return;
			}
			for (const [family, calls] of Object.entries(families)) {
				const spec = this.countCalls(calls && calls.spec);
				const legacy = this.countCalls(calls && calls.legacy);
				if (!spec && !legacy) {
					continue;
				}
				this.routeEvidence.set(family, {
					spec,
					legacy,
					lastRoute: calls && calls.lastRoute === 'legacy' ? 'legacy' : 'spec',
				});
			}
		} catch {
			// Unreadable evidence starts counting fresh instead of blocking the client.
		}
	}

	private countCalls(value: unknown): number {
		return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
	}

	private recordRoute(family: string, route: RouteFlavor): void {
		const calls: RouteEvidence = this.routeEvidence.get(family) || { spec: 0, legacy: 0 };
		if (route === 'spec') {
			calls.spec += 1;
		} else {
			calls.legacy += 1;
		}
		calls.lastRoute = route;
		this.routeEvidence.set(family, calls);
		if (!this.routeEvidenceSince) {
			this.routeEvidenceSince = Date.now();
		}
		try {
			this.storageService.store(ROUTE_EVIDENCE_STORAGE_KEY, JSON.stringify({
				since: this.routeEvidenceSince,
				families: Object.fromEntries([...this.routeEvidence].map(([name, counts]) => [name, { spec: counts.spec, legacy: counts.legacy, lastRoute: counts.lastRoute }])),
			}), StorageScope.PROFILE, StorageTarget.MACHINE);
		} catch {
			// Counting is best-effort: never let evidence storage fail a real call.
		}
	}

	/** `kuunda.cloud.legacyRoutes`: `off` means spec routes only, no legacy fallback. */
	private routeMode(): CloudRouteMode {
		return sanitizeRouteMode(this.configurationService.getValue<string>(ROUTE_MODE_SETTING));
	}

	async accountId(): Promise<string> {
		return this.cloudAccountId();
	}

	lastSync(): CloudSyncResult | undefined {
		return this.syncState ? { ...this.syncState } : undefined;
	}

	async accountProjects(): Promise<CloudProjectRow[]> {
		try {
			return await this.fetchAccountProjects();
		} catch {
			return [];
		}
	}

	async archivedProjects(): Promise<CloudProjectRow[]> {
		const rows = await this.accountProjects();
		return rows.filter((row) => row.status === 'archived');
	}

	async syncProjects(): Promise<CloudSyncResult> {
		if (!this.legalService.decideSend('kuunda_cloud').ok) {
			this.syncState = { ok: false, linked: 0, remoteOnly: 0, archived: 0, error: 'strict_offline' };
			return this.syncState;
		}
		const run = this.syncChain.then(() => this.syncNow(), () => this.syncNow());
		this.syncChain = run.then(() => undefined, () => undefined);
		return run;
	}

	/**
	 * Full reconciliation of this install with the main account: push local projects
	 * that have no Cloud space yet, then adopt the plan/status the account reports.
	 */
	private async syncNow(): Promise<CloudSyncResult> {
		const result: CloudSyncResult = { ok: false, linked: 0, remoteOnly: 0, archived: 0 };
		try {
			for (const provisioned of await this.retryUnlinkedFolders()) {
				if (provisioned.ok && provisioned.action === 'provision') {
					result.linked += 1;
				}
			}
			const rows = await this.fetchAccountProjects();
			const byRef = new Map(rows.map((row) => [row.projectRef, row]));
			const locals = await this.projectService.listWorkspaceManifests();
			for (const local of locals) {
				const cloud = parseCloudSettings(local.manifest);
				if (!cloud.projectRef) {
					continue;
				}
				const remote = byRef.get(cloud.projectRef);
				if (!remote) {
					continue;
				}
				byRef.delete(cloud.projectRef);
				if (remote.plan !== sanitizePlanId(cloud.plan)) {
					await this.setPlan(local.folder, remote.plan);
				}
			}
			// Everything the server knows but this machine does not have locally.
			this.remoteCache = [...byRef.values()];
			result.remoteOnly = this.remoteCache.length;
			result.archived = this.remoteCache.filter((row) => row.status === 'archived').length;
			result.ok = true;
			this.syncState = result;
			this._onDidChange.fire();
			return result;
		} catch (error) {
			this.syncState = { ...result, error: classifyNetworkError(error) };
			return this.syncState;
		}
	}

	async archiveFolder(folder: URI): Promise<CloudProvisionResult> {
		if (!this.legalService.decideSend('kuunda_cloud').ok) {
			return { ok: false, error: 'strict_offline' };
		}
		const state = await this.readState(folder);
		if (!state.manifest) {
			return { ok: false, error: 'write_failed' };
		}
		const ref = state.cloud.projectRef;
		if (ref) {			try {
				const accountId = this.cloudAccountId();
				const response = await this.requestSpecOrLegacy(
					'project.archive',
					`/v1/accounts/${encodeURIComponent(accountId)}/projects/${encodeURIComponent(ref)}/archive`,
					`/v1/account/projects/${encodeURIComponent(ref)}/archive`,
					{ specMethod: 'POST', legacyMethod: 'POST', json: { accountId } },
				);
				if (!response.ok) {
					return { ok: false, error: `platform_http_${response.status}` };
				}
			} catch (error) {
				return { ok: false, error: classifyNetworkError(error) };
			}
		}
		// Keep projectRef: the space stays recoverable, only the local flag flips.
		const cloud = publicCloudRecord({ ...state.cloud, enabled: false });
		try {
			await this.writeManifest(folder, state.manifest, cloud);
			this.remember(cloud, 'archive', this.tables);
			return { ok: true, action: 'skip', cloud, tables: this.tables };
		} catch {
			return { ok: false, error: 'write_failed' };
		}
	}

	async restoreProject(projectRef: string): Promise<{ ok: true } | { ok: false; error: string }> {
		const ref = sanitizeProjectRef(projectRef);
		if (!ref) {
			return { ok: false, error: 'invalid_ref' };
		}
		if (!this.legalService.decideSend('kuunda_cloud').ok) {
			return { ok: false, error: 'strict_offline' };
		}
		try {
			const accountId = this.cloudAccountId();
			const response = await this.requestSpecOrLegacy(
				'project.restore',
				`/v1/accounts/${encodeURIComponent(accountId)}/projects/${encodeURIComponent(ref)}/restore`,
				`/v1/account/projects/${encodeURIComponent(ref)}/restore`,
				{ specMethod: 'POST', legacyMethod: 'POST', json: { accountId } },
			);
			if (!response.ok) {
				return { ok: false, error: `platform_http_${response.status}` };
			}
			this.remoteCache = this.remoteCache.filter((row) => row.projectRef !== ref);
			this._onDidChange.fire();
			return { ok: true };
		} catch (error) {
			return { ok: false, error: classifyNetworkError(error) };
		}
	}

	/**
	 * Cross-machine fix: the account belongs to the user, not to one install. A short
	 * code lets a second machine adopt the exact same account without any web signup.
	 */
	async linkAccount(): Promise<{ ok: true; code: string } | { ok: false; error: string }> {
		if (!this.legalService.decideSend('kuunda_cloud').ok) {
			return { ok: false, error: 'strict_offline' };
		}
		try {
			const accountId = this.cloudAccountId();
			const response = await this.requestSpecOrLegacy(
				'link.start',
				`/v1/accounts/${encodeURIComponent(accountId)}/link/start`,
				'/v1/account/link/start',
				{ specMethod: 'POST', legacyMethod: 'POST', json: { accountId } },
			);
			if (!response.ok) {
				return { ok: false, error: `platform_http_${response.status}` };
			}
			const raw = await response.json() as { code?: unknown };
			const code = sanitizeLinkCode(raw?.code);
			return code ? { ok: true, code } : { ok: false, error: 'invalid_code' };
		} catch (error) {
			return { ok: false, error: classifyNetworkError(error) };
		}
	}

	async adoptAccount(code: string): Promise<{ ok: true } | { ok: false; error: string }> {
		const safe = sanitizeLinkCode(code);
		if (!safe) {
			return { ok: false, error: 'invalid_code' };
		}
		if (!this.legalService.decideSend('kuunda_cloud').ok) {
			return { ok: false, error: 'strict_offline' };
		}
		try {
			const response = await this.requestSpecOrLegacy(
				'link.claim',
				'/v1/accounts/link/claim',
				'/v1/account/link/claim',
				{ specMethod: 'POST', legacyMethod: 'POST', json: { code: safe } },
			);
			if (!response.ok) {
				return { ok: false, error: `platform_http_${response.status}` };
			}
			const raw = await response.json() as { accountId?: unknown };
			const accountId = sanitizeOwnerId(raw?.accountId);
			if (!accountId) {
				return { ok: false, error: 'invalid_account' };
			}
			this.storageService.store(CLOUD_ACCOUNT_STORAGE_KEY, accountId, StorageScope.APPLICATION, StorageTarget.USER);
			this.remoteCache = [];
			this._onDidChange.fire();
			await this.syncProjects();
			return { ok: true };
		} catch (error) {
			return { ok: false, error: classifyNetworkError(error) };
		}
	}

	/**
	 * Source location of the project. Code itself is never synced by us: the record
	 * points at the git remote so any machine can re-clone it.
	 */
	private async readGitRemote(folder: URI): Promise<string | undefined> {
		try {
			return parseGitRemote(await this.readText(folder, '.git/config'));
		} catch {
			return undefined;
		}
	}

	private async fetchAccountProjects(): Promise<CloudProjectRow[]> {			const accountId = encodeURIComponent(this.cloudAccountId());
			const response = await this.requestSpecOrLegacy(
				'projects.list',
				`/v1/accounts/${accountId}/projects`,
				`/v1/account/projects?accountId=${accountId}`,
			);
			if (!response.ok) {
				throw new Error(`platform_http_${response.status}`);
			}
		const raw = await response.json() as { projects?: unknown };
		const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.projects) ? raw.projects : [];
		return rows
			.map((row) => this.safeProjectRow(row))
			.filter((row): row is CloudProjectRow => Boolean(row))
			.slice(0, 500);
	}

	private safeProjectRow(row: unknown): CloudProjectRow | undefined {
		if (!row || typeof row !== 'object') {
			return undefined;
		}
		const data = row as {
			projectRef?: unknown; kuundaProjectRef?: unknown; name?: unknown; type?: unknown;
			plan?: unknown; env?: unknown; url?: unknown; repo?: unknown; status?: unknown;
		};
		const projectRef = sanitizeProjectRef(data.projectRef || data.kuundaProjectRef);
		if (!projectRef) {
			return undefined;
		}
		return {
			projectRef,
			name: typeof data.name === 'string' && data.name.trim() ? data.name.trim().slice(0, 120) : undefined,
			type: typeof data.type === 'string' && data.type.trim() ? data.type.trim().slice(0, 40) : undefined,
			plan: sanitizePlanId(data.plan),
			env: data.env === 'production' || data.env === 'sandbox' ? data.env : undefined,
			url: typeof data.url === 'string' ? data.url.slice(0, 300) : undefined,
			repo: sanitizeRepoUrl(data.repo),
			status: data.status === 'archived' ? 'archived' : 'active',
		};
	}

	async currentPlan(folder: URI): Promise<string> {
		const state = await this.readState(folder);
		return sanitizePlanId(state.cloud.plan);
	}

	async listPlans(): Promise<CloudPlan[]> {
		if (!this.legalService.decideSend('kuunda_cloud').ok) {
			return [];
		}
		try {
			const response = await this.requestSpecOrLegacy('plans', '/v1/plans', '/v1/provisioning/plans');
			if (!response.ok) {
				return [];
			}
			const raw = await response.json() as { plans?: unknown };
			const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.plans) ? raw.plans : [];
			return rows
				.map((row) => this.safePlan(row))
				.filter((plan): plan is CloudPlan => Boolean(plan))
				.slice(0, 50);
		} catch {
			return [];
		}
	}

	async setPlan(folder: URI, planId: string): Promise<CloudProvisionResult> {
		const state = await this.readState(folder);
		if (!state.manifest) {
			return { ok: false, error: 'write_failed' };
		}
		const cloud = publicCloudRecord({ ...state.cloud, plan: sanitizePlanId(planId) });
		try {
			await this.writeManifest(folder, state.manifest, cloud);
			this.remember(cloud, state.cloud.projectRef ? 'reuse' : 'pending_api', this.tables);
			return { ok: true, action: 'reuse', cloud, tables: this.tables };
		} catch {
			return { ok: false, error: 'write_failed' };
		}
	}

	async startPlanCheckout(folder: URI, planId: string): Promise<{ ok: true; checkoutUrl?: string } | { ok: false; error: string }> {
		if (!this.legalService.decideSend('kuunda_cloud').ok) {
			return { ok: false, error: 'strict_offline' };
		}
		const plan = sanitizePlanId(planId);
		const state = await this.readState(folder);
		if (!state.cloud.projectRef) {
			return { ok: false, error: 'not_provisioned' };
		}
		try {
			const accountId = this.cloudAccountId();
			const ref = encodeURIComponent(state.cloud.projectRef);
			const response = await this.requestSpecOrLegacy(
				'project.plan',
				`/v1/accounts/${encodeURIComponent(accountId)}/projects/${ref}/plan`,
				`/v1/provisioning/projects/${ref}/plan`,
				{ specMethod: 'PUT', legacyMethod: 'POST', json: { planId: plan, accountId, ownerId: accountId } },
			);
			if (!response.ok) {
				return { ok: false, error: `platform_http_${response.status}` };
			}
			const raw = await response.json() as { checkoutUrl?: unknown };
			const checkoutUrl = String(raw?.checkoutUrl || '').trim();
			await this.setPlan(folder, plan);
			return checkoutUrl ? { ok: true, checkoutUrl } : { ok: true };
		} catch (error) {
			return { ok: false, error: classifyNetworkError(error) };
		}
	}

	private safePlan(row: unknown): CloudPlan | undefined {
		if (!row || typeof row !== 'object') {
			return undefined;
		}
		const data = row as { id?: unknown; name?: unknown; price?: unknown; currency?: unknown };
		const id = sanitizePlanId(data.id);
		if (id !== String(data.id || '').trim().toLowerCase()) {
			return undefined;
		}
		const price = data.price && typeof data.price === 'object' ? data.price as { amount?: unknown; currency?: unknown } : undefined;
		const amount = typeof price?.amount === 'number' && Number.isFinite(price.amount) ? price.amount : undefined;
		const currency = typeof price?.currency === 'string' ? price.currency.slice(0, 8) : undefined;
		return {
			id,
			name: typeof data.name === 'string' && data.name.trim() ? data.name.trim().slice(0, 80) : undefined,
			price: amount === undefined ? undefined : { amount, currency },
		};
	}

	lastPublicStatus(): CloudPublicStatus {
		return { ...this.snapshot };
	}

	async formatContext(): Promise<string> {
		const rows = await this.projectService.listWorkspaceManifests();
		return rows.map((row) => formatCloudContext(parseCloudSettings(row.manifest))).filter(Boolean).join('\n');
	}

	async formatPanel(): Promise<string> {
		const target = await this.primaryFolder();
		if (!target) {
			return formatCloudPanel({ cloud: { enabled: true }, tables: [], routes: this.routeReport() });
		}
		const state = await this.readState(target.folder);
		let tables = this.tables;
		if (state.cloud.projectRef) {
			tables = this.safeTables(await this.fetchTables(state.cloud.projectRef)) ?? tables;
			this.tables = tables;
		}
		this.remember(state.cloud, this.actionFor(state.cloud), tables);
		// Read the report after the calls above, so the counter includes them.
		return formatCloudPanel({ cloud: state.cloud, tables, routes: this.routeReport() });
	}

	async needsStudioLink(): Promise<boolean> {
		// Cloud spaces are created for every project automatically, signed in or not,
		// so a Studio sign-up is never a prerequisite for Kuunda Cloud.
		return false;
	}

	async retryUnlinkedFolders(): Promise<CloudProvisionResult[]> {
		const run = this.retryChain.then(() => this.retryUnlinkedFoldersNow(), () => this.retryUnlinkedFoldersNow());
		this.retryChain = run.then(() => [], () => []);
		return run;
	}

	private async retryUnlinkedFoldersNow(): Promise<CloudProvisionResult[]> {
		if (this.configurationService.getValue<boolean>('kuunda.cloud.enabled') === false) {
			// Auto-provisioning opted out; explicit commands still work per project.
			return [];
		}
		const rows = await this.projectService.listWorkspaceManifests();
		const results: CloudProvisionResult[] = [];
		for (const row of rows) {
			const cloud = parseCloudSettings(row.manifest);
			if (cloud.enabled === false || cloud.projectRef) {
				continue;
			}
			results.push(await this.provisionFolder(row.folder, {
				enabled: true,
				type: row.manifest.type,
				name: row.manifest.name,
			}));
		}
		return results;
	}

	async setEnabled(folder: URI, enabled: boolean): Promise<CloudProvisionResult> {
		if (!enabled) {
			const state = await this.readState(folder);
			if (!state.manifest) {
				return { ok: false, error: 'write_failed' };
			}
			const cloud = publicCloudRecord({ ...state.cloud, enabled: false });
			try {
				await this.writeManifest(folder, state.manifest, cloud);
				this.remember(cloud, 'skip', this.tables);
				return { ok: true, action: 'skip', cloud, tables: this.tables };
			} catch {
				return { ok: false, error: 'write_failed' };
			}
		}
		return this.provisionFolder(folder, { enabled: true });
	}

	async replace(folder: URI): Promise<CloudProvisionResult> {
		return this.provisionFolder(folder, { enabled: true, replace: true });
	}

	async provisionFolder(folder: URI, input: CloudProvisionInput = {}): Promise<CloudProvisionResult> {
		const key = folder.toString();
		const previous = this.inflight.get(key);
		if (previous && !input.replace) {
			return previous;
		}
		const task = (async () => {
			if (previous) {
				await previous.catch(() => undefined);
			}
			return this.provisionFolderNow(folder, input);
		})().finally(() => {
			if (this.inflight.get(key) === task) {
				this.inflight.delete(key);
			}
		});
		this.inflight.set(key, task);
		return task;
	}

	private async provisionFolderNow(folder: URI, input: CloudProvisionInput = {}): Promise<CloudProvisionResult> {
		if (!this.legalService.decideSend('kuunda_cloud').ok) {
			return { ok: false, error: 'strict_offline' };
		}
		try {
			const state = await this.readState(folder);
			const enabled = input.enabled ?? state.cloud.enabled ?? true;
			const ownerId = this.cloudOwnerId();
			const planId = sanitizePlanId(state.cloud.plan || this.configurationService.getValue<string>('kuunda.cloud.defaultPlan') || DEFAULT_CLOUD_PLAN);
			const alreadyProvisioned = Boolean(state.cloud.projectRef) && !input.replace;
			const name = input.name || state.manifest?.name || folder.path.replace(/\\/g, '/').split('/').filter(Boolean).pop() || 'project';
			const type = input.type || state.manifest?.type || 'other';
			const repo = await this.readGitRemote(folder);
			let decision = decideCloudProvisioning({
				enabled,
				ownerId,
				alreadyProvisioned,
			});
			let api: ProvisionApiResult | undefined;
			let tables: CloudTable[] = alreadyProvisioned && state.cloud.projectRef
				? (this.safeTables(await this.fetchTables(state.cloud.projectRef)) ?? [{ name: 'items', rowCount: 0 }])
				: [];
			let network: 'timeout' | 'offline' | undefined;
			if (decision.action === 'provision') {
				try {
					api = await this.callProvision({
						ownerId,
						displayName: name,
						projectType: type,
						planId,
						repoUrl: repo,
						replace: input.replace,
					});
					const ref = sanitizeProjectRef(api.kuundaProjectRef || api.projectId);
					if (!ref) {
						api = undefined;
						decision = { ok: true, action: 'pending_api', enabled: true };
					} else {
						api = { ...api, kuundaProjectRef: ref, projectId: ref };
						tables = this.safeTables(api.tables);
					}
				} catch (error) {
					const code = classifyNetworkError(error);
					const msg = String((error as { message?: unknown })?.message || error || '');
					if (/platform_http_401|platform_http_403/.test(msg)) {
						decision = { ok: true, action: 'pending_user', enabled: true };
					} else {
						if (code === 'timeout') {
							network = 'timeout';
						} else if (code === 'offline') {
							network = 'offline';
						}
						decision = { ok: true, action: 'pending_api', enabled: true };
					}
				}
			}
			const resolved = resolveCloudRecordAfterDecision({
				decision,
				api,
				previous: state.cloud,
			});
			// Remember where the source lives so another machine can re-clone it.
			const cloud = resolved.repo || !repo ? resolved : publicCloudRecord({ ...resolved, repo });
			const existingGitignore = await this.readText(folder, '.gitignore');
			const scaffold = scaffoldCloudFiles({
				type,
				enabled: cloud.enabled,
				projectRef: cloud.projectRef,
				env: cloud.env,
				url: cloud.url,
				plan: cloud.plan,
				repo: cloud.repo,
				anonKey: persistableAnonKey(api?.anonKey),
				existingGitignore,
			});
			const overwriteSecrets = decision.action === 'provision';
			await this.writeScaffold(folder, scaffold.files, overwriteSecrets);
			if (state.manifest) {
				await this.writeManifest(folder, state.manifest, cloud);
			}
			this.tables = tables;
			this.remember(cloud, decision.action, tables);
			return { ok: true, action: decision.action, cloud, tables, network };
		} catch {
			return { ok: false, error: 'write_failed' };
		}
	}

	private remember(cloud: CloudRecord, action: string, tables: CloudTable[]): void {
		this.tables = tables;
		this.snapshot = redactCloudPayload({
			available: true,
			enabled: cloud.enabled !== false,
			projectRef: cloud.projectRef,
			env: cloud.env,
			plan: sanitizePlanId(cloud.plan),
			action,
		}) as CloudPublicStatus;
		this._onDidChange.fire();
	}

	private async refreshSnapshot(): Promise<void> {
		const target = await this.primaryFolder();
		if (!target) {
			return;
		}
		const state = await this.readState(target.folder);
		this.remember(state.cloud, this.actionFor(state.cloud), this.tables);
	}

	private actionFor(cloud: CloudRecord): string {
		if (cloud.projectRef) {
			return 'reuse';
		}
		return 'pending_api';
	}

	/** Signed-in Studio user, sent only as an attribution hint — never required. */
	private sessionHint(): { userId?: string } {
		const userId = this.accountService.getSession()?.userId?.trim();
		return userId ? { userId } : {};
	}

	/**
	 * Owner of every Cloud resource of this install: the main account, so all
	 * projects stay centralised under it whether the user is signed in or not.
	 */
	private cloudOwnerId(): string {
		return this.cloudAccountId();
	}

	/**
	 * The main account id: `kva_<uuid>`, generated once and persisted locally.
	 * No Kuunda Cloud signup and no web account are ever required.
	 */
	private cloudAccountId(): string {
		const stored = sanitizeOwnerId(this.storageService.get(CLOUD_ACCOUNT_STORAGE_KEY, StorageScope.APPLICATION));
		if (stored) {
			return stored;
		}
		const generated = `${CLOUD_ACCOUNT_PREFIX}${generateUuid()}`;
		this.storageService.store(CLOUD_ACCOUNT_STORAGE_KEY, generated, StorageScope.APPLICATION, StorageTarget.USER);
		return generated;
	}

	private async primaryFolder(): Promise<{ folder: URI; manifest: ProjectManifest } | undefined> {
		const rows = await this.projectService.listWorkspaceManifests();
		return rows[0];
	}

	private async readState(folder: URI): Promise<{ manifest?: ProjectManifest; cloud: CloudRecord }> {
		const manifest = await this.projectService.readManifest(folder);
		let raw: string | undefined;
		try {
			raw = await this.readText(folder, PROJECT_MANIFEST_PATH);
		} catch {
			raw = undefined;
		}
		const cloud = parseCloudSettings(raw ?? manifest);
		return { manifest, cloud };
	}

	private async writeManifest(folder: URI, manifest: ProjectManifest, cloud: CloudRecord): Promise<void> {
		await this.writeFile(folder, PROJECT_MANIFEST_PATH, serializeManifestWithCloud(manifest, cloud), true);
	}

	private async writeScaffold(folder: URI, files: CloudFile[], overwriteSecrets: boolean): Promise<void> {
		for (const file of files) {
			const isSecret = file.path === CLOUD_ENV_PATH || file.path === CLOUD_LOCAL_PATH;
			const exists = await this.fileService.exists(this.uriFromRelative(folder, file.path));
			if (exists && file.path === CLOUD_CLIENT_PATH) {
				continue;
			}
			if (exists && isSecret && !overwriteSecrets) {
				continue;
			}
			if (file.path === '.gitignore' && exists) {
				const current = await this.readText(folder, '.gitignore');
				const merged = mergeGitignore(current);
				await this.writeFile(folder, '.gitignore', merged.content, true);
				continue;
			}
			await this.writeFile(folder, file.path, file.content, true);
		}
	}

	private async callProvision(body: { ownerId: string; displayName: string; projectType: string; planId: string; repoUrl?: string; replace?: boolean }): Promise<ProvisionApiResult> {
		const accountId = sanitizeOwnerId(body.ownerId) || this.cloudAccountId();
		const response = await this.requestSpecOrLegacy(
			'projects.create',
			`/v1/accounts/${encodeURIComponent(accountId)}/projects`,
			'/v1/provisioning/projects',
			{
				specMethod: 'POST',
				legacyMethod: 'POST',
				json: {
					...body,
					accountId,
					planId: sanitizePlanId(body.planId),
					repoUrl: body.repoUrl,
					env: 'sandbox',
					...this.sessionHint(),
				},
			},
		);
		if (!response.ok) {
			throw new Error(`platform_http_${response.status}`);
		}
		return await response.json() as ProvisionApiResult;
	}

	private async fetchTables(projectRef: string): Promise<CloudTable[] | undefined> {
		if (!this.legalService.decideSend('kuunda_cloud').ok) {
			return undefined;
		}
		try {
			const accountId = encodeURIComponent(this.cloudAccountId());
			const ref = encodeURIComponent(projectRef);
			// No tables route in the spec yet: accounts-scoped path proposed, legacy fallback.
			const response = await this.requestSpecOrLegacy(
				'project.tables',
				`/v1/accounts/${accountId}/projects/${ref}/tables`,
				`/v1/provisioning/projects/${ref}/tables`,
			);
			if (!response.ok) {
				return undefined;
			}
			const data = await response.json() as { tables?: CloudTable[] };
			return Array.isArray(data.tables) ? this.safeTables(data.tables) : undefined;
		} catch {
			return undefined;
		}
	}

	private safeTables(tables: CloudTable[] | undefined): CloudTable[] {
		if (!Array.isArray(tables)) {
			return [{ name: 'items', rowCount: 0 }];
		}
		const rows = tables
			.map((table) => ({
				name: String(table?.name || ''),
				rowCount: typeof table?.rowCount === 'number' && Number.isFinite(table.rowCount) ? Math.max(0, Math.floor(table.rowCount)) : 0,
			}))
			.filter((table) => /^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(table.name))
			.slice(0, 50);
		return rows.length ? rows : [{ name: 'items', rowCount: 0 }];
	}

	/**
	 * Transition shim. The spec routes (`/v1/accounts/{accountId}/…`) are tried first,
	 * then the legacy routes (`/v1/provisioning/*`, `/v1/account/*`) while the platform
	 * finishes migrating. The result of a probe is cached, so steady state costs one
	 * request. Remove the legacy branch once `routeReport().legacyRemovable` is true.
	 *
	 * Only 404/501 mean "route not implemented": a 404 from a family we already used
	 * successfully is about the resource, and must not trigger a second write.
	 *
	 * With `kuunda.cloud.legacyRoutes: off` the legacy routes are never called: a spec
	 * route that is missing is reported to the caller instead of being papered over.
	 */
	private async requestSpecOrLegacy(
		family: string,
		specPath: string,
		legacyPath: string,
		init: { specMethod?: string; legacyMethod?: string; json?: unknown } = {},
	): Promise<Response> {
		const hasJson = init.json !== undefined;
		const headers = await this.platformHeaders(hasJson);
		const body = hasJson ? JSON.stringify(init.json) : undefined;
		const attempt = (path: string, method: string) => fetchWithTimeout(`${DEFAULT_API_BASE_URL}${path}`, { method, headers, body });
		const unimplemented = (response: Response) => response.status === 404 || response.status === 501;

		if (this.routeMode() === 'off') {
			this.routePreference.delete(family);
			const spec = await attempt(specPath, init.specMethod ?? 'GET');
			if (!unimplemented(spec)) {
				this.specFamilies.add(family);
				this.recordRoute(family, 'spec');
			} else if (this.specFamilies.has(family)) {
				// Known route, missing resource: still served by the spec.
				this.recordRoute(family, 'spec');
			}
			return spec;
		}

		const cached = this.routePreference.get(family);
		const fresh = cached && Date.now() - cached.at < ROUTE_PROBE_TTL ? cached.route : undefined;

		if (fresh !== 'legacy') {
			const spec = await attempt(specPath, init.specMethod ?? 'GET');
			if (!unimplemented(spec)) {
				this.routePreference.set(family, { route: 'spec', at: Date.now() });
				this.specFamilies.add(family);
				this.recordRoute(family, 'spec');
				return spec;
			}
			if (fresh === 'spec' || this.specFamilies.has(family)) {
				// We know this route works: the 404 is a missing resource, not a missing route.
				this.recordRoute(family, 'spec');
				return spec;
			}
			this.routePreference.set(family, { route: 'legacy', at: Date.now() });
		}

		const legacy = await attempt(legacyPath, init.legacyMethod ?? 'GET');
		if (unimplemented(legacy)) {
			// Neither route exists: probe again next time instead of caching a dead end.
			this.routePreference.delete(family);
		} else {
			this.recordRoute(family, 'legacy');
		}
		return legacy;
	}

	private async platformHeaders(json: boolean): Promise<Record<string, string>> {
		const headers: Record<string, string> = { Accept: 'application/json' };
		if (json) {
			headers['Content-Type'] = 'application/json';
		}
		const token = await this.accountService.getAccessToken();
		if (token) {
			headers.Authorization = `Bearer ${token}`;
		}
		return headers;
	}

	private async readText(folder: URI, rel: string): Promise<string> {
		const uri = this.uriFromRelative(folder, rel);
		if (!(await this.fileService.exists(uri))) {
			return '';
		}
		return (await this.fileService.readFile(uri)).value.toString();
	}

	private async writeFile(folder: URI, rel: string, content: string, overwrite: boolean): Promise<void> {
		const uri = this.uriFromRelative(folder, rel);
		const dir = dirname(uri);
		if (!(await this.fileService.exists(dir))) {
			await this.fileService.createFolder(dir);
		}
		await this.fileService.writeFile(uri, VSBuffer.fromString(content));
		void overwrite;
	}

	private uriFromRelative(root: URI, rel: string): URI {
		return joinPath(root, ...rel.split('/').filter(Boolean));
	}
}

registerSingleton(IKuundaCloudService, KuundaCloudService, InstantiationType.Delayed);
