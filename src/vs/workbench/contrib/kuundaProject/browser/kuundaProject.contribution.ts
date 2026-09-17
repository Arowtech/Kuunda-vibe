/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import { Registry } from '../../../../platform/registry/common/platform.js';
import { IWorkbenchContribution, IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from '../../../common/contributions.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IDialogService, IFileDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IWorkspaceContextService, WorkbenchState } from '../../../../platform/workspace/common/workspace.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { isMacintosh } from '../../../../base/common/platform.js';
import { kuundaProjectLocalize, kuundaProjectLocalize2, KUUNDA_PROJECT_STRINGS, type KuundaProjectStringKey } from '../common/kuundaProjectNls.js';
import { IKuundaProjectService } from '../common/kuundaProjectService.js';
import { PROJECT_TYPES, MOBILE_PUBLISH_OPTIONS, publishOptionFromTargets, sanitizeProjectName, type MobilePublishOption } from '../common/projectType.js';
import { IKuundaCloudService } from '../../kuundaCloud/common/kuundaCloudService.js';
import { kuundaCloudLocalize } from '../../kuundaCloud/common/kuundaCloudNls.js';
import { IKuundaPublishService } from '../../kuundaPublish/common/kuundaPublishService.js';

class KuundaProjectContribution implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.kuundaProject';

	constructor(
		@IWorkspaceContextService workspace: IWorkspaceContextService,
		@IDialogService dialog: IDialogService,
		@ICommandService commands: ICommandService,
	) {
		kuundaProjectLocalize('kuunda.project.tagline');
		if (workspace.getWorkbenchState() !== WorkbenchState.EMPTY) {
			return;
		}
		void dialog.prompt({
			type: Severity.Info,
			message: kuundaProjectLocalize('kuunda.project.empty.title'),
			detail: kuundaProjectLocalize('kuunda.project.empty.detail'),
			buttons: [
				{
					label: kuundaProjectLocalize('kuunda.project.empty.create'),
					run: () => commands.executeCommand('kuunda.project.create'),
				},
				{
					label: kuundaProjectLocalize('kuunda.project.empty.open'),
					run: () => commands.executeCommand(isMacintosh ? 'workbench.action.files.openFileFolder' : 'workbench.action.files.openFolder'),
				},
			],
			cancelButton: {
				label: kuundaProjectLocalize('kuunda.project.empty.later'),
				run: () => { },
			},
		});
	}
}

async function runCreateWizard(accessor: ServicesAccessor): Promise<void> {
	const project = accessor.get(IKuundaProjectService);
	const quick = accessor.get(IQuickInputService);
	const notify = accessor.get(INotificationService);
	const fileDialog = accessor.get(IFileDialogService);
	const host = accessor.get(IHostService);
	const type = await pickRequired(quick, 'kuunda.project.create.type', PROJECT_TYPES, (id) => `kuunda.project.create.type.${id}` as KuundaProjectStringKey);
	if (!type) {
		notify.info(kuundaProjectLocalize('kuunda.project.create.cancelled'));
		return;
	}
	let publishOption: MobilePublishOption | undefined;
	if (type === 'mobile') {
		publishOption = await pickRequired(quick, 'kuunda.project.create.publish', MOBILE_PUBLISH_OPTIONS, (id) => `kuunda.project.create.publish.${id}` as KuundaProjectStringKey);
		if (!publishOption) {
			notify.info(kuundaProjectLocalize('kuunda.project.create.cancelled'));
			return;
		}
	}
	const name = await quick.input({
		prompt: kuundaProjectLocalize('kuunda.project.create.name'),
		ignoreFocusOut: true,
	});
	if (!name?.trim()) {
		notify.info(kuundaProjectLocalize('kuunda.project.create.cancelled'));
		return;
	}
	if (!sanitizeProjectName(name)) {
		notify.error(kuundaProjectLocalize('kuunda.project.error.name_required'));
		return;
	}
	const picked = await fileDialog.showOpenDialog({
		canSelectFiles: false,
		canSelectFolders: true,
		canSelectMany: false,
		openLabel: kuundaProjectLocalize('kuunda.project.create.open'),
		title: kuundaProjectLocalize('kuunda.project.create.parent'),
	});
	if (!picked?.[0]) {
		notify.info(kuundaProjectLocalize('kuunda.project.create.cancelled'));
		return;
	}
	const result = await project.create({
		type,
		name,
		parent: picked[0],
		publishOption,
	});
	if (!result.ok) {
		notify.error(localizeCreateError(result.error));
		return;
	}
	notify.info(kuundaProjectLocalize('kuunda.project.create.ok', result.manifest.name, result.manifest.type));
	const cloud = accessor.get(IKuundaCloudService);
	const cloudResult = await cloud.provisionFolder(result.folder, {
		type: result.manifest.type,
		name: result.manifest.name,
		enabled: true,
	});
	if (!cloudResult.ok) {
		notify.info(kuundaCloudLocalize('kuunda.cloud.provision.pendingApi'));
	} else if (cloudResult.action === 'pending_user') {
		notify.info(kuundaCloudLocalize('kuunda.cloud.provision.pendingUser'));
	} else if (cloudResult.action === 'pending_api') {
		notify.info(kuundaCloudLocalize('kuunda.cloud.provision.pendingApi'));
	} else if (cloudResult.action === 'reuse' || cloudResult.action === 'provision') {
		notify.info(kuundaCloudLocalize('kuunda.cloud.provision.ok', cloudResult.cloud.projectRef || 'proj'));
	}
	await accessor.get(IKuundaPublishService).prepareFolder(result.folder);
	await host.openWindow([{ folderUri: result.folder }], { forceReuseWindow: true });
}

async function pickRequired<T extends string>(
	quick: IQuickInputService,
	promptKey: KuundaProjectStringKey,
	ids: readonly T[],
	labelKey: (id: T) => KuundaProjectStringKey,
): Promise<T | undefined> {
	const picked = await quick.pick(
		ids.map((id) => ({
			id,
			label: kuundaProjectLocalize(labelKey(id)),
			description: id,
		})),
		{
			placeHolder: kuundaProjectLocalize(promptKey),
			ignoreFocusOut: true,
			canPickMany: false,
		},
	);
	return picked?.id as T | undefined;
}

function localizeCreateError(error: string): string {
	const key = `kuunda.project.error.${error}` as KuundaProjectStringKey;
	if (key in KUUNDA_PROJECT_STRINGS) {
		return kuundaProjectLocalize(key);
	}
	return kuundaProjectLocalize('kuunda.project.create.error', error);
}

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.project.create',
			f1: true,
			title: kuundaProjectLocalize2('kuunda.project.create'),
			menu: {
				id: MenuId.MenubarFileMenu,
				group: '1_new',
				order: 0,
			},
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		await runCreateWizard(accessor);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.project.showType',
			f1: true,
			title: kuundaProjectLocalize2('kuunda.project.showType'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const project = accessor.get(IKuundaProjectService);
		const notify = accessor.get(INotificationService);
		const rows = await project.listWorkspaceManifests();
		if (!rows.length) {
			notify.info(kuundaProjectLocalize('kuunda.project.showType.none'));
			return;
		}
		notify.info(rows.map((row) => {
			if (row.manifest.type === 'mobile') {
				return kuundaProjectLocalize('kuunda.project.showType.mobile', row.folderName, row.manifest.type, publishOptionFromTargets(row.manifest.publishTargets));
			}
			return kuundaProjectLocalize('kuunda.project.showType.ok', row.folderName, row.manifest.type);
		}).join('\n'));
	}
});

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(
	KuundaProjectContribution,
	LifecyclePhase.Restored
);
