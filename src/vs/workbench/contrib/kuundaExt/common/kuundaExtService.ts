/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IExtensionManagementService } from '../../../../platform/extensionManagement/common/extensionManagement.js';
import { ExtensionIdentifier, IExtensionDescription } from '../../../../platform/extensions/common/extensions.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { IWorkbenchExtensionEnablementService } from '../../../services/extensionManagement/common/extensionManagement.js';
import { IKuundaAgentService } from '../../kuundaAi/common/kuundaAgentService.js';
import { MAX_AGENT_STEPS } from '../../kuundaAi/common/agentLoop.js';
import { DEFAULT_TOOL_PERMISSIONS } from '../../kuundaAi/common/permissionPolicy.js';
import { IKuundaBillingService } from '../../kuundaBilling/common/kuundaBillingService.js';
import {
	KUUNDA_API_PERMISSIONS,
	KuundaApiPermission,
	canGrantPermission,
	decideKuundaApiAccess,
	describeKuundaApi,
	marketplaceSourceFromInstall,
	parseKuundaContribution,
	redactApiPayload,
	type MarketplaceSource,
} from './extensionApi.js';

const GRANTS_KEY = 'kuunda.ext.apiGrants';

export type KuundaApiInvokeInput = {
	extensionId?: string;
	method?: string;
	apiVersion?: string;
};

export type KuundaApiInvokeResult = { ok: true; method: string; data: unknown } | { ok: false; error: string };

export interface IKuundaExtService {
	readonly _serviceBrand: undefined;
	describeApi(): ReturnType<typeof describeKuundaApi>;
	listDeclarativeExtensions(): IExtensionDescription[];
	declaredPermissions(extensionId: string): KuundaApiPermission[];
	listGrants(): { [extensionId: string]: string[] };
	sourceOf(extensionId: string): Promise<MarketplaceSource>;
	grant(extensionId: string, permission: KuundaApiPermission): boolean;
	revoke(extensionId: string): void;
	invoke(input: KuundaApiInvokeInput): Promise<KuundaApiInvokeResult>;
}

export const IKuundaExtService = createDecorator<IKuundaExtService>('kuundaExtService');

export class KuundaExtService extends Disposable implements IKuundaExtService {
	declare readonly _serviceBrand: undefined;

	constructor(
		@IStorageService private readonly storageService: IStorageService,
		@IExtensionService private readonly extensionService: IExtensionService,
		@IExtensionManagementService private readonly extensionManagementService: IExtensionManagementService,
		@IWorkbenchExtensionEnablementService private readonly extensionEnablementService: IWorkbenchExtensionEnablementService,
		@IKuundaAgentService private readonly agentService: IKuundaAgentService,
		@IKuundaBillingService private readonly billingService: IKuundaBillingService,
	) {
		super();
	}

	describeApi(): ReturnType<typeof describeKuundaApi> {
		return describeKuundaApi();
	}

	listDeclarativeExtensions(): IExtensionDescription[] {
		return this.extensionService.extensions.filter((extension) => {
			if (extension.isBuiltin) {
				return false;
			}
			const declared = parseKuundaContribution(this.manifestOf(extension));
			return declared.permissions.length > 0 || Boolean((extension.contributes as { kuunda?: unknown } | undefined)?.kuunda);
		});
	}

	declaredPermissions(extensionId: string): KuundaApiPermission[] {
		const extension = this.findExtension(extensionId);
		if (!extension) {
			return [];
		}
		return parseKuundaContribution(this.manifestOf(extension)).permissions;
	}

	listGrants(): { [extensionId: string]: string[] } {
		try {
			const raw = this.storageService.get(GRANTS_KEY, StorageScope.APPLICATION);
			const parsed = raw ? JSON.parse(raw) as { [extensionId: string]: string[] } : {};
			return parsed && typeof parsed === 'object' ? parsed : {};
		} catch {
			return {};
		}
	}

	async sourceOf(extensionId: string): Promise<MarketplaceSource> {
		const extension = this.findExtension(extensionId);
		if (!extension) {
			return 'sideload';
		}
		if (extension.isBuiltin || extension.isUserBuiltin) {
			return 'builtin';
		}
		if (extension.isUnderDevelopment) {
			return 'sideload';
		}
		try {
			const installed = await this.extensionManagementService.getInstalled();
			const local = installed.find((item) => ExtensionIdentifier.equals(item.identifier.id, extension.identifier));
			return marketplaceSourceFromInstall({
				installSource: local?.source,
				isBuiltin: extension.isBuiltin,
				isUnderDevelopment: extension.isUnderDevelopment,
			});
		} catch {
			return 'openvsx';
		}
	}

	grant(extensionId: string, permission: KuundaApiPermission): boolean {
		if (!canGrantPermission(this.declaredPermissions(extensionId), permission)) {
			return false;
		}
		const grants = this.listGrants();
		const current = new Set(grants[extensionId] || []);
		current.add(permission);
		grants[extensionId] = [...current];
		this.storageService.store(GRANTS_KEY, JSON.stringify(grants), StorageScope.APPLICATION, StorageTarget.USER);
		return true;
	}

	revoke(extensionId: string): void {
		const grants = this.listGrants();
		delete grants[extensionId];
		this.storageService.store(GRANTS_KEY, JSON.stringify(grants), StorageScope.APPLICATION, StorageTarget.USER);
	}

	async invoke(input: KuundaApiInvokeInput): Promise<KuundaApiInvokeResult> {
		const extensionId = String(input.extensionId || '').trim();
		const extension = this.findExtension(extensionId);
		if (!extension) {
			return { ok: false, error: 'missing_extension' };
		}
		if (await this.isDisabled(extension)) {
			return { ok: false, error: 'disabled' };
		}
		const declared = parseKuundaContribution(this.manifestOf(extension));
		const decision = decideKuundaApiAccess({
			method: input.method,
			extensionId,
			declaredPermissions: declared.permissions,
			grantedPermissions: this.listGrants()[extensionId] || [],
			source: await this.sourceOf(extensionId),
			apiVersion: input.apiVersion || declared.apiVersion,
		});
		if (!decision.ok) {
			return { ok: false, error: decision.error };
		}
		const data = redactApiPayload(this.payloadFor(decision.method));
		return { ok: true, method: decision.method, data };
	}

	private payloadFor(method: string): unknown {
		if (method === 'api.version') {
			return this.describeApi();
		}
		if (method === 'agent.capabilities') {
			return {
				maxSteps: MAX_AGENT_STEPS,
				providers: [...this.agentService.supportedProviders],
			};
		}
		if (method === 'agent.getPolicy') {
			const overrides = this.agentService.getPolicyOverrides();
			const tools: { [name: string]: string } = {};
			for (const name of this.agentService.listPermissionTools()) {
				tools[name] = overrides[name] ?? DEFAULT_TOOL_PERMISSIONS[name] ?? 'confirm';
			}
			return { tools };
		}
		if (method === 'credits.balance') {
			return { remaining: this.billingService.lastBalance()?.remaining ?? null };
		}
		if (method === 'cloud.status') {
			return { available: false, phase: 6 };
		}
		return {};
	}

	private findExtension(extensionId: string): IExtensionDescription | undefined {
		return this.extensionService.extensions.find((item) => ExtensionIdentifier.equals(item.identifier, extensionId));
	}

	private async isDisabled(extension: IExtensionDescription): Promise<boolean> {
		try {
			const installed = await this.extensionManagementService.getInstalled();
			const local = installed.find((item) => ExtensionIdentifier.equals(item.identifier.id, extension.identifier));
			if (!local) {
				return false;
			}
			return !this.extensionEnablementService.isEnabled(local);
		} catch {
			return false;
		}
	}

	private manifestOf(extension: IExtensionDescription): { contributes?: { kuunda?: { apiVersion?: string; permissions?: string[] } } } {
		return { contributes: extension.contributes as { kuunda?: { apiVersion?: string; permissions?: string[] } } | undefined };
	}
}

registerSingleton(IKuundaExtService, KuundaExtService, InstantiationType.Delayed);

export { KUUNDA_API_PERMISSIONS };
