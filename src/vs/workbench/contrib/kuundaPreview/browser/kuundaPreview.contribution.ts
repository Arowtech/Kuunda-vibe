/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IWorkbenchContribution, IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from '../../../common/contributions.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { kuundaPreviewLocalize, kuundaPreviewLocalize2 } from '../common/kuundaPreviewNls.js';
import { IKuundaPreviewService } from './kuundaPreviewService.js';

class KuundaPreviewContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.kuundaPreview';

	constructor(
		@IKuundaPreviewService preview: IKuundaPreviewService,
		@IWorkspaceContextService workspace: IWorkspaceContextService,
	) {
		super();
		kuundaPreviewLocalize('kuunda.preview.tagline');
		const open = () => {
			if (workspace.getWorkspace().folders.length) {
				void preview.open({ preserveFocus: true, auto: true });
			}
		};
		open();
		this._register(workspace.onDidChangeWorkspaceFolders(open));
	}
}

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.preview.open',
			f1: true,
			title: kuundaPreviewLocalize2('kuunda.preview.open'),
			menu: {
				id: MenuId.MenubarViewMenu,
				group: '4_preview',
				order: 1,
			},
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		await accessor.get(IKuundaPreviewService).open({ preserveFocus: false });
	}
});

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(
	KuundaPreviewContribution,
	LifecyclePhase.Eventually
);
