/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import './media/kuundaAccount.css';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IWorkbenchContribution, IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from '../../../common/contributions.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { ILayoutService } from '../../../../platform/layout/browser/layoutService.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IURLService } from '../../../../platform/url/common/url.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { kuundaAccountErrorMessage, kuundaAccountLocalize, kuundaAccountLocalize2 } from '../common/kuundaAccountNls.js';
import { IKuundaAccountService } from '../common/kuundaAccountService.js';
import { IKuundaBillingService } from '../../kuundaBilling/common/kuundaBillingService.js';
import { openKuundaAccountStudio } from './kuundaAccountStudio.js';

class KuundaAccountContribution implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.kuundaAccount';

	constructor(
		@IKuundaAccountService account: IKuundaAccountService,
		@IURLService urlService: IURLService,
		@INotificationService notification: INotificationService,
		@ILayoutService layout: ILayoutService,
		@IKuundaBillingService billing: IKuundaBillingService,
		@IOpenerService opener: IOpenerService,
	) {
		kuundaAccountLocalize('kuunda.account.tagline');
		urlService.registerHandler({
			handleURL: async (uri) => {
				if (!account.isAuthCallback(uri)) {
					return false;
				}
				const result = await account.completeOAuthCallback(uri.query);
				if (result.ok) {
					openKuundaAccountStudio(layout, account, billing, opener);
				} else {
					notification.error(kuundaAccountErrorMessage(result.error));
				}
				return true;
			},
		});
	}
}

function openStudio(accessor: ServicesAccessor, options?: unknown): void {
	openKuundaAccountStudio(
		accessor.get(ILayoutService),
		accessor.get(IKuundaAccountService),
		accessor.get(IKuundaBillingService),
		accessor.get(IOpenerService),
		options,
	);
}

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.account.openStudio',
			f1: true,
			title: kuundaAccountLocalize2('kuunda.account.openStudio'),
			menu: {
				id: MenuId.AccountsContext,
				group: '0_kuunda',
				order: 0,
			},
		});
	}

	run(accessor: ServicesAccessor, options?: unknown): void {
		openStudio(accessor, options);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.account.signOut',
			f1: true,
			title: kuundaAccountLocalize2('kuunda.account.signOut'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		await accessor.get(IKuundaAccountService).signOut(false);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.account.signOutEverywhere',
			f1: true,
			title: kuundaAccountLocalize2('kuunda.account.signOutEverywhere'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		await accessor.get(IKuundaAccountService).signOut(true);
	}
});

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(
	KuundaAccountContribution,
	LifecyclePhase.Restored
);
