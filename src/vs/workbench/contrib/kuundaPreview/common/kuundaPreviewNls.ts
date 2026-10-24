/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import { getNLSLanguage, type ILocalizedString } from '../../../../nls.js';
import { formatKuundaMessage } from '../../kuundaBrand/common/kuundaNls.js';

export const KUUNDA_PREVIEW_STRINGS = {
	'kuunda.preview.tagline': {
		en: 'Live local preview. Select Element is the default browser tool.',
		fr: "Aperçu local en direct. Sélectionner l'élément est l'outil par défaut du navigateur.",
	},
	'kuunda.preview.open': {
		en: 'Kuunda Vibe: Open Browser Preview',
		fr: "Kuunda Vibe : ouvrir l'aperçu navigateur",
	},
	'kuunda.preview.titleMode': {
		en: 'Browser — {0}',
		fr: 'Navigateur — {0}',
	},
	'kuunda.preview.menu': {
		en: 'Browser Menu',
		fr: 'Menu du navigateur',
	},
	'kuunda.preview.selectElement': {
		en: 'Select Element',
		fr: "Sélectionner l'élément",
	},
	'kuunda.preview.navigate': {
		en: 'Navigate',
		fr: 'Naviguer',
	},
	'kuunda.preview.reload': {
		en: 'Reload',
		fr: 'Recharger',
	},
	'kuunda.preview.live': {
		en: 'Live',
		fr: 'Direct',
	},
	'kuunda.preview.selected': {
		en: 'Selected',
		fr: 'Sélection',
	},
	'kuunda.preview.empty': {
		en: 'No local HTML page in this folder yet.',
		fr: 'Aucune page HTML locale dans ce dossier.',
	},
	'kuunda.preview.noFolder': {
		en: 'Open a folder to preview it locally.',
		fr: 'Ouvrez un dossier pour le prévisualiser en local.',
	},
} as const;

export type KuundaPreviewStringKey = keyof typeof KUUNDA_PREVIEW_STRINGS;

function isFrench(language: string | undefined): boolean {
	return typeof language === 'string' && (language === 'fr' || language.startsWith('fr-') || language.startsWith('fr_'));
}

export function resolveKuundaPreviewString(key: KuundaPreviewStringKey, language: string | undefined = getNLSLanguage()): string {
	const entry = KUUNDA_PREVIEW_STRINGS[key];
	return isFrench(language) ? entry.fr : entry.en;
}

export function kuundaPreviewLocalize(key: KuundaPreviewStringKey, ...args: Array<string | number>): string {
	return formatKuundaMessage(resolveKuundaPreviewString(key), args);
}

export function kuundaPreviewLocalize2(key: KuundaPreviewStringKey): ILocalizedString {
	return {
		original: KUUNDA_PREVIEW_STRINGS[key].en,
		value: resolveKuundaPreviewString(key),
	};
}
