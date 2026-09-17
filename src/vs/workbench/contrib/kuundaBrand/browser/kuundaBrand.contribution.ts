/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import { Registry } from '../../../../platform/registry/common/platform.js';
import { IWorkbenchContribution, IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from '../../../common/contributions.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { kuundaLocalize } from '../common/kuundaNls.js';

/**
 * Isolated branding contribution. Product names come from product.json.
 * English is the fallback; French is selected at runtime via getNLSLanguage().
 */
class KuundaBrandContribution implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.kuundaBrand';

	constructor() {
		kuundaLocalize('kuunda.about.attribution');
		kuundaLocalize('kuunda.product.tagline');
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(
	KuundaBrandContribution,
	LifecyclePhase.Eventually
);
