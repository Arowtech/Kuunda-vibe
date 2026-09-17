/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

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
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Orientation } from '../../../../base/browser/ui/sash/sash.js';
import { $, append } from '../../../../base/browser/dom.js';
import { IKuundaProjectService } from '../../kuundaProject/common/kuundaProjectService.js';
import { kuundaCloudLocalize, kuundaCloudLocalize2, KUUNDA_CLOUD_STRINGS, type KuundaCloudStringKey } from '../common/kuundaCloudNls.js';
import { IKuundaCloudService, type CloudProvisionResult } from '../common/kuundaCloudService.js';

export const KUUNDA_CLOUD_VIEW_CONTAINER_ID = 'workbench.view.kuundaCloud';
export const KUUNDA_CLOUD_VIEW_ID = 'kuunda.cloud.panel';

class KuundaCloudViewPane extends ViewPane {
	private body: HTMLElement | undefined;

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
		this.body = append(parent, $('pre.kuunda-cloud-panel'));
		this.body.style.whiteSpace = 'pre-wrap';
		this.body.style.padding = '8px';
		void this.refresh();
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this.element.style.height = `${height}px`;
		this.element.style.width = `${width}px`;
	}

	private async refresh(): Promise<void> {
		if (!this.body) {
			return;
		}
		this.body.textContent = await this.cloudService.formatPanel();
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

class KuundaCloudContribution implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.kuundaCloud';

	constructor(
		@IKuundaCloudService cloud: IKuundaCloudService,
	) {
		kuundaCloudLocalize('kuunda.cloud.tagline');
		void cloud.formatPanel();
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
			ignoreFocusOut: true,
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

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(
	KuundaCloudContribution,
	LifecyclePhase.Restored
);

export { notifyCloudResult };
