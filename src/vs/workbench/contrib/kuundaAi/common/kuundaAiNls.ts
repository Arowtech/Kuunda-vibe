/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import { getNLSLanguage, localize, type ILocalizedString } from '../../../../nls.js';

export const KUUNDA_AI_STRINGS = {
	'kuunda.ai.tagline': {
		en: 'Code completion, inline edit, codebase chat, and streaming diffs.',
		fr: 'Complétion de code, édition inline, chat codebase et diffs en flux.',
	},
	'kuunda.ai.reindex': {
		en: 'Kuunda Vibe: Reindex Codebase',
		fr: 'Kuunda Vibe : réindexer le codebase',
	},
} as const;

export type KuundaAiStringKey = keyof typeof KUUNDA_AI_STRINGS;

function isFrench(language: string | undefined): boolean {
	return typeof language === 'string' && (language === 'fr' || language.startsWith('fr-') || language.startsWith('fr_'));
}

export function kuundaAiLocalize(key: KuundaAiStringKey): string {
	const entry = KUUNDA_AI_STRINGS[key];
	const message = isFrench(getNLSLanguage()) ? entry.fr : entry.en;
	return localize(key, message);
}

export function kuundaAiLocalize2(key: KuundaAiStringKey): ILocalizedString {
	return { original: KUUNDA_AI_STRINGS[key].en, value: kuundaAiLocalize(key) };
}
