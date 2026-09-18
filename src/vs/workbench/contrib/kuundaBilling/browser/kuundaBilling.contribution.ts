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
import { IKuundaLegalService } from '../../kuundaLegal/common/kuundaLegalService.js';
import { kuundaLegalLocalize } from '../../kuundaLegal/common/kuundaLegalNls.js';

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

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.billing.checkout',
			f1: true,
			title: kuundaBillingLocalize2('kuunda.billing.checkout'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const billing = accessor.get(IKuundaBillingService);
		const notify = accessor.get(INotificationService);
		const quick = accessor.get(IQuickInputService);
		const opener = accessor.get(IOpenerService);
		if (accessor.get(IKuundaLegalService).isStrictOffline()) {
			notify.info(kuundaLegalLocalize('kuunda.legal.offline.blocked'));
			return;
		}
		if (!billing.getUserId()) {
			notify.info(kuundaBillingLocalize('kuunda.billing.checkout.needUser'));
			return;
		}
		const plans = await billing.listPlans();
		const paid = plans.filter((plan) => (plan.price?.amount ?? 0) > 0);
		if (paid.length === 0) {
			notify.info(kuundaBillingLocalize('kuunda.billing.checkout.unavailable'));
			return;
		}
		const picked = await quick.pick(paid.map((plan) => ({
			id: plan.id,
			label: plan.name,
			description: plan.id,
		})), { canPickMany: false });
		if (!picked?.id) {
			return;
		}
		const result = await billing.startCheckout(picked.id);
		if (!result?.checkoutUrl) {
			notify.info(kuundaBillingLocalize('kuunda.billing.checkout.unavailable'));
			return;
		}
		await opener.open(URI.parse(result.checkoutUrl));
	}
});

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(
	KuundaBillingContribution,
	LifecyclePhase.Restored
);
