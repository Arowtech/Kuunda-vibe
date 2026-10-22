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
import { kuundaLegalLocalize, kuundaLegalLocalize2, kuundaLegalLocale } from '../common/kuundaLegalNls.js';
import { IKuundaLegalService } from '../common/kuundaLegalService.js';
import { formatRefundPolicy } from '../common/legalPolicy.js';

export const KUUNDA_LEGAL_VIEW_CONTAINER_ID = 'workbench.view.kuundaLegal';
export const KUUNDA_LEGAL_VIEW_ID = 'kuunda.legal.panel';

class KuundaLegalViewPane extends ViewPane {
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
		@IKuundaLegalService private readonly legalService: IKuundaLegalService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
		this._register(this.legalService.onDidChange(() => this.refresh()));
	}

	protected override renderBody(parent: HTMLElement): void {
		super.renderBody(parent);
		parent.style.userSelect = 'text';
		parent.style.overflow = 'auto';
		this.panelBody = append(parent, $('pre.kuunda-legal-panel'));
		this.panelBody.style.whiteSpace = 'pre-wrap';
		this.panelBody.style.padding = '8px';
		this.refresh();
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this.element.style.height = `${height}px`;
		this.element.style.width = `${width}px`;
	}

	private refresh(): void {
		if (this.panelBody) {
			this.panelBody.textContent = this.legalService.formatPanel();
		}
	}
}

const viewContainerRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
const container = viewContainerRegistry.registerViewContainer({
	id: KUUNDA_LEGAL_VIEW_CONTAINER_ID,
	title: kuundaLegalLocalize2('kuunda.legal.panel'),
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [KUUNDA_LEGAL_VIEW_CONTAINER_ID, {
		mergeViewWithContainerWhenSingleView: true,
		orientation: Orientation.VERTICAL,
	}]),
	hideIfEmpty: false,
	order: 12,
	icon: Codicon.law,
}, ViewContainerLocation.Sidebar, { doNotRegisterOpenCommand: false, isDefault: false });

Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry).registerViews([{
	id: KUUNDA_LEGAL_VIEW_ID,
	name: kuundaLegalLocalize2('kuunda.legal.panel'),
	ctorDescriptor: new SyncDescriptor(KuundaLegalViewPane),
	canToggleVisibility: true,
	canMoveView: true,
	weight: 30,
	order: 1,
}], container);

class KuundaLegalContribution implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.kuundaLegal';

	constructor(
		@IKuundaLegalService legal: IKuundaLegalService,
		@INotificationService notify: INotificationService,
	) {
		kuundaLegalLocalize('kuunda.legal.panel');
		void legal.formatPanel();
		if (!legal.hasSeenFirstRunNotice()) {
			notify.info(kuundaLegalLocalize('kuunda.legal.firstRun'));
			legal.markFirstRunNoticeSeen();
		}
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(
	KuundaLegalContribution,
	LifecyclePhase.Eventually,
);

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.legal.showPanel',
			f1: true,
			title: kuundaLegalLocalize2('kuunda.legal.showPanel'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		await accessor.get(IViewsService).openView(KUUNDA_LEGAL_VIEW_ID, true);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.legal.setOfflineMode',
			f1: true,
			title: kuundaLegalLocalize2('kuunda.legal.setOfflineMode'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const legal = accessor.get(IKuundaLegalService);
		const notify = accessor.get(INotificationService);
		const quick = accessor.get(IQuickInputService);
		const picked = await quick.pick(
			[
				{ id: 'on', label: kuundaLegalLocalize('kuunda.legal.setOfflineMode.on') },
				{ id: 'off', label: kuundaLegalLocalize('kuunda.legal.setOfflineMode.off') },
			],
			{ placeHolder: kuundaLegalLocalize('kuunda.legal.setOfflineMode.level'), canPickMany: false },
		);
		if (!picked?.id) {
			return;
		}
		legal.setStrictOffline(picked.id === 'on');
		notify.info(picked.id === 'on'
			? kuundaLegalLocalize('kuunda.legal.offline.blocked')
			: kuundaLegalLocalize('kuunda.legal.setOfflineMode.off'));
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.legal.showPrivacy',
			f1: true,
			title: kuundaLegalLocalize2('kuunda.legal.showPrivacy'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const notify = accessor.get(INotificationService);
		await accessor.get(IViewsService).openView(KUUNDA_LEGAL_VIEW_ID, true);
		notify.info(kuundaLegalLocalize('kuunda.legal.docs.privacy'));
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.legal.showTerms',
			f1: true,
			title: kuundaLegalLocalize2('kuunda.legal.showTerms'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const notify = accessor.get(INotificationService);
		await accessor.get(IViewsService).openView(KUUNDA_LEGAL_VIEW_ID, true);
		notify.info(kuundaLegalLocalize('kuunda.legal.docs.terms'));
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.legal.showRefunds',
			f1: true,
			title: kuundaLegalLocalize2('kuunda.legal.showRefunds'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const notify = accessor.get(INotificationService);
		notify.info(formatRefundPolicy(kuundaLegalLocale()).trim());
	}
});
