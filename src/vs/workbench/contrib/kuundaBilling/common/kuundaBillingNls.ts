/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import { getNLSLanguage, localize, type ILocalizedString } from '../../../../nls.js';
import { classifyPaymentFailure } from './creditPolicy.js';

export const KUUNDA_BILLING_STRINGS = {
	'kuunda.billing.tagline': {
		en: 'Credits, plans, and checkout via a payment aggregator — no payment credentials in the IDE.',
		fr: 'Crédits, plans et paiement via un agrégateur — aucun identifiant de paiement dans l’IDE.',
	},
	'kuunda.billing.setUser': {
		en: 'Kuunda Vibe: Set Credits Account Id',
		fr: 'Kuunda Vibe : définir l’identifiant du compte crédits',
	},
	'kuunda.billing.setUser.prompt': {
		en: 'Account id for Kuunda credits (never a payment credential)',
		fr: 'Identifiant de compte crédits Kuunda (jamais un identifiant de paiement)',
	},
	'kuunda.billing.refresh': {
		en: 'Kuunda Vibe: Refresh Credits',
		fr: 'Kuunda Vibe : actualiser les crédits',
	},
	'kuunda.billing.plans': {
		en: 'Kuunda Vibe: Open Credits & Plans',
		fr: 'Kuunda Vibe : ouvrir crédits et plans',
	},
	'kuunda.billing.statusbar': {
		en: 'Kuunda: {0} credits',
		fr: 'Kuunda : {0} crédits',
	},
	'kuunda.billing.statusbar.unset': {
		en: 'Kuunda: credits',
		fr: 'Kuunda : crédits',
	},
	'kuunda.billing.alert.low': {
		en: 'Your Kuunda credit quota is running low. Open plans to top up or change plan.',
		fr: 'Votre quota de crédits Kuunda est presque épuisé. Ouvrez les plans pour recharger ou changer d’offre.',
	},
	'kuunda.billing.alert.empty': {
		en: 'No Kuunda credits left. Top up or change plan to keep using the agent.',
		fr: 'Plus de crédits Kuunda. Rechargez ou changez de plan pour continuer à utiliser l’agent.',
	},
	'kuunda.billing.pay.insufficient_funds': {
		en: 'Payment failed: insufficient Mobile Money balance.',
		fr: 'Paiement échoué : solde Mobile Money insuffisant.',
	},
	'kuunda.billing.pay.timeout': {
		en: 'Payment failed: the provider timed out. Try again.',
		fr: 'Paiement échoué : le fournisseur a expiré. Réessayez.',
	},
	'kuunda.billing.pay.declined': {
		en: 'Payment failed: the transaction was declined.',
		fr: 'Paiement échoué : la transaction a été refusée.',
	},
	'kuunda.billing.pay.canceled': {
		en: 'Payment canceled.',
		fr: 'Paiement annulé.',
	},
	'kuunda.billing.pay.unknown': {
		en: 'Payment failed. No payment credentials were stored in the IDE.',
		fr: 'Paiement échoué. Aucun identifiant de paiement n’a été stocké dans l’IDE.',
	},
	'kuunda.billing.checkout': {
		en: 'Kuunda Vibe: Top Up or Change Plan',
		fr: 'Kuunda Vibe : recharger ou changer de plan',
	},
	'kuunda.billing.checkout.needUser': {
		en: 'Set a credits account id before checkout. No payment credentials are stored in the IDE.',
		fr: 'Définissez un identifiant de compte crédits avant le paiement. Aucun identifiant de paiement n’est stocké dans l’IDE.',
	},
	'kuunda.billing.checkout.unavailable': {
		en: 'Checkout is unavailable. Open plans from the account page, or try again later.',
		fr: 'Paiement indisponible. Ouvrez les plans depuis la page compte, ou réessayez plus tard.',
	},
	'kuunda.billing.network.timeout': {
		en: 'Kuunda platform timed out. Credits will refresh when the network is back.',
		fr: 'La plateforme Kuunda a expiré. Les crédits se mettront à jour quand le réseau reviendra.',
	},
	'kuunda.billing.network.offline': {
		en: 'Kuunda platform is unreachable. Credits will refresh when you are back online.',
		fr: 'La plateforme Kuunda est injoignable. Les crédits se mettront à jour quand vous serez de nouveau en ligne.',
	},
} as const;

export type KuundaBillingStringKey = keyof typeof KUUNDA_BILLING_STRINGS;

function isFrench(language: string | undefined): boolean {
	return typeof language === 'string' && (language === 'fr' || language.startsWith('fr-') || language.startsWith('fr_'));
}

export function kuundaBillingLocalize(key: KuundaBillingStringKey, ...args: Array<string | number>): string {
	const entry = KUUNDA_BILLING_STRINGS[key];
	const message = isFrench(getNLSLanguage()) ? entry.fr : entry.en;
	return localize(key, message, ...args);
}

export function kuundaBillingLocalize2(key: KuundaBillingStringKey): ILocalizedString {
	return { original: KUUNDA_BILLING_STRINGS[key].en, value: kuundaBillingLocalize(key) };
}

const PAY_KEYS = {
	insufficient_funds: 'kuunda.billing.pay.insufficient_funds',
	timeout: 'kuunda.billing.pay.timeout',
	declined: 'kuunda.billing.pay.declined',
	canceled: 'kuunda.billing.pay.canceled',
	unknown: 'kuunda.billing.pay.unknown',
} as const;

export function paymentFailureMessage(code: string | undefined): string {
	return kuundaBillingLocalize(PAY_KEYS[classifyPaymentFailure(code)]);
}
