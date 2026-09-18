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
import { kuundaFeedbackLocalize, kuundaFeedbackLocalize2 } from '../common/kuundaFeedbackNls.js';
import { IKuundaFeedbackService } from '../common/kuundaFeedbackService.js';
import { FEEDBACK_CATEGORIES } from '../common/feedbackPolicy.js';

export const KUUNDA_FEEDBACK_VIEW_CONTAINER_ID = 'workbench.view.kuundaFeedback';
export const KUUNDA_FEEDBACK_VIEW_ID = 'kuunda.feedback.panel';

class KuundaFeedbackViewPane extends ViewPane {
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
		@IKuundaFeedbackService private readonly feedbackService: IKuundaFeedbackService,
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
		this._register(this.feedbackService.onDidChange(() => this.refresh()));
	}

	protected override renderBody(parent: HTMLElement): void {
		super.renderBody(parent);
		parent.style.userSelect = 'text';
		parent.style.overflow = 'auto';
		this.panelBody = append(parent, $('pre.kuunda-feedback-panel'));
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
			this.panelBody.textContent = this.feedbackService.formatPanel();
		}
	}
}

const viewContainerRegistry = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry);
const container = viewContainerRegistry.registerViewContainer({
	id: KUUNDA_FEEDBACK_VIEW_CONTAINER_ID,
	title: kuundaFeedbackLocalize2('kuunda.feedback.panel'),
	ctorDescriptor: new SyncDescriptor(ViewPaneContainer, [KUUNDA_FEEDBACK_VIEW_CONTAINER_ID, {
		mergeViewWithContainerWhenSingleView: true,
		orientation: Orientation.VERTICAL,
	}]),
	hideIfEmpty: false,
	order: 13,
	icon: Codicon.commentDiscussion,
}, ViewContainerLocation.Sidebar, { doNotRegisterOpenCommand: false, isDefault: false });

Registry.as<IViewsRegistry>(ViewExtensions.ViewsRegistry).registerViews([{
	id: KUUNDA_FEEDBACK_VIEW_ID,
	name: kuundaFeedbackLocalize2('kuunda.feedback.panel'),
	ctorDescriptor: new SyncDescriptor(KuundaFeedbackViewPane),
	canToggleVisibility: true,
	canMoveView: true,
	weight: 30,
	order: 1,
}], container);

class KuundaFeedbackContribution implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.kuundaFeedback';

	constructor(
		@IKuundaFeedbackService feedback: IKuundaFeedbackService,
	) {
		void feedback.formatPanel();
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(
	KuundaFeedbackContribution,
	LifecyclePhase.Eventually,
);

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.feedback.showPanel',
			f1: true,
			title: kuundaFeedbackLocalize2('kuunda.feedback.showPanel'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		await accessor.get(IViewsService).openView(KUUNDA_FEEDBACK_VIEW_ID, true);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.feedback.send',
			f1: true,
			title: kuundaFeedbackLocalize2('kuunda.feedback.send'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const feedback = accessor.get(IKuundaFeedbackService);
		const notify = accessor.get(INotificationService);
		const quick = accessor.get(IQuickInputService);
		const category = await quick.pick(
			FEEDBACK_CATEGORIES.map((id) => ({
				id,
				label: kuundaFeedbackLocalize(`kuunda.feedback.category.${id}`),
			})),
			{ placeHolder: kuundaFeedbackLocalize('kuunda.feedback.category'), canPickMany: false },
		);
		if (!category?.id) {
			return;
		}
		const severity = await quick.pick(
			[
				{ id: '1', label: kuundaFeedbackLocalize('kuunda.feedback.severity.1') },
				{ id: '2', label: kuundaFeedbackLocalize('kuunda.feedback.severity.2') },
				{ id: '3', label: kuundaFeedbackLocalize('kuunda.feedback.severity.3') },
			],
			{ placeHolder: kuundaFeedbackLocalize('kuunda.feedback.severity'), canPickMany: false },
		);
		if (!severity?.id) {
			return;
		}
		const title = await quick.input({ prompt: kuundaFeedbackLocalize('kuunda.feedback.title') });
		if (!title) {
			return;
		}
		const body = await quick.input({ prompt: kuundaFeedbackLocalize('kuunda.feedback.body') });
		const consent = await quick.pick(
			[
				{ id: 'yes', label: kuundaFeedbackLocalize('kuunda.feedback.consent.yes') },
				{ id: 'no', label: kuundaFeedbackLocalize('kuunda.feedback.consent.no') },
			],
			{ placeHolder: kuundaFeedbackLocalize('kuunda.feedback.consent'), canPickMany: false },
		);
		if (consent?.id !== 'yes') {
			return;
		}
		const result = await feedback.submit({
			category: category.id,
			severity: Number(severity.id),
			title,
			body: body || '',
			consent: true,
		});
		if (result.ok) {
			notify.info(kuundaFeedbackLocalize('kuunda.feedback.sent'));
			await accessor.get(IViewsService).openView(KUUNDA_FEEDBACK_VIEW_ID, true);
			return;
		}
		notify.error(result.message);
	}
});
