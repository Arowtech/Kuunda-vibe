/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import { $, addDisposableListener, append, clearNode } from '../../../../base/browser/dom.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { URI } from '../../../../base/common/uri.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { ILayoutService } from '../../../../platform/layout/browser/layoutService.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IKuundaBillingService } from '../../kuundaBilling/common/kuundaBillingService.js';
import { kuundaAccountErrorMessage, kuundaAccountLocalize, type KuundaAccountStringKey } from '../common/kuundaAccountNls.js';
import { DEFAULT_CLOUD_APP_URL, parseStudioOpenIntent, type OAuthProvider, type StudioOpenIntent } from '../common/accountPolicy.js';
import { IKuundaAccountService } from '../common/kuundaAccountService.js';

type StudioTab = 'identity' | 'credits' | 'usage' | 'devices' | 'cloud' | 'security';

let activeStudio: { close(): void } | undefined;

const TABS: Array<{ id: StudioTab; key: KuundaAccountStringKey }> = [
	{ id: 'identity', key: 'kuunda.account.tab.identity' },
	{ id: 'credits', key: 'kuunda.account.tab.credits' },
	{ id: 'usage', key: 'kuunda.account.tab.usage' },
	{ id: 'devices', key: 'kuunda.account.tab.devices' },
	{ id: 'cloud', key: 'kuunda.account.tab.cloud' },
	{ id: 'security', key: 'kuunda.account.tab.security' },
];

export function appendKuundaHomeAccountCta(parent: HTMLElement, commandService: ICommandService): void {
	const wrap = append(parent, $('div.kuunda-account-home'));
	const button = append(wrap, $('button.kuunda-account-home-cta')) as HTMLButtonElement;
	button.type = 'button';
	append(button, $('strong', {}, kuundaAccountLocalize('kuunda.account.home.cta')));
	append(button, $('span', {}, kuundaAccountLocalize('kuunda.account.home.cta.detail')));
	button.onclick = () => {
		void commandService.executeCommand('kuunda.account.openStudio');
	};
}

export function openKuundaAccountStudio(
	layout: ILayoutService,
	account: IKuundaAccountService,
	billing: IKuundaBillingService,
	opener: IOpenerService,
	options?: unknown,
): void {
	activeStudio?.close();

	const store = new DisposableStore();
	const content = new DisposableStore();
	store.add(content);
	const overlay = $('div.kuunda-account-overlay');
	overlay.setAttribute('role', 'dialog');
	overlay.setAttribute('aria-modal', 'true');
	overlay.setAttribute('aria-label', kuundaAccountLocalize('kuunda.account.studio.title'));
	const dialog = append(overlay, $('div.kuunda-account-dialog'));

	const openIntent: StudioOpenIntent = parseStudioOpenIntent(options);
	let tab: StudioTab = openIntent.reason === 'cloud' ? 'cloud' : 'identity';
	let signingUp = openIntent.intent === 'signUp';
	let busy = false;
	let error = '';
	let deviceCode = '';
	let userCode = '';
	let pollTimer: ReturnType<typeof setInterval> | undefined;

	const stopPoll = () => {
		if (pollTimer) {
			clearInterval(pollTimer);
			pollTimer = undefined;
		}
	};

	const close = () => {
		if (activeStudio?.close === close) {
			activeStudio = undefined;
		}
		stopPoll();
		store.dispose();
		overlay.remove();
	};
	activeStudio = { close };

	const setBusy = (value: boolean) => {
		busy = value;
		void render();
	};

	const fail = (code: string) => {
		error = kuundaAccountErrorMessage(code as Parameters<typeof kuundaAccountErrorMessage>[0]);
		busy = false;
		void render();
	};

	async function render(): Promise<void> {
		content.clear();
		clearNode(dialog);
		const header = append(dialog, $('div.kuunda-account-header'));
		const titles = append(header, $('div'));
		append(titles, $('div.kuunda-account-kicker', {}, 'KUUNDA'));
		append(titles, $('div.kuunda-account-title', {}, kuundaAccountLocalize('kuunda.account.studio.title')));
		append(titles, $('div.kuunda-account-subtitle', {}, kuundaAccountLocalize('kuunda.account.studio.subtitle')));
		const closeBtn = append(header, $('button.kuunda-account-close')) as HTMLButtonElement;
		closeBtn.type = 'button';
		closeBtn.textContent = kuundaAccountLocalize('kuunda.account.studio.close');
		content.add(addDisposableListener(closeBtn, 'click', close));

		const profile = account.getSession();
		if (!profile) {
			renderSignedOut(dialog);
			return;
		}
		renderSignedIn(dialog, profile);
	}

	function renderSignedOut(root: HTMLElement): void {
		const grid = append(root, $('div.kuunda-account-signed-out'));
		const story = append(grid, $('div'));
		append(story, $('h2', {}, kuundaAccountLocalize(openIntent.reason === 'cloud' ? 'kuunda.account.signedOut.cloud.title' : 'kuunda.account.signedOut.title')));
		append(story, $('p', {}, kuundaAccountLocalize(openIntent.reason === 'cloud' ? 'kuunda.account.signedOut.cloud.body' : 'kuunda.account.signedOut.body')));
		append(story, $('div.kuunda-account-hint', {}, kuundaAccountLocalize('kuunda.account.device.body')));
		const pair = append(story, $('button.kuunda-account-btn.ghost')) as HTMLButtonElement;
		pair.type = 'button';
		pair.textContent = userCode ? `${kuundaAccountLocalize('kuunda.account.device.waiting')} ${userCode}` : kuundaAccountLocalize('kuunda.account.device.start');
		pair.disabled = busy;
		content.add(addDisposableListener(pair, 'click', () => void startDevice()));
		if (userCode) {
			append(story, $('div.kuunda-account-code', {}, userCode));
		}

		const form = append(grid, $('div.kuunda-account-card'));
		if (signingUp) {
			addField(form, 'displayName', kuundaAccountLocalize('kuunda.account.displayName'), 'text');
		}
		addField(form, 'email', kuundaAccountLocalize('kuunda.account.email'), 'email');
		addField(form, 'password', kuundaAccountLocalize('kuunda.account.password'), 'password');
		append(form, $('div.kuunda-account-hint', {}, kuundaAccountLocalize('kuunda.account.password.hint')));
		if (error) {
			append(form, $('div.kuunda-account-error', {}, error));
		}
		const submit = append(form, $('button.kuunda-account-btn.primary')) as HTMLButtonElement;
		submit.type = 'button';
		submit.disabled = busy;
		submit.textContent = busy ? kuundaAccountLocalize('kuunda.account.busy') : kuundaAccountLocalize(signingUp ? 'kuunda.account.signUp' : 'kuunda.account.signIn');
		content.add(addDisposableListener(submit, 'click', () => void submitEmail(form)));
		const toggle = append(form, $('button.kuunda-account-btn.ghost')) as HTMLButtonElement;
		toggle.type = 'button';
		toggle.textContent = kuundaAccountLocalize(signingUp ? 'kuunda.account.toggleSignIn' : 'kuunda.account.toggleSignUp');
		content.add(addDisposableListener(toggle, 'click', () => {
			signingUp = !signingUp;
			error = '';
			void render();
		}));
		append(form, $('div.kuunda-account-hint', {}, kuundaAccountLocalize('kuunda.account.oauth.hint')));
		const oauth = append(form, $('div.kuunda-account-oauth'));
		for (const provider of ['google', 'github', 'apple'] as OAuthProvider[]) {
			const button = append(oauth, $('button.kuunda-account-btn.oauth')) as HTMLButtonElement;
			button.type = 'button';
			button.disabled = busy;
			button.textContent = kuundaAccountLocalize(`kuunda.account.oauth.${provider}`);
			content.add(addDisposableListener(button, 'click', () => void startOAuth(provider)));
		}
	}

	function renderSignedIn(root: HTMLElement, profile: NonNullable<ReturnType<IKuundaAccountService['getSession']>>): void {
		const layoutEl = append(root, $('div.kuunda-account-layout'));
		const rail = append(layoutEl, $('nav.kuunda-account-rail'));
		for (const spec of TABS) {
			const button = append(rail, $('button')) as HTMLButtonElement;
			button.type = 'button';
			button.textContent = kuundaAccountLocalize(spec.key);
			if (spec.id === tab) {
				button.classList.add('active');
			}
			content.add(addDisposableListener(button, 'click', () => {
				tab = spec.id;
				void render();
			}));
		}
		const pane = append(layoutEl, $('div'));
		if (tab === 'identity') {
			const card = append(pane, $('div.kuunda-account-card'));
			append(card, $('h3', {}, profile.displayName || profile.email));
			append(card, $('p', {}, profile.email));
			if (profile.orgName) {
				append(card, $('p', {}, kuundaAccountLocalize('kuunda.account.identity.org', profile.orgName)));
			}
			append(card, $('span.kuunda-account-badge', {}, kuundaAccountLocalize('kuunda.account.identity.plan', profile.planId || profile.orgPlan || 'free')));
			append(card, $('p', {}, kuundaAccountLocalize(profile.emailVerified ? 'kuunda.account.identity.verified' : 'kuunda.account.identity.unverified')));
		} else if (tab === 'credits') {
			void renderCredits(pane);
		} else if (tab === 'usage') {
			void renderUsage(pane);
		} else if (tab === 'devices') {
			void renderDevices(pane);
		} else if (tab === 'cloud') {
			const card = append(pane, $('div.kuunda-account-card'));
			append(card, $('p', {}, kuundaAccountLocalize('kuunda.account.cloud.body')));
			if (profile.projectCount !== undefined) {
				append(card, $('p', {}, String(profile.projectCount)));
			}
			const openCloud = append(card, $('button.kuunda-account-btn.primary')) as HTMLButtonElement;
			openCloud.type = 'button';
			openCloud.textContent = kuundaAccountLocalize('kuunda.account.cloud.open');
			content.add(addDisposableListener(openCloud, 'click', () => void opener.open(URI.parse(DEFAULT_CLOUD_APP_URL), { openExternal: true })));
		} else {
			const card = append(pane, $('div.kuunda-account-card'));
			append(card, $('h3', {}, kuundaAccountLocalize('kuunda.account.security.providers')));
			append(card, $('p', {}, (profile.providers.length ? profile.providers : ['email']).join(' · ')));
			const handoff = append(card, $('button.kuunda-account-btn.primary')) as HTMLButtonElement;
			handoff.type = 'button';
			handoff.textContent = kuundaAccountLocalize('kuunda.account.security.handoff');
			content.add(addDisposableListener(handoff, 'click', () => void doHandoff()));
			const out = append(card, $('button.kuunda-account-btn.ghost')) as HTMLButtonElement;
			out.type = 'button';
			out.textContent = kuundaAccountLocalize('kuunda.account.signOut');
			content.add(addDisposableListener(out, 'click', () => void account.signOut(false).then(() => render())));
			const everywhere = append(card, $('button.kuunda-account-btn.ghost')) as HTMLButtonElement;
			everywhere.type = 'button';
			everywhere.textContent = kuundaAccountLocalize('kuunda.account.signOutEverywhere');
			content.add(addDisposableListener(everywhere, 'click', () => void account.signOut(true).then(() => render())));
		}
	}

	async function renderCredits(pane: HTMLElement): Promise<void> {
		const card = append(pane, $('div.kuunda-account-card'));
		const balance = billing.lastBalance() ?? await billing.getBalance();
		if (!balance) {
			append(card, $('p', {}, kuundaAccountLocalize('kuunda.account.credits.empty')));
			return;
		}
		append(card, $('h3', {}, `${balance.remaining} / ${balance.includedQuota}`));
		const ratio = balance.includedQuota > 0 ? Math.min(1, balance.remaining / balance.includedQuota) : 0;
		const meter = append(card, $('div.kuunda-account-meter'));
		const fill = append(meter, $('span'));
		fill.style.width = `${Math.round(ratio * 100)}%`;
		const actions = append(card, $('div.kuunda-account-actions'));
		addCommandButton(actions, kuundaAccountLocalize('kuunda.account.credits.openPlans'), () => void opener.open(URI.parse(billing.accountUrl), { openExternal: true }));
		addCommandButton(actions, kuundaAccountLocalize('kuunda.account.credits.topup'), () => void commandCheckout());
	}

	async function renderUsage(pane: HTMLElement): Promise<void> {
		const card = append(pane, $('div.kuunda-account-card'));
		const usage = await account.loadUsage();
		if (!usage || (usage.breakdown.length === 0 && usage.credits.used === 0)) {
			append(card, $('p', {}, kuundaAccountLocalize('kuunda.account.usage.empty')));
			return;
		}
		for (const row of usage.breakdown) {
			const labelKey = row.feature === 'agent' || row.feature === 'tab' || row.feature === 'publish'
				? `kuunda.account.usage.${row.feature}` as KuundaAccountStringKey
				: 'kuunda.account.usage.empty';
			const line = append(card, $('div.kuunda-account-row'));
			append(line, $('span', {}, row.feature === 'other' ? row.feature : kuundaAccountLocalize(labelKey)));
			append(line, $('strong', {}, String(row.amount)));
		}
	}

	async function renderDevices(pane: HTMLElement): Promise<void> {
		const card = append(pane, $('div.kuunda-account-card'));
		const sessions = await account.listSessions();
		if (sessions.length === 0) {
			append(card, $('p', {}, kuundaAccountLocalize('kuunda.account.devices.empty')));
			append(card, $('p', {}, kuundaAccountLocalize('kuunda.account.devices.thisDevice')));
			return;
		}
		for (const session of sessions) {
			const row = append(card, $('div.kuunda-account-row'));
			append(row, $('span', {}, session.current ? `${session.label} · ${kuundaAccountLocalize('kuunda.account.devices.thisDevice')}` : session.label));
			if (!session.current) {
				const revoke = append(row, $('button.kuunda-account-btn.ghost')) as HTMLButtonElement;
				revoke.type = 'button';
				revoke.textContent = kuundaAccountLocalize('kuunda.account.devices.revoke');
				content.add(addDisposableListener(revoke, 'click', () => void account.revokeSession(session.id).then(() => render())));
			}
		}
	}

	function addField(form: HTMLElement, name: string, label: string, type: string): void {
		const field = append(form, $('div.kuunda-account-field'));
		append(field, $('label', {}, label));
		const input = append(field, $('input')) as HTMLInputElement;
		input.type = type;
		input.name = name;
		input.autocomplete = type === 'password' ? 'current-password' : name;
	}

	function addCommandButton(parent: HTMLElement, label: string, onClick: () => void): void {
		const button = append(parent, $('button.kuunda-account-btn.ghost')) as HTMLButtonElement;
		button.type = 'button';
		button.textContent = label;
		content.add(addDisposableListener(button, 'click', onClick));
	}

	function readForm(form: HTMLElement): { email: string; password: string; displayName: string } {
		const email = (form.querySelector('input[name="email"]') as HTMLInputElement | null)?.value ?? '';
		const password = (form.querySelector('input[name="password"]') as HTMLInputElement | null)?.value ?? '';
		const displayName = (form.querySelector('input[name="displayName"]') as HTMLInputElement | null)?.value ?? '';
		return { email, password, displayName };
	}

	async function submitEmail(form: HTMLElement): Promise<void> {
		error = '';
		setBusy(true);
		const values = readForm(form);
		const result = signingUp
			? await account.signUpEmail(values.email, values.password, values.displayName)
			: await account.signInEmail(values.email, values.password);
		if (!result.ok) {
			fail(result.error);
			return;
		}
		busy = false;
		void render();
	}

	async function startOAuth(provider: OAuthProvider): Promise<void> {
		error = '';
		setBusy(true);
		const result = await account.startOAuth(provider);
		if (!result.ok) {
			fail(result.error);
			return;
		}
		if ('authorizationUrl' in result) {
			await opener.open(URI.parse(result.authorizationUrl), { openExternal: true });
		}
		busy = false;
		void render();
	}

	async function startDevice(): Promise<void> {
		error = '';
		setBusy(true);
		const result = await account.startDevicePairing();
		if (!result.ok) {
			fail(result.error);
			return;
		}
		deviceCode = result.device.deviceCode;
		userCode = result.device.userCode;
		busy = false;
		void opener.open(URI.parse(result.device.verificationUrl), { openExternal: true });
		stopPoll();
		pollTimer = setInterval(() => {
			void account.pollDevicePairing(deviceCode).then((poll) => {
				if ('pending' in poll && poll.ok) {
					return;
				}
				if (poll.ok) {
					stopPoll();
					void render();
					return;
				}
				stopPoll();
				fail(poll.error);
			});
		}, Math.max(3, result.device.interval) * 1000);
		void render();
	}

	async function doHandoff(): Promise<void> {
		const result = await account.createWebHandoff();
		if (!result.ok) {
			fail(result.error);
			return;
		}
		await opener.open(URI.parse(result.url), { openExternal: true });
		error = kuundaAccountLocalize('kuunda.account.security.handoff.done');
		void render();
	}

	async function commandCheckout(): Promise<void> {
		const plans = await billing.listPlans();
		const paid = plans.find((plan) => (plan.price?.amount ?? 0) > 0);
		if (!paid) {
			await opener.open(URI.parse(billing.accountUrl), { openExternal: true });
			return;
		}
		const checkout = await billing.startCheckout(paid.id);
		if (checkout?.checkoutUrl) {
			await opener.open(URI.parse(checkout.checkoutUrl), { openExternal: true });
		}
	}

	store.add(account.onDidChangeSession(() => void render()));
	store.add(addDisposableListener(overlay, 'click', (e) => {
		if (e.target === overlay) {
			close();
		}
	}));
	store.add(addDisposableListener(overlay, 'keydown', (e) => {
		if (e.key === 'Escape') {
			e.preventDefault();
			close();
		}
	}));

	layout.activeContainer.appendChild(overlay);
	void render();
}
