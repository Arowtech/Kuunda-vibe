/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { IWorkbenchContribution, IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from '../../../common/contributions.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import {
	Extensions as ViewContainerExtensions,
	IViewContainersRegistry,
	IViewsRegistry,
	Extensions as ViewExtensions,
	ViewContainerLocation,
	IViewDescriptorService,
} from '../../../common/views.js';
import { ViewPaneContainer } from '../../../browser/parts/views/viewPaneContainer.js';
import { IViewPaneOptions, ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Orientation } from '../../../../base/browser/ui/sash/sash.js';
import { $, append } from '../../../../base/browser/dom.js';
import { URI } from '../../../../base/common/uri.js';
import { IKuundaProjectService } from '../../kuundaProject/common/kuundaProjectService.js';
import { kuundaCloudLocalize, kuundaCloudLocalize2, KUUNDA_CLOUD_STRINGS, type KuundaCloudStringKey } from '../common/kuundaCloudNls.js';
import { IKuundaCloudService, type CloudPlan, type CloudProvisionResult } from '../common/kuundaCloudService.js';
import { formatRouteReport } from '../common/cloudProvision.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IStatusbarService, StatusbarAlignment } from '../../../services/statusbar/browser/statusbar.js';
import { IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js';
import { Extensions as ConfigurationExtensions, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';

export const KUUNDA_CLOUD_VIEW_CONTAINER_ID = 'workbench.view.kuundaCloud';
export const KUUNDA_CLOUD_VIEW_ID = 'kuunda.cloud.panel';

class KuundaCloudViewPane extends ViewPane {
	private panelBody: HTMLElement | undefined;

	constructor(
		options: IViewPaneOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
		@IKuundaCloudService private readonly cloudService: IKuundaCloudService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
		this._register(this.cloudService.onDidChange(() => {
			void this.refresh();
		}));
	}

	protected override renderBody(parent: HTMLElement): void {
		super.renderBody(parent);
		parent.style.userSelect = 'text';
		parent.style.overflow = 'auto';
		this.panelBody = append(parent, $('pre.kuunda-cloud-panel'));
		this.panelBody.style.whiteSpace = 'pre-wrap';
		this.panelBody.style.padding = '8px';
		void this.refresh();
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this.element.style.height = `${height}px`;
		this.element.style.width = `${width}px`;
	}

	private async refresh(): Promise<void> {
		if (!this.panelBody) {
			return;
		}
		this.panelBody.textContent = await this.cloudService.formatPanel();
	}
}

const viewContainerRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
const container = viewContainerRegistry.registerViewContainer({
	id: KUUNDA_CLOUD_VIEW_CONTAINER_ID,
	title: kuundaCloudLocalize2('kuunda.cloud.panel'),
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [KUUNDA_CLOUD_VIEW_CONTAINER_ID, {
		mergeViewWithContainerWhenSingleView: true,
		orientation: Orientation.VERTICAL,
	}]),
	hideIfEmpty: false,
	order: 10,
	icon: Codicon.database,
}, ViewContainerLocation.Sidebar, { doNotRegisterOpenCommand: false, isDefault: false });

Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry).registerViews([{
	id: KUUNDA_CLOUD_VIEW_ID,
	name: kuundaCloudLocalize2('kuunda.cloud.panel'),
	ctorDescriptor: new SyncDescriptor(KuundaCloudViewPane),
	canToggleVisibility: true,
	canMoveView: true,
	weight: 40,
	order: 1,
}], container);

class KuundaCloudContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.kuundaCloud';

	constructor(
		@IKuundaCloudService cloud: IKuundaCloudService,
		@INotificationService notify: INotificationService,
		@IWorkspaceContextService workspace: IWorkspaceContextService,
		@IStatusbarService statusbar: IStatusbarService,
	) {
		super();
		kuundaCloudLocalize('kuunda.cloud.tagline');
		void cloud.formatPanel();
		const entry = statusbar.addEntry({
			name: kuundaCloudLocalize('kuunda.cloud.plan.statusbar', 'standard'),
			text: kuundaCloudLocalize('kuunda.cloud.plan.statusbar', 'standard'),
			ariaLabel: kuundaCloudLocalize('kuunda.cloud.plan.statusbar', 'standard'),
			command: 'kuunda.cloud.plan',
		}, 'kuunda.cloud.plan', StatusbarAlignment.RIGHT, 49);
		this._register(entry);
		this._register(cloud.onDidChange(() => {
			const plan = cloud.lastPublicStatus().plan || 'standard';
			const text = kuundaCloudLocalize('kuunda.cloud.plan.statusbar', plan);
			entry.update({ name: text, text, ariaLabel: text, command: 'kuunda.cloud.plan' });
		}));
		void this.boot(cloud, notify);
		this._register(workspace.onDidChangeWorkspaceFolders(() => {
			void this.boot(cloud, notify);
		}));
		// Keep the account inventory in sync while the IDE is open.
		const timer = setInterval(() => void this.boot(cloud, notify, true), 60_000);
		this._register({ dispose: () => clearInterval(timer) });
	}

	/**
	 * One main account owns every project of this install, and the inventory is
	 * reconciled automatically — signed in or not. No Kuunda Cloud account needed.
	 */
	private async boot(
		cloud: IKuundaCloudService,
		notify: INotificationService,
		quiet = false,
	): Promise<void> {
		const result = await cloud.syncProjects();
		if (!quiet && result.ok && result.linked > 0) {
			notify.info(kuundaCloudLocalize('kuunda.cloud.sync.linked', result.linked));
		}
	}
}

async function runOnPrimaryFolder(
	accessor: ServicesAccessor,
	fn: (cloud: IKuundaCloudService, folder: import('../../../../base/common/uri.js').URI) => Promise<CloudProvisionResult>,
	successKey: KuundaCloudStringKey,
): Promise<void> {
	const cloud = accessor.get(IKuundaCloudService);
	const project = accessor.get(IKuundaProjectService);
	const notify = accessor.get(INotificationService);
	const quick = accessor.get(IQuickInputService);
	const folder = await pickWorkspaceFolder(project, quick, notify);
	if (!folder) {
		return;
	}
	const result = await fn(cloud, folder);
	notifyCloudResult(notify, result, successKey);
}

async function pickWorkspaceFolder(
	project: IKuundaProjectService,
	quick: IQuickInputService,
	notify: INotificationService,
): Promise<import('../../../../base/common/uri.js').URI | undefined> {
	const rows = await project.listWorkspaceManifests();
	if (!rows.length) {
		notify.info(kuundaCloudLocalize('kuunda.cloud.none'));
		return undefined;
	}
	if (rows.length === 1) {
		return rows[0].folder;
	}
	const picked = await quick.pick(
		rows.map((row) => ({
			id: row.folder.toString(),
			label: row.folderName,
			description: row.manifest.name,
		})),
		{
			placeHolder: kuundaCloudLocalize('kuunda.cloud.pickFolder'),
			ignoreFocusLost: true,
			canPickMany: false,
		},
	);
	if (!picked?.id) {
		return undefined;
	}
	return rows.find((row) => row.folder.toString() === picked.id)?.folder;
}

function notifyCloudResult(notify: INotificationService, result: CloudProvisionResult, successKey: KuundaCloudStringKey): void {
	if (!result.ok) {
		const key = `kuunda.cloud.error.${result.error}` as KuundaCloudStringKey;
		if (key in KUUNDA_CLOUD_STRINGS) {
			notify.error(kuundaCloudLocalize(key));
			return;
		}
		notify.error(kuundaCloudLocalize('kuunda.cloud.provision.error', result.error));
		return;
	}
	if (result.action === 'pending_user') {
		// Anonymous owner identity could not be resolved — never a signup prompt.
		notify.info(kuundaCloudLocalize('kuunda.cloud.provision.pendingUser'));
		return;
	}
	if (result.action === 'pending_api') {
		if (result.network === 'timeout') {
			notify.info(kuundaCloudLocalize('kuunda.cloud.network.timeout'));
			return;
		}
		if (result.network === 'offline') {
			notify.info(kuundaCloudLocalize('kuunda.cloud.network.offline'));
			return;
		}
		notify.info(kuundaCloudLocalize('kuunda.cloud.provision.pendingApi'));
		return;
	}
	if (result.action === 'skip') {
		notify.info(kuundaCloudLocalize(successKey === 'kuunda.cloud.disable.ok' ? 'kuunda.cloud.disable.ok' : 'kuunda.cloud.provision.skipped'));
		return;
	}
	if (result.action === 'reuse') {
		notify.info(kuundaCloudLocalize('kuunda.cloud.provision.reused', result.cloud.projectRef || 'proj'));
		return;
	}
	notify.info(kuundaCloudLocalize(successKey, result.cloud.projectRef || 'proj'));
}

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.cloud.showPanel',
			f1: true,
			title: kuundaCloudLocalize2('kuunda.cloud.showPanel'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		await accessor.get(IViewsService).openView(KUUNDA_CLOUD_VIEW_ID, true);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.cloud.provision',
			f1: true,
			title: kuundaCloudLocalize2('kuunda.cloud.provision'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		await runOnPrimaryFolder(accessor, (cloud, folder) => cloud.provisionFolder(folder, { enabled: true }), 'kuunda.cloud.provision.ok');
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.cloud.enable',
			f1: true,
			title: kuundaCloudLocalize2('kuunda.cloud.enable'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		await runOnPrimaryFolder(accessor, (cloud, folder) => cloud.setEnabled(folder, true), 'kuunda.cloud.enable.ok');
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.cloud.disable',
			f1: true,
			title: kuundaCloudLocalize2('kuunda.cloud.disable'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		await runOnPrimaryFolder(accessor, (cloud, folder) => cloud.setEnabled(folder, false), 'kuunda.cloud.disable.ok');
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.cloud.replace',
			f1: true,
			title: kuundaCloudLocalize2('kuunda.cloud.replace'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const dialog = accessor.get(IDialogService);
		const confirmed = await dialog.confirm({
			message: kuundaCloudLocalize('kuunda.cloud.replace.confirm'),
			primaryButton: kuundaCloudLocalize('kuunda.cloud.replace.confirm.ok'),
		});
		if (!confirmed.confirmed) {
			return;
		}
		await runOnPrimaryFolder(accessor, (cloud, folder) => cloud.replace(folder), 'kuunda.cloud.replace.ok');
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.cloud.sync',
			f1: true,
			title: kuundaCloudLocalize2('kuunda.cloud.sync'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const cloud = accessor.get(IKuundaCloudService);
		const notify = accessor.get(INotificationService);
		const result = await cloud.syncProjects();
		if (result.ok) {
			notify.info(kuundaCloudLocalize('kuunda.cloud.sync.ok', result.linked, result.remoteOnly));
			return;
		}
		notify.info(kuundaCloudLocalize('kuunda.cloud.sync.failed'));
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.cloud.projects',
			f1: true,
			title: kuundaCloudLocalize2('kuunda.cloud.projects'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const cloud = accessor.get(IKuundaCloudService);
		const notify = accessor.get(INotificationService);
		const quick = accessor.get(IQuickInputService);
		const dialog = accessor.get(IDialogService);
		const rows = await cloud.accountProjects();
		if (!rows.length) {
			notify.info(kuundaCloudLocalize('kuunda.cloud.projects.empty'));
			return;
		}
		const picked = await quick.pick(
			rows.map((row) => ({
				id: row.projectRef,
				label: row.name || row.projectRef,
				description: row.status === 'archived'
					? kuundaCloudLocalize('kuunda.cloud.projects.archived')
					: `${row.plan} — ${row.projectRef}`,
			})),
			{
				placeHolder: kuundaCloudLocalize('kuunda.cloud.projects.pick'),
				ignoreFocusLost: true,
				canPickMany: false,
			},
		);
		if (!picked?.id) {
			return;
		}
		const row = rows.find((candidate) => candidate.projectRef === picked.id);
		if (row?.status !== 'archived') {
			// Known in the cloud but not on this machine: the code lives in git.
			if (row?.repo) {
				await accessor.get(IClipboardService).writeText(row.repo);
				notify.info(kuundaCloudLocalize('kuunda.cloud.projects.repo', row.repo));
				return;
			}
			notify.info(kuundaCloudLocalize('kuunda.cloud.projects.active', picked.id));
			return;
		}
		const confirmed = await dialog.confirm({
			message: kuundaCloudLocalize('kuunda.cloud.projects.restore.confirm', picked.id),
			primaryButton: kuundaCloudLocalize('kuunda.cloud.projects.restore.ok'),
		});
		if (!confirmed.confirmed) {
			return;
		}
		const result = await cloud.restoreProject(picked.id);
		if (result.ok) {
			notify.info(kuundaCloudLocalize('kuunda.cloud.projects.restored', picked.id));
			return;
		}
		notifyCloudResult(notify, { ok: false, error: result.error }, 'kuunda.cloud.plan.ok');
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.cloud.archive',
			f1: true,
			title: kuundaCloudLocalize2('kuunda.cloud.archive'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const cloud = accessor.get(IKuundaCloudService);
		const project = accessor.get(IKuundaProjectService);
		const notify = accessor.get(INotificationService);
		const quick = accessor.get(IQuickInputService);
		const dialog = accessor.get(IDialogService);
		const folder = await pickWorkspaceFolder(project, quick, notify);
		if (!folder) {
			return;
		}
		const confirmed = await dialog.confirm({
			message: kuundaCloudLocalize('kuunda.cloud.archive.confirm'),
			primaryButton: kuundaCloudLocalize('kuunda.cloud.archive.confirm.ok'),
		});
		if (!confirmed.confirmed) {
			return;
		}
		const result = await cloud.archiveFolder(folder);
		if (result.ok) {
			notify.info(kuundaCloudLocalize('kuunda.cloud.archive.ok'));
			return;
		}
		notifyCloudResult(notify, result, 'kuunda.cloud.archive.ok');
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.cloud.link',
			f1: true,
			title: kuundaCloudLocalize2('kuunda.cloud.link'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const cloud = accessor.get(IKuundaCloudService);
		const notify = accessor.get(INotificationService);
		const result = await cloud.linkAccount();
		if (result.ok) {
			await accessor.get(IClipboardService).writeText(result.code);
			notify.info(kuundaCloudLocalize('kuunda.cloud.link.ok', result.code));
			return;
		}
		notifyCloudResult(notify, { ok: false, error: result.error }, 'kuunda.cloud.link.ok');
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.cloud.adopt',
			f1: true,
			title: kuundaCloudLocalize2('kuunda.cloud.adopt'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const cloud = accessor.get(IKuundaCloudService);
		const notify = accessor.get(INotificationService);
		const quick = accessor.get(IQuickInputService);
		const code = await quick.input({
			prompt: kuundaCloudLocalize('kuunda.cloud.adopt.prompt'),
			ignoreFocusLost: true,
		});
		if (!code?.trim()) {
			return;
		}
		const result = await cloud.adoptAccount(code.trim());
		if (result.ok) {
			notify.info(kuundaCloudLocalize('kuunda.cloud.adopt.ok'));
			return;
		}
		notifyCloudResult(notify, { ok: false, error: result.error }, 'kuunda.cloud.adopt.ok');
	}
});

function formatPlanLabel(plan: CloudPlan, current: string): string {
	const name = plan.name || plan.id;
	if (plan.id === current) {
		return `${name} — ${kuundaCloudLocalize('kuunda.cloud.plan.current')}`;
	}
	const amount = plan.price?.amount;
	if (typeof amount === 'number' && amount > 0) {
		return `${name} — ${amount}${plan.price?.currency ? ` ${plan.price.currency}` : ''}`;
	}
	return `${name} — ${kuundaCloudLocalize('kuunda.cloud.plan.free')}`;
}

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.cloud.plan',
			f1: true,
			title: kuundaCloudLocalize2('kuunda.cloud.plan'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const cloud = accessor.get(IKuundaCloudService);
		const project = accessor.get(IKuundaProjectService);
		const notify = accessor.get(INotificationService);
		const quick = accessor.get(IQuickInputService);
		const opener = accessor.get(IOpenerService);
		const folder = await pickWorkspaceFolder(project, quick, notify);
		if (!folder) {
			return;
		}
		const current = await cloud.currentPlan(folder);
		const plans = await cloud.listPlans();
		const catalog: CloudPlan[] = plans.length ? plans : [{ id: current, name: current }];
		const picked = await quick.pick(
			catalog.map((plan) => ({ id: plan.id, label: formatPlanLabel(plan, current), description: plan.id })),
			{
				placeHolder: kuundaCloudLocalize('kuunda.cloud.plan.pick'),
				ignoreFocusLost: true,
				canPickMany: false,
			},
		);
		if (!picked?.id || picked.id === current) {
			return;
		}
		const choice = catalog.find((plan) => plan.id === picked.id);
		if ((choice?.price?.amount ?? 0) > 0) {
			const result = await cloud.startPlanCheckout(folder, picked.id);
			if (!result.ok) {
				notifyCloudResult(notify, { ok: false, error: result.error }, 'kuunda.cloud.plan.ok');
				return;
			}
			if (result.checkoutUrl) {
				await opener.open(URI.parse(result.checkoutUrl));
			}
		} else {
			await cloud.setPlan(folder, picked.id);
		}
		notify.info(kuundaCloudLocalize('kuunda.cloud.plan.ok', picked.id));
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.cloud.routes',
			f1: true,
			title: kuundaCloudLocalize2('kuunda.cloud.routes'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const cloud = accessor.get(IKuundaCloudService);
		const notify = accessor.get(INotificationService);
		const quick = accessor.get(IQuickInputService);
		const report = cloud.routeReport();
		const verdict = kuundaCloudLocalize(report.legacyRemovable
			? 'kuunda.cloud.routes.removable'
			: 'kuunda.cloud.routes.notRemovable');
		const items: Array<{ id: string; label: string; description?: string; detail?: string }> = [
			...report.families.map((row) => ({
				id: `family:${row.family}`,
				label: `${row.family} — spec ${row.spec} / legacy ${row.legacy}`,
				description: !row.spec && !row.legacy
					? kuundaCloudLocalize('kuunda.cloud.routes.unexercised')
					: row.legacy > 0
						? kuundaCloudLocalize('kuunda.cloud.routes.legacyUsed')
						: kuundaCloudLocalize('kuunda.cloud.routes.specOnly'),
				detail: `${row.specPath} · ${row.legacyPath}`,
			})),
			{
				id: 'reset',
				label: kuundaCloudLocalize('kuunda.cloud.routes.reset'),
				detail: kuundaCloudLocalize('kuunda.cloud.routes.reset.detail'),
			},
		];
		const picked = await quick.pick(items, {
			placeHolder: `mode=${report.mode} · spec=${report.spec} · legacy=${report.legacy} · ${verdict}`,
			ignoreFocusLost: true,
			canPickMany: false,
		});
		if (!picked?.id) {
			return;
		}
		if (picked.id === 'reset') {
			cloud.resetRouteEvidence();
			notify.info(kuundaCloudLocalize('kuunda.cloud.routes.reset.ok'));
			return;
		}
		const row = report.families.find((entry) => `family:${entry.family}` === picked.id);
		if (row) {
			notify.info(formatRouteReport({ ...report, families: [row] }));
		}
	}
});

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(
	KuundaCloudContribution,
	LifecyclePhase.Restored
);

Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration).registerConfiguration({
	id: 'kuundaCloud',
	title: 'Kuunda Cloud',
	type: 'object',
	properties: {
		'kuunda.cloud.enabled': {
			type: 'boolean',
			default: true,
			description: kuundaCloudLocalize('kuunda.cloud.setting.enabled'),
		},
		'kuunda.cloud.defaultPlan': {
			type: 'string',
			default: 'standard',
			description: kuundaCloudLocalize('kuunda.cloud.setting.defaultPlan'),
		},
		'kuunda.cloud.legacyRoutes': {
			type: 'string',
			enum: ['auto', 'off'],
			enumDescriptions: [
				kuundaCloudLocalize('kuunda.cloud.setting.legacyRoutes.auto'),
				kuundaCloudLocalize('kuunda.cloud.setting.legacyRoutes.off'),
			],
			default: 'auto',
			// Transitional: delete this setting together with the legacy branch once the
			// route report shows that every family is served by the spec routes.
			description: kuundaCloudLocalize('kuunda.cloud.setting.legacyRoutes'),
		},
	},
});

export { notifyCloudResult };
