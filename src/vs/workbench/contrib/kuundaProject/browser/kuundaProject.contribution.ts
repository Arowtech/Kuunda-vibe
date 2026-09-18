/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import './media/kuundaProject.css';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IWorkbenchContribution, IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from '../../../common/contributions.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { Action2, MenuId, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { IFileDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { ILayoutService } from '../../../../platform/layout/browser/layoutService.js';
import { IHostService } from '../../../services/host/browser/host.js';
import { kuundaProjectLocalize, kuundaProjectLocalize2, KUUNDA_PROJECT_STRINGS, type KuundaProjectStringKey } from '../common/kuundaProjectNls.js';
import { IKuundaProjectService } from '../common/kuundaProjectService.js';
import { isProjectType, publishOptionFromTargets, sanitizeProjectName, type MobilePublishOption, type ProjectType } from '../common/projectType.js';
import { IKuundaCloudService } from '../../kuundaCloud/common/kuundaCloudService.js';
import { kuundaCloudLocalize } from '../../kuundaCloud/common/kuundaCloudNls.js';
import { IKuundaPublishService } from '../../kuundaPublish/common/kuundaPublishService.js';
import { pickProjectTypeCard, pickPublishOptionCard } from './kuundaProjectCards.js';

class KuundaProjectContribution implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.kuundaProject';

	constructor() {
		kuundaProjectLocalize('kuunda.project.tagline');
	}
}

async function runCreateWizard(accessor: ServicesAccessor, presetType?: ProjectType): Promise<void> {
	const project = accessor.get(IKuundaProjectService);
	const quick = accessor.get(IQuickInputService);
	const notify = accessor.get(INotificationService);
	const fileDialog = accessor.get(IFileDialogService);
	const host = accessor.get(IHostService);
	const layout = accessor.get(ILayoutService);
	const type = presetType ?? await pickProjectTypeCard(layout);
	if (!type) {
		notify.info(kuundaProjectLocalize('kuunda.project.create.cancelled'));
		return;
	}
	let publishOption: MobilePublishOption | undefined;
	if (type === 'mobile') {
		publishOption = await pickPublishOptionCard(layout);
		if (!publishOption) {
			notify.info(kuundaProjectLocalize('kuunda.project.create.cancelled'));
			return;
		}
	}
	const name = await quick.input({
		prompt: kuundaProjectLocalize('kuunda.project.create.name'),
		ignoreFocusLost: true,
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

	async run(accessor: ServicesAccessor, type?: unknown): Promise<void> {
		await runCreateWizard(accessor, isProjectType(type) ? type : undefined);
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
