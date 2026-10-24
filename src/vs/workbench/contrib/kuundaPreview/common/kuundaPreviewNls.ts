/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import { getNLSLanguage, type ILocalizedString } from '../../../../nls.js';
import { formatKuundaMessage } from '../../kuundaBrand/common/kuundaNls.js';

export const KUUNDA_PREVIEW_STRINGS = {
	'kuunda.preview.tagline': {
		en: 'Live local preview. Turn on Select Element to send it to the chat.',
		fr: "Aperçu local en direct. Activez Sélectionner l'élément pour l'envoyer au chat.",
	},
	'kuunda.preview.open': {
		en: 'Kuunda Vibe: Open Browser Preview',
		fr: "Kuunda Vibe : ouvrir l'aperçu navigateur",
	},
	'kuunda.preview.title': {
		en: 'Browser',
		fr: 'Navigateur',
	},
	'kuunda.preview.selectElement': {
		en: 'Select Element',
		fr: "Sélectionner l'élément",
	},
	'kuunda.preview.reload': {
		en: 'Reload',
		fr: 'Recharger',
	},
	'kuunda.preview.back': {
		en: 'Back',
		fr: 'Retour',
	},
	'kuunda.preview.forward': {
		en: 'Forward',
		fr: 'Avancer',
	},
	'kuunda.preview.address': {
		en: 'Address',
		fr: 'Adresse',
	},
	'kuunda.preview.selectHint': {
		en: 'Click an element to add it to the chat.',
		fr: "Cliquez un élément pour l'ajouter au chat.",
	},
	'kuunda.preview.picked': {
		en: 'Added to chat',
		fr: 'Ajouté au chat',
	},
	'kuunda.preview.pickFailed': {
		en: 'Element not found in the source',
		fr: 'Élément introuvable dans la source',
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
