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
import { IFileDialogService } from '../../../../platform/dialogs/common/dialogs.js';
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
import { ContextKeyExpr, IContextKey, IContextKeyService, RawContextKey } from '../../../../platform/contextkey/common/contextkey.js';
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
import { kuundaPublishLocalize, kuundaPublishLocalize2, KUUNDA_PUBLISH_STRINGS, type KuundaPublishStringKey } from '../common/kuundaPublishNls.js';
import { IKuundaPublishService, type PublishStartResult, type PublishWriteResult } from '../common/kuundaPublishService.js';
import { isPublishPanelVisible } from '../common/publishPolicy.js';

export const KUUNDA_PUBLISH_VIEW_CONTAINER_ID = 'workbench.view.kuundaPublish';
export const KUUNDA_PUBLISH_VIEW_ID = 'kuunda.publish.panel';
export const KuundaPublishVisibleContext = new RawContextKey<boolean>('kuunda.publish.visible', false);

class KuundaPublishViewPane extends ViewPane {
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
		@IKuundaPublishService private readonly publishService: IKuundaPublishService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
		this._register(this.publishService.onDidChange(() => {
			void this.refresh();
		}));
	}

	protected override renderBody(parent: HTMLElement): void {
		super.renderBody(parent);
		parent.style.userSelect = 'text';
		parent.style.overflow = 'auto';
		this.body = append(parent, $('pre.kuunda-publish-panel'));
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
		this.body.textContent = await this.publishService.formatPanel();
	}
}

const viewContainerRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
const container = viewContainerRegistry.registerViewContainer({
	id: KUUNDA_PUBLISH_VIEW_CONTAINER_ID,
	title: kuundaPublishLocalize2('kuunda.publish.panel'),
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [KUUNDA_PUBLISH_VIEW_CONTAINER_ID, {
		mergeViewWithContainerWhenSingleView: true,
		orientation: Orientation.VERTICAL,
	}]),
	hideIfEmpty: true,
	order: 11,
	icon: Codicon.rocket,
}, ViewContainerLocation.Sidebar, { doNotRegisterOpenCommand: false, isDefault: false });

Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry).registerViews([{
	id: KUUNDA_PUBLISH_VIEW_ID,
	name: kuundaPublishLocalize2('kuunda.publish.panel'),
	ctorDescriptor: new SyncDescriptor(KuundaPublishViewPane),
	canToggleVisibility: true,
	canMoveView: true,
	weight: 40,
	order: 1,
	when: ContextKeyExpr.equals('kuunda.publish.visible', true),
}], container);

class KuundaPublishContribution implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.kuundaPublish';
	private readonly visible: IContextKey<boolean>;

	constructor(
		@IKuundaPublishService publish: IKuundaPublishService,
		@IContextKeyService contextKeyService: IContextKeyService,
	) {
		kuundaPublishLocalize('kuunda.publish.tagline');
		this.visible = KuundaPublishVisibleContext.bindTo(contextKeyService);
		this.visible.set(publish.isPanelVisible());
		publish.onDidChange(() => {
			this.visible.set(publish.isPanelVisible());
		});
		void publish.refreshVisibility();
	}
}

async function pickMobileFolder(
	project: IKuundaProjectService,
	quick: IQuickInputService,
	notify: INotificationService,
): Promise<URI | undefined> {
	const rows = (await project.listWorkspaceManifests()).filter((row) => isPublishPanelVisible(row.manifest));
	if (!rows.length) {
		notify.info(kuundaPublishLocalize('kuunda.publish.none'));
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
			placeHolder: kuundaPublishLocalize('kuunda.publish.pickFolder'),
			ignoreFocusOut: true,
			canPickMany: false,
		},
	);
	if (!picked?.id) {
		return undefined;
	}
	return rows.find((row) => row.folder.toString() === picked.id)?.folder;
}

function notifyWrite(notify: INotificationService, result: PublishWriteResult, successKey: KuundaPublishStringKey, ...args: Array<string | number>): void {
	if (!result.ok) {
		notifyPublishError(notify, result.error);
		return;
	}
	notify.info(kuundaPublishLocalize(successKey, ...args));
}

function notifyPublishError(notify: INotificationService, error: string): void {
	if (error === 'timeout') {
		notify.error(kuundaPublishLocalize('kuunda.publish.network.timeout'));
		return;
	}
	if (error === 'offline' || error === 'unreachable') {
		notify.error(kuundaPublishLocalize('kuunda.publish.network.offline'));
		return;
	}
	const key = `kuunda.publish.error.${error}` as KuundaPublishStringKey;
	if (key in KUUNDA_PUBLISH_STRINGS) {
		notify.error(kuundaPublishLocalize(key));
		return;
	}
	notify.error(kuundaPublishLocalize('kuunda.publish.error.write_failed'));
}

function notifyStart(notify: INotificationService, result: PublishStartResult): void {
	if (!result.ok) {
		notifyPublishError(notify, result.error);
		return;
	}
	if (result.action === 'pending_ci') {
		notify.info(kuundaPublishLocalize('kuunda.publish.start.pendingCi', result.job.id));
		return;
	}
	notify.info(kuundaPublishLocalize('kuunda.publish.start.ok', result.job.id, result.job.status));
}

async function pickFile(dialog: IFileDialogService, titleKey: KuundaPublishStringKey, filterKey: KuundaPublishStringKey, extensions: string[]): Promise<URI | undefined> {
	const picked = await dialog.showOpenDialog({
		title: kuundaPublishLocalize(titleKey),
		canSelectFiles: true,
		canSelectFolders: false,
		canSelectMany: false,
		filters: [{ name: kuundaPublishLocalize(filterKey), extensions }],
	});
	return picked?.[0];
}

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.publish.showPanel',
			f1: true,
			title: kuundaPublishLocalize2('kuunda.publish.showPanel'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		await accessor.get(IViewsService).openView(KUUNDA_PUBLISH_VIEW_ID, true);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.publish.configurePlay',
			f1: true,
			title: kuundaPublishLocalize2('kuunda.publish.configurePlay'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const folder = await pickMobileFolder(accessor.get(IKuundaProjectService), accessor.get(IQuickInputService), accessor.get(INotificationService));
		if (!folder) {
			return;
		}
		const source = await pickFile(accessor.get(IFileDialogService), 'kuunda.publish.pickPlayJson', 'kuunda.publish.filter.json', ['json']);
		if (!source) {
			return;
		}
		const result = await accessor.get(IKuundaPublishService).configurePlay(folder, source);
		notifyWrite(accessor.get(INotificationService), result, 'kuunda.publish.configure.ok');
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.publish.configureAppStore',
			f1: true,
			title: kuundaPublishLocalize2('kuunda.publish.configureAppStore'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const notify = accessor.get(INotificationService);
		const quick = accessor.get(IQuickInputService);
		const folder = await pickMobileFolder(accessor.get(IKuundaProjectService), quick, notify);
		if (!folder) {
			return;
		}
		const source = await pickFile(accessor.get(IFileDialogService), 'kuunda.publish.pickP8', 'kuunda.publish.filter.p8', ['p8']);
		if (!source) {
			return;
		}
		const keyId = await quick.input({ prompt: kuundaPublishLocalize('kuunda.publish.appStore.keyId'), ignoreFocusOut: true });
		if (!keyId) {
			return;
		}
		const issuerId = await quick.input({ prompt: kuundaPublishLocalize('kuunda.publish.appStore.issuerId'), ignoreFocusOut: true });
		if (!issuerId) {
			return;
		}
		const result = await accessor.get(IKuundaPublishService).configureAppStore(folder, source, { keyId, issuerId });
		notifyWrite(notify, result, 'kuunda.publish.configure.ok');
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.publish.configureSignature',
			f1: true,
			title: kuundaPublishLocalize2('kuunda.publish.configureSignature'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const folder = await pickMobileFolder(accessor.get(IKuundaProjectService), accessor.get(IQuickInputService), accessor.get(INotificationService));
		if (!folder) {
			return;
		}
		const source = await pickFile(accessor.get(IFileDialogService), 'kuunda.publish.pickKeystore', 'kuunda.publish.filter.keystore', ['keystore', 'jks']);
		if (!source) {
			return;
		}
		const result = await accessor.get(IKuundaPublishService).configureSignature(folder, source);
		notifyWrite(accessor.get(INotificationService), result, 'kuunda.publish.signature.ok');
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.publish.setMetadata',
			f1: true,
			title: kuundaPublishLocalize2('kuunda.publish.setMetadata'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const notify = accessor.get(INotificationService);
		const quick = accessor.get(IQuickInputService);
		const folder = await pickMobileFolder(accessor.get(IKuundaProjectService), quick, notify);
		if (!folder) {
			return;
		}
		const packageId = await quick.input({ prompt: kuundaPublishLocalize('kuunda.publish.metadata.packageId'), ignoreFocusOut: true });
		if (!packageId) {
			return;
		}
		const version = await quick.input({ prompt: kuundaPublishLocalize('kuunda.publish.metadata.version'), value: '1.0.0', ignoreFocusOut: true });
		if (!version) {
			return;
		}
		const result = await accessor.get(IKuundaPublishService).setMetadata(folder, { version, packageId });
		notifyWrite(notify, result, 'kuunda.publish.metadata.ok', packageId, version);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.publish.start',
			f1: true,
			title: kuundaPublishLocalize2('kuunda.publish.start'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const notify = accessor.get(INotificationService);
		const folder = await pickMobileFolder(accessor.get(IKuundaProjectService), accessor.get(IQuickInputService), notify);
		if (!folder) {
			return;
		}
		const result = await accessor.get(IKuundaPublishService).startPublish(folder);
		notifyStart(notify, result);
		if (result.ok) {
			await accessor.get(IViewsService).openView(KUUNDA_PUBLISH_VIEW_ID, true);
		}
	}
});

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(
	KuundaPublishContribution,
	LifecyclePhase.Restored
);
