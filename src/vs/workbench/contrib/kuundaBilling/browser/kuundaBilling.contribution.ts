/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IWorkbenchContribution, IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from '../../../common/contributions.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IStatusbarService, StatusbarAlignment } from '../../../services/statusbar/browser/statusbar.js';
import { kuundaBillingLocalize, kuundaBillingLocalize2 } from '../common/kuundaBillingNls.js';
import { IKuundaBillingService } from '../common/kuundaBillingService.js';

class KuundaBillingContribution extends Disposable implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.kuundaBilling';

	constructor(
		@IKuundaBillingService billing: IKuundaBillingService,
		@IStatusbarService statusbar: IStatusbarService,
	) {
		super();
		kuundaBillingLocalize('kuunda.billing.tagline');
		const entry = statusbar.addEntry({
			name: kuundaBillingLocalize('kuunda.billing.statusbar.unset'),
			text: kuundaBillingLocalize('kuunda.billing.statusbar.unset'),
			ariaLabel: kuundaBillingLocalize('kuunda.billing.statusbar.unset'),
			command: 'kuunda.billing.refresh',
		}, 'kuunda.billing.credits', StatusbarAlignment.RIGHT, 50);
		this._register(entry);
		this._register(billing.onDidChangeBalance((balance) => {
			const text = balance
				? kuundaBillingLocalize('kuunda.billing.statusbar', balance.remaining)
				: kuundaBillingLocalize('kuunda.billing.statusbar.unset');
			entry.update({
				name: text,
				text,
				ariaLabel: text,
				command: 'kuunda.billing.refresh',
			});
		}));
		void billing.getBalance();
	}
}

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.billing.setUser',
			f1: true,
			title: kuundaBillingLocalize2('kuunda.billing.setUser'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const quick = accessor.get(IQuickInputService);
		const billing = accessor.get(IKuundaBillingService);
		const value = await quick.input({
			prompt: kuundaBillingLocalize('kuunda.billing.setUser.prompt'),
			value: billing.getUserId() || '',
		});
		if (value?.trim()) {
			await billing.setUserId(value.trim());
		}
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.billing.refresh',
			f1: true,
			title: kuundaBillingLocalize2('kuunda.billing.refresh'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const billing = accessor.get(IKuundaBillingService);
		const notify = accessor.get(INotificationService);
		const balance = await billing.getBalance();
		if (balance) {
			notify.info(kuundaBillingLocalize('kuunda.billing.statusbar', balance.remaining));
		} else {
			notify.info(kuundaBillingLocalize('kuunda.billing.statusbar.unset'));
		}
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.billing.openPlans',
			f1: true,
			title: kuundaBillingLocalize2('kuunda.billing.plans'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const opener = accessor.get(IOpenerService);
		const billing = accessor.get(IKuundaBillingService);
		await opener.open(URI.parse(billing.accountUrl));
	}
});

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(
	KuundaBillingContribution,
	LifecyclePhase.Restored
);
