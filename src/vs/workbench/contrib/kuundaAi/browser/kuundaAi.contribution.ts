/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import { Registry } from '../../../../platform/registry/common/platform.js';
import { IWorkbenchContribution, IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from '../../../common/contributions.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { kuundaAiLocalize, kuundaAiLocalize2 } from '../common/kuundaAiNls.js';
import { IKuundaCodebaseService } from '../common/kuundaCodebaseService.js';

class KuundaAiContribution implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.kuundaAi';

	constructor() {
		kuundaAiLocalize('kuunda.ai.tagline');
	}
}

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.codebase.reindex',
			f1: true,
			title: kuundaAiLocalize2('kuunda.ai.reindex'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const codebase = accessor.get(IKuundaCodebaseService);
		const notify = accessor.get(INotificationService);
		const n = await codebase.reindex();
		notify.info(kuundaAiLocalize('kuunda.ai.tagline') + ` (${n})`);
	}
});

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(
	KuundaAiContribution,
	LifecyclePhase.Eventually
);
