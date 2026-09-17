/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IWorkbenchContribution, IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from '../../../common/contributions.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';

/**
 * Isolated branding contribution. Product names come from product.json.
 * English is the nls fallback; French lives in common/strings.json until a language pack ships.
 */
class KuundaBrandContribution implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.kuundaBrand';

	constructor() {
		localize(
			'kuunda.about.attribution',
			'Kuunda Vibe is a fork of Void (Glass Devtools) and Code - OSS (Microsoft). Steward: Arowtech.'
		);
		localize(
			'kuunda.product.tagline',
			'The Kuunda desktop IDE. Default language: English.'
		);
	}
}

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(
	KuundaBrandContribution,
	LifecyclePhase.Eventually
);
