/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import { getNLSLanguage, type ILocalizedString } from '../../../../nls.js';

/**
 * Keep in lockstep with strings.json (enforced by test/branding.test.mjs).
 * JSON is not imported here: the VS Code gulp/AMD pipeline does not load .json modules from src/vs.
 */
export const KUUNDA_STRINGS = {
	'kuunda.about.attribution': {
		en: 'Kuunda Vibe is a fork of Void (Glass Devtools) and Code - OSS (Microsoft). Steward: Arowtech.',
		fr: 'Kuunda Vibe est un fork de Void (Glass Devtools) et de Code - OSS (Microsoft). Steward : Arowtech.',
	},
	'kuunda.product.tagline': {
		en: 'The Kuunda desktop IDE. Default language: English.',
		fr: "L'IDE desktop Kuunda. Langue par défaut : anglais.",
	},
	'kuunda.settings.title': {
		en: 'Kuunda Vibe Settings',
		fr: 'Paramètres Kuunda Vibe',
	},
	'kuunda.settings.pane': {
		en: 'Kuunda Vibe Settings Pane',
		fr: 'Panneau des paramètres Kuunda Vibe',
	},
	'kuunda.settings.openMenu': {
		en: '&&Open Kuunda Vibe Settings',
		fr: '&&Ouvrir les paramètres Kuunda Vibe',
	},
	'kuunda.settings.toggle': {
		en: 'Kuunda Vibe: Toggle Settings',
		fr: 'Kuunda Vibe : afficher ou masquer les paramètres',
	},
	'kuunda.settings.openCommand': {
		en: 'Kuunda Vibe: Open Settings',
		fr: 'Kuunda Vibe : ouvrir les paramètres',
	},
	'kuunda.sidebar.auxiliary': {
		en: 'Kuunda Vibe Side Bar',
		fr: 'Barre latérale Kuunda Vibe',
	},
} as const;

export type KuundaStringKey = keyof typeof KUUNDA_STRINGS;

function isFrench(language: string | undefined): boolean {
	return typeof language === 'string' && (language === 'fr' || language.startsWith('fr-') || language.startsWith('fr_'));
}

export function formatKuundaMessage(message: string, args: ReadonlyArray<string | number> = []): string {
	if (args.length === 0) {
		return message;
	}
	return message.replace(/\{(\d+)\}/g, (whole, index) => {
		const value = args[Number(index)];
		return value === undefined ? whole : String(value);
	});
}

export function resolveKuundaString(key: KuundaStringKey, language: string | undefined = getNLSLanguage()): string {
	const entry = KUUNDA_STRINGS[key];
	return isFrench(language) ? entry.fr : entry.en;
}

export function kuundaLocalize(key: KuundaStringKey, ...args: Array<string | number>): string {
	return formatKuundaMessage(resolveKuundaString(key), args);
}

export function kuundaLocalize2(key: KuundaStringKey): ILocalizedString {
	return {
		original: KUUNDA_STRINGS[key].en,
		value: resolveKuundaString(key),
	};
}
