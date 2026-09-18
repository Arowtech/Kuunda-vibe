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
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { kuundaExtLocalize, kuundaExtLocalize2 } from '../common/kuundaExtNls.js';
import { IKuundaExtService, KuundaApiInvokeInput } from '../common/kuundaExtService.js';
import { type KuundaApiPermission } from '../common/extensionApi.js';
import '../common/kuundaExtPoint.js';

class KuundaExtContribution implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.kuundaExt';

	constructor() {
		kuundaExtLocalize('kuunda.ext.tagline');
	}
}

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.api.version',
			f1: false,
			title: kuundaExtLocalize2('kuunda.ext.showApi'),
		});
	}

	async run(accessor: ServicesAccessor, payload?: KuundaApiInvokeInput): Promise<unknown> {
		const ext = accessor.get(IKuundaExtService);
		if (payload?.extensionId) {
			return ext.invoke({ extensionId: payload.extensionId, method: 'api.version', apiVersion: payload.apiVersion });
		}
		return ext.describeApi();
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.api.invoke',
			f1: false,
			title: kuundaExtLocalize2('kuunda.ext.tagline'),
		});
	}

	async run(accessor: ServicesAccessor, payload?: KuundaApiInvokeInput): Promise<unknown> {
		const ext = accessor.get(IKuundaExtService);
		return ext.invoke(payload || {});
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.ext.grantAccess',
			f1: true,
			title: kuundaExtLocalize2('kuunda.ext.grantAccess'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const ext = accessor.get(IKuundaExtService);
		const quick = accessor.get(IQuickInputService);
		const notify = accessor.get(INotificationService);
		const dialog = accessor.get(IDialogService);
		const candidates = ext.listDeclarativeExtensions();
		if (!candidates.length) {
			notify.info(kuundaExtLocalize('kuunda.ext.grantAccess.none'));
			return;
		}
		const pickedExt = await quick.pick(
			candidates.map((item) => ({
				label: item.displayName || item.name,
				description: item.identifier.value,
				id: item.identifier.value,
			})),
			{ placeHolder: kuundaExtLocalize('kuunda.ext.grantAccess.extension'), canPickMany: false },
		);
		if (!pickedExt?.id) {
			return;
		}
		const declared = ext.declaredPermissions(pickedExt.id);
		if (!declared.length) {
			notify.info(kuundaExtLocalize('kuunda.ext.grantAccess.none'));
			return;
		}
		const pickedPerm = await quick.pick(
			declared.map((id) => ({ label: id, id })),
			{ placeHolder: kuundaExtLocalize('kuunda.ext.grantAccess.permission'), canPickMany: false },
		);
		if (!pickedPerm?.id) {
			return;
		}
		const source = await ext.sourceOf(pickedExt.id);
		const confirmKey = source === 'sideload' ? 'kuunda.ext.grantAccess.sideload' : 'kuunda.ext.grantAccess.confirm';
		const confirmed = await dialog.confirm({
			message: kuundaExtLocalize(confirmKey, pickedExt.id, pickedPerm.id),
		});
		if (!confirmed.confirmed) {
			return;
		}
		if (!ext.grant(pickedExt.id, pickedPerm.id as KuundaApiPermission)) {
			notify.info(kuundaExtLocalize('kuunda.ext.grantAccess.undeclared', pickedExt.id, pickedPerm.id));
			return;
		}
		notify.info(kuundaExtLocalize('kuunda.ext.grantAccess.ok', pickedExt.id, pickedPerm.id));
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.ext.revokeAccess',
			f1: true,
			title: kuundaExtLocalize2('kuunda.ext.revokeAccess'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const ext = accessor.get(IKuundaExtService);
		const quick = accessor.get(IQuickInputService);
		const notify = accessor.get(INotificationService);
		const grants = Object.keys(ext.listGrants());
		if (!grants.length) {
			notify.info(kuundaExtLocalize('kuunda.ext.revokeAccess.none'));
			return;
		}
		const picked = await quick.pick(
			grants.map((id) => ({ label: id, id })),
			{ placeHolder: kuundaExtLocalize('kuunda.ext.revokeAccess'), canPickMany: false },
		);
		if (!picked?.id) {
			return;
		}
		ext.revoke(picked.id);
		notify.info(kuundaExtLocalize('kuunda.ext.revokeAccess.ok', picked.id));
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.ext.showApi',
			f1: true,
			title: kuundaExtLocalize2('kuunda.ext.showApi'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const ext = accessor.get(IKuundaExtService);
		const notify = accessor.get(INotificationService);
		const api = ext.describeApi();
		notify.info(`${api.version} · ${api.format} · ${api.marketplace} · ${api.methods.join(', ')}`);
	}
});

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(
	KuundaExtContribution,
	LifecyclePhase.Eventually
);
