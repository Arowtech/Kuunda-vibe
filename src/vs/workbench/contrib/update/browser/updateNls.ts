/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import { getNLSLanguage } from '../../../../nls.js';
import { formatKuundaMessage } from '../../kuundaBrand/common/kuundaNls.js';

const UPDATE_MENU = {
	check: { en: 'Check for Updates...', fr: 'Vérifier les mises à jour…' },
	checking: { en: 'Checking for Updates...', fr: 'Recherche de mises à jour…' },
	update: { en: 'Update', fr: 'Mettre à jour' },
	downloading: { en: 'Downloading update...', fr: 'Téléchargement de la mise à jour…' },
	installing: { en: 'Installing update...', fr: 'Installation de la mise à jour…' },
	later: { en: 'Later', fr: 'Plus tard' },
	releaseNotes: { en: 'Release Notes', fr: 'Notes de version' },
	none: { en: 'There are currently no updates available.', fr: 'Aucune mise à jour disponible.' },
	available: { en: 'There is an available update.', fr: 'Une mise à jour est disponible.' },
	availableVersion: { en: "There's an update available: {0} {1}", fr: 'Une mise à jour est disponible : {0} {1}' },
	restart: { en: 'Restart {0} to apply the latest update.', fr: 'Redémarrez {0} pour appliquer la mise à jour.' },
	ready: { en: 'New {0} update available.', fr: 'Nouvelle mise à jour de {0}.' },
	checkingBadge: { en: 'Checking for {0} updates...', fr: 'Recherche des mises à jour de {0}…' },
	downloadingBadge: { en: 'Downloading {0} update...', fr: 'Téléchargement de la mise à jour de {0}…' },
	updatingBadge: { en: 'Updating {0}...', fr: 'Mise à jour de {0}…' },
	service: { en: 'Update Service', fr: 'Service de mise à jour' },
} as const;

export type UpdateMenuKey = keyof typeof UPDATE_MENU;

function isFrench(language: string | undefined): boolean {
	return typeof language === 'string' && (language === 'fr' || language.startsWith('fr-') || language.startsWith('fr_'));
}

export function updateMenuText(key: UpdateMenuKey, ...args: Array<string | number>): string {
	const entry = UPDATE_MENU[key];
	const message = isFrench(getNLSLanguage()) ? entry.fr : entry.en;
	return formatKuundaMessage(message, args);
}
