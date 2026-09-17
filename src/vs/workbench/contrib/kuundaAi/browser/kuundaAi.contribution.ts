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
import { kuundaAiLocalize, kuundaAiLocalize2 } from '../common/kuundaAiNls.js';
import { IKuundaCodebaseService } from '../common/kuundaCodebaseService.js';
import { IKuundaAgentService } from '../common/kuundaAgentService.js';
import { IChatThreadService } from '../../void/browser/chatThreadService.js';
import { PERMISSION_LEVELS, type PermissionLevel } from '../common/permissionPolicy.js';

class KuundaAiContribution implements IWorkbenchContribution {
	static readonly ID = 'workbench.contrib.kuundaAi';

	constructor() {
		kuundaAiLocalize('kuunda.ai.tagline');
		kuundaAiLocalize('kuunda.agent.tagline');
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

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.agent.runBackground',
			f1: true,
			title: kuundaAiLocalize2('kuunda.agent.background'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const quick = accessor.get(IQuickInputService);
		const notify = accessor.get(INotificationService);
		const chat = accessor.get(IChatThreadService);
		const agent = accessor.get(IKuundaAgentService);
		const prompt = await quick.input({
			prompt: kuundaAiLocalize('kuunda.agent.background.prompt'),
		});
		if (!prompt || !prompt.trim()) {
			notify.info(kuundaAiLocalize('kuunda.agent.background.empty'));
			return;
		}

		const previousId = chat.getCurrentThread().id;
		chat.openNewThread();
		const threadId = chat.getCurrentThread().id;
		const job = agent.enqueue(prompt.trim(), threadId);
		agent.markRunning(job.id);
		await chat.addUserMessageAndStreamResponse({ userMessage: prompt.trim(), threadId });
		if (previousId && previousId !== threadId) {
			chat.switchToThread(previousId);
		}
		notify.info(kuundaAiLocalize('kuunda.agent.background.started'));
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.agent.setPermission',
			f1: true,
			title: kuundaAiLocalize2('kuunda.agent.setPermission'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const quick = accessor.get(IQuickInputService);
		const notify = accessor.get(INotificationService);
		const agent = accessor.get(IKuundaAgentService);
		const tool = await quick.pick(
			agent.listPermissionTools().map((id) => ({ label: id, id })),
			{ placeHolder: kuundaAiLocalize('kuunda.agent.setPermission.tool') },
		);
		if (!tool?.id) {
			return;
		}
		const levelPick = await quick.pick(
			PERMISSION_LEVELS.map((id) => ({ label: id, id })),
			{ placeHolder: kuundaAiLocalize('kuunda.agent.setPermission.level') },
		);
		if (!levelPick?.id) {
			return;
		}
		agent.setToolPermission(tool.id, levelPick.id as PermissionLevel);
		notify.info(`${tool.id}: ${levelPick.id}`);
	}
});

registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kuunda.agent.reviewJobs',
			f1: true,
			title: kuundaAiLocalize2('kuunda.agent.reviewJobs'),
		});
	}

	async run(accessor: ServicesAccessor): Promise<void> {
		const quick = accessor.get(IQuickInputService);
		const notify = accessor.get(INotificationService);
		const chat = accessor.get(IChatThreadService);
		const agent = accessor.get(IKuundaAgentService);
		const jobs = agent.listJobs().filter((job) => job.status === 'needs_review');
		if (jobs.length === 0) {
			notify.info(kuundaAiLocalize('kuunda.agent.reviewJobs.empty'));
			return;
		}
		let job = jobs[0];
		if (jobs.length > 1) {
			const picked = await quick.pick(
				jobs.map((item) => ({
					id: item.id,
					label: item.prompt.slice(0, 80),
					description: `${item.changedPaths.length} file(s)`,
				})),
				{ placeHolder: kuundaAiLocalize('kuunda.agent.reviewJobs') },
			);
			job = picked?.id ? agent.getJob(picked.id) : undefined;
		}
		if (!job?.threadId) {
			return;
		}
		chat.switchToThread(job.threadId);
		agent.review(job.id);
	}
});

Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(
	KuundaAiContribution,
	LifecyclePhase.Eventually
);
