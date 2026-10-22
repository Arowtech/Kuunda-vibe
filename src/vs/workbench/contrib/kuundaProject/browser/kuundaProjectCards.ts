/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import { $, addDisposableListener, append, getActiveDocument } from '../../../../base/browser/dom.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { ILayoutService } from '../../../../platform/layout/browser/layoutService.js';
import { kuundaProjectLocalize, type KuundaProjectStringKey } from '../common/kuundaProjectNls.js';
import { MOBILE_PUBLISH_OPTIONS, PROJECT_TYPES, type MobilePublishOption, type ProjectType } from '../common/projectType.js';

type CardSpec<T extends string> = {
	id: T;
	icon: ThemeIcon;
	titleKey: KuundaProjectStringKey;
	detailKey: KuundaProjectStringKey;
};

const TYPE_CARDS: readonly CardSpec<ProjectType>[] = [
	{ id: 'website', icon: Codicon.globe, titleKey: 'kuunda.project.create.type.website', detailKey: 'kuunda.project.create.type.website.detail' },
	{ id: 'webapp', icon: Codicon.window, titleKey: 'kuunda.project.create.type.webapp', detailKey: 'kuunda.project.create.type.webapp.detail' },
	{ id: 'mobile', icon: Codicon.deviceMobile, titleKey: 'kuunda.project.create.type.mobile', detailKey: 'kuunda.project.create.type.mobile.detail' },
	{ id: 'other', icon: Codicon.tools, titleKey: 'kuunda.project.create.type.other', detailKey: 'kuunda.project.create.type.other.detail' },
];

const PUBLISH_CARDS: readonly CardSpec<MobilePublishOption>[] = [
	{ id: 'google_play', icon: Codicon.playCircle, titleKey: 'kuunda.project.create.publish.google_play', detailKey: 'kuunda.project.create.publish.google_play.detail' },
	{ id: 'app_store', icon: Codicon.deviceMobile, titleKey: 'kuunda.project.create.publish.app_store', detailKey: 'kuunda.project.create.publish.app_store.detail' },
	{ id: 'both', icon: Codicon.cloudUpload, titleKey: 'kuunda.project.create.publish.both', detailKey: 'kuunda.project.create.publish.both.detail' },
	{ id: 'none', icon: Codicon.circleSlash, titleKey: 'kuunda.project.create.publish.none', detailKey: 'kuunda.project.create.publish.none.detail' },
];

if (TYPE_CARDS.length !== PROJECT_TYPES.length || PUBLISH_CARDS.length !== MOBILE_PUBLISH_OPTIONS.length) {
	throw new Error('Kuunda project cards are out of sync with project types');
}

export function appendKuundaHomeProjectCards(parent: HTMLElement, commandService: ICommandService): void {
	const wrap = append(parent, $('div.kuunda-project-home'));
	append(wrap, $('div.kuunda-project-home-title', {}, kuundaProjectLocalize('kuunda.project.create.cards.title')));
	append(wrap, $('div.kuunda-project-home-subtitle', {}, kuundaProjectLocalize('kuunda.project.create.cards.subtitle')));
	const grid = append(wrap, $('div.kuunda-project-grid'));
	for (const spec of TYPE_CARDS) {
		grid.appendChild(createCardButton(spec, () => {
			void commandService.executeCommand('kuunda.project.create', spec.id);
		}));
	}
}

export function pickProjectTypeCard(layout: ILayoutService): Promise<ProjectType | undefined> {
	return pickCard(layout, kuundaProjectLocalize('kuunda.project.create.cards.title'), TYPE_CARDS);
}

export function pickPublishOptionCard(layout: ILayoutService): Promise<MobilePublishOption | undefined> {
	return pickCard(layout, kuundaProjectLocalize('kuunda.project.create.publish.cards.title'), PUBLISH_CARDS);
}

function pickCard<T extends string>(layout: ILayoutService, title: string, specs: readonly CardSpec<T>[]): Promise<T | undefined> {
	return new Promise((resolve) => {
		const store = new DisposableStore();
		const overlay = $('div.kuunda-project-overlay');
		overlay.setAttribute('role', 'dialog');
		overlay.setAttribute('aria-modal', 'true');
		overlay.setAttribute('aria-label', title);

		const dialog = append(overlay, $('div.kuunda-project-dialog'));
		append(dialog, $('div.kuunda-project-dialog-title', {}, title));
		append(dialog, $('div.kuunda-project-dialog-subtitle', {}, kuundaProjectLocalize('kuunda.project.create.cards.subtitle')));
		const grid = append(dialog, $('div.kuunda-project-grid'));
		const buttons: HTMLButtonElement[] = [];

		const finish = (value: T | undefined) => {
			store.dispose();
			overlay.remove();
			resolve(value);
		};

		for (const spec of specs) {
			const button = createCardButton(spec, () => finish(spec.id));
			grid.appendChild(button);
			buttons.push(button);
		}

		const actions = append(dialog, $('div.kuunda-project-dialog-actions'));
		const cancel = append(actions, $('button.kuunda-project-cancel')) as HTMLButtonElement;
		cancel.type = 'button';
		cancel.textContent = kuundaProjectLocalize('kuunda.project.create.cards.cancel');
		store.add(addDisposableListener(cancel, 'click', () => finish(undefined)));
		store.add(addDisposableListener(overlay, 'click', (e) => {
			if (e.target === overlay) {
				finish(undefined);
			}
		}));
		store.add(addDisposableListener(overlay, 'keydown', (e) => {
			if (e.key === 'Escape') {
				e.preventDefault();
				finish(undefined);
				return;
			}
			const current = buttons.indexOf(getActiveDocument().activeElement as HTMLButtonElement);
			if (current < 0) {
				return;
			}
			const columns = 2;
			let next = current;
			if (e.key === 'ArrowRight') {
				next = (current + 1) % buttons.length;
			} else if (e.key === 'ArrowLeft') {
				next = (current - 1 + buttons.length) % buttons.length;
			} else if (e.key === 'ArrowDown') {
				next = (current + columns) % buttons.length;
			} else if (e.key === 'ArrowUp') {
				next = (current - columns + buttons.length) % buttons.length;
			} else {
				return;
			}
			e.preventDefault();
			buttons[next].focus();
		}));

		layout.activeContainer.appendChild(overlay);
		buttons[0]?.focus();
	});
}

function createCardButton<T extends string>(spec: CardSpec<T>, onPick: () => void): HTMLButtonElement {
	const button = $<HTMLButtonElement>('button.kuunda-project-card');
	button.type = 'button';
	button.setAttribute('data-kuunda-project-type', spec.id);
	const icon = append(button, $('span.kuunda-project-card-icon'));
	icon.classList.add(...ThemeIcon.asClassNameArray(spec.icon));
	append(button, $('span.kuunda-project-card-title', {}, kuundaProjectLocalize(spec.titleKey)));
	append(button, $('span.kuunda-project-card-detail', {}, kuundaProjectLocalize(spec.detailKey)));
	button.onclick = onPick;
	return button;
}
