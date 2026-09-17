/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import { getNLSLanguage, localize, type ILocalizedString } from '../../../../nls.js';

export const KUUNDA_PUBLISH_STRINGS = {
	'kuunda.publish.tagline': {
		en: 'Publishing builds Android App Bundles and iOS packages for mobile projects. Store keys stay on this machine or in CI secrets.',
		fr: 'La publication construit des Android App Bundles et des paquets iOS pour les projets mobiles. Les clés store restent sur cette machine ou dans les secrets CI.',
	},
	'kuunda.publish.panel': {
		en: 'Kuunda Publishing',
		fr: 'Publication Kuunda',
	},
	'kuunda.publish.showPanel': {
		en: 'Kuunda Vibe: Show Publishing',
		fr: 'Kuunda Vibe : afficher la publication',
	},
	'kuunda.publish.configurePlay': {
		en: 'Kuunda Vibe: Configure Google Play Credentials',
		fr: 'Kuunda Vibe : configurer les identifiants Google Play',
	},
	'kuunda.publish.configureAppStore': {
		en: 'Kuunda Vibe: Configure App Store Connect Credentials',
		fr: 'Kuunda Vibe : configurer les identifiants App Store Connect',
	},
	'kuunda.publish.configureSignature': {
		en: 'Kuunda Vibe: Configure Android Upload Keystore',
		fr: 'Kuunda Vibe : configurer le keystore de signature Android',
	},
	'kuunda.publish.setMetadata': {
		en: 'Kuunda Vibe: Set Store Metadata',
		fr: 'Kuunda Vibe : definir les metadonnees store',
	},
	'kuunda.publish.start': {
		en: 'Kuunda Vibe: Publish',
		fr: 'Kuunda Vibe : publier',
	},
	'kuunda.publish.start.ok': {
		en: 'Publish job {0} is {1}. Watch progress in the Publishing panel.',
		fr: 'Le job de publication {0} est {1}. Suivez la progression dans le panneau Publication.',
	},
	'kuunda.publish.start.pendingCi': {
		en: 'Publish job {0} is waiting for CI. GitHub dispatch is not configured, so no AAB or IPA was produced.',
		fr: 'Le job de publication {0} attend la CI. Le dispatch GitHub n est pas configure, donc aucun AAB ni IPA n a ete produit.',
	},
	'kuunda.publish.configure.ok': {
		en: 'Store credentials were copied to a gitignored file. They are not sent to the Kuunda API.',
		fr: 'Les identifiants store ont ete copies dans un fichier ignore par git. Ils ne sont pas envoyes a l API Kuunda.',
	},
	'kuunda.publish.signature.ok': {
		en: 'The Android upload keystore was copied to a gitignored file.',
		fr: 'Le keystore de signature Android a ete copie dans un fichier ignore par git.',
	},
	'kuunda.publish.metadata.ok': {
		en: 'Store metadata saved locally (package {0}, version {1}).',
		fr: 'Metadonnees store enregistrees en local (paquet {0}, version {1}).',
	},
	'kuunda.publish.metadata.version': {
		en: 'App version (1.2.3)',
		fr: 'Version de l application (1.2.3)',
	},
	'kuunda.publish.metadata.packageId': {
		en: 'Application id (com.example.app)',
		fr: 'Identifiant d application (com.example.app)',
	},
	'kuunda.publish.appStore.keyId': {
		en: 'App Store Connect key id',
		fr: 'Identifiant de cle App Store Connect',
	},
	'kuunda.publish.appStore.issuerId': {
		en: 'App Store Connect issuer id',
		fr: 'Identifiant emetteur App Store Connect',
	},
	'kuunda.publish.pickPlayJson': {
		en: 'Select the Google Play service account JSON',
		fr: 'Selectionnez le JSON de compte de service Google Play',
	},
	'kuunda.publish.pickP8': {
		en: 'Select the App Store Connect .p8 key',
		fr: 'Selectionnez la cle .p8 App Store Connect',
	},
	'kuunda.publish.pickKeystore': {
		en: 'Select the Android upload keystore',
		fr: 'Selectionnez le keystore de signature Android',
	},
	'kuunda.publish.filter.json': {
		en: 'JSON',
		fr: 'Fichier JSON',
	},
	'kuunda.publish.filter.p8': {
		en: 'App Store Connect key',
		fr: 'Cle App Store Connect',
	},
	'kuunda.publish.filter.keystore': {
		en: 'Android keystore',
		fr: 'Keystore Android',
	},
	'kuunda.publish.none': {
		en: 'Open a mobile Kuunda project folder first.',
		fr: 'Ouvrez d abord un dossier de projet mobile Kuunda.',
	},
	'kuunda.publish.pickFolder': {
		en: 'Which mobile project should be published?',
		fr: 'Quel projet mobile faut-il publier ?',
	},
	'kuunda.publish.error.write_failed': {
		en: 'Could not write publishing files. Check folder permissions.',
		fr: 'Impossible d ecrire les fichiers de publication. Verifiez les permissions du dossier.',
	},
	'kuunda.publish.error.not_mobile': {
		en: 'Publishing is only available for mobile projects.',
		fr: 'La publication n est disponible que pour les projets mobiles.',
	},
	'kuunda.publish.error.no_targets': {
		en: 'This mobile project has no store targets. Recreate it with Google Play, App Store, or both.',
		fr: 'Ce projet mobile n a aucune cible store. Recreez-le avec Google Play, App Store, ou les deux.',
	},
	'kuunda.publish.error.incomplete_metadata': {
		en: 'Set a package id (com.example.app) and a version like 1.0.0 before publishing.',
		fr: 'Definissez un identifiant de paquet (com.example.app) et une version du type 1.0.0 avant de publier.',
	},
	'kuunda.publish.error.missing_credentials': {
		en: 'Store developer credentials are missing for a selected target.',
		fr: 'Les identifiants developpeur store manquent pour une cible selectionnee.',
	},
	'kuunda.publish.error.missing_signature': {
		en: 'Google Play publishing needs an Android upload keystore.',
		fr: 'La publication Google Play necessite un keystore de signature Android.',
	},
	'kuunda.publish.error.runner_unavailable': {
		en: 'No CI runner is available for this store target.',
		fr: 'Aucun runner CI n est disponible pour cette cible store.',
	},
	'kuunda.publish.error.invalid_play_json': {
		en: 'That file is not a Google Play service account JSON.',
		fr: 'Ce fichier n est pas un JSON de compte de service Google Play.',
	},
	'kuunda.publish.error.invalid_p8': {
		en: 'That file is not a valid App Store Connect .p8 key.',
		fr: 'Ce fichier n est pas une cle .p8 App Store Connect valide.',
	},
	'kuunda.publish.error.invalid_keystore': {
		en: 'That file is not a usable Android upload keystore.',
		fr: 'Ce fichier n est pas un keystore de signature Android utilisable.',
	},
	'kuunda.publish.error.missing_user': {
		en: 'Set a billing user id before publishing.',
		fr: 'Definissez un identifiant de facturation avant de publier.',
	},
	'kuunda.publish.error.invalid_store_ids': {
		en: 'App Store Connect key id and issuer id must be 4-64 letters, digits or hyphens.',
		fr: 'L identifiant de cle et l identifiant emetteur App Store Connect doivent faire 4 a 64 lettres, chiffres ou tirets.',
	},
	'kuunda.publish.error.strict_offline': {
		en: 'Strict offline mode is on, so publishing does not contact the platform or stores.',
		fr: 'Le mode hors ligne strict est active : la publication ne contacte ni la plateforme ni les stores.',
	},
	'kuunda.publish.network.timeout': {
		en: 'The publishing API timed out. No store secret was sent. Retry when the network is back.',
		fr: 'L API de publication a expire. Aucun secret store n a ete envoye. Reessayez quand le reseau reviendra.',
	},
	'kuunda.publish.network.offline': {
		en: 'The publishing API is unreachable. No store secret was sent.',
		fr: 'L API de publication est injoignable. Aucun secret store n a ete envoye.',
	},
} as const;

export type KuundaPublishStringKey = keyof typeof KUUNDA_PUBLISH_STRINGS;

function isFrench(language: string | undefined): boolean {
	return typeof language === 'string' && (language === 'fr' || language.startsWith('fr-') || language.startsWith('fr_'));
}

export function kuundaPublishLocalize(key: KuundaPublishStringKey, ...args: Array<string | number>): string {
	const entry = KUUNDA_PUBLISH_STRINGS[key];
	const message = isFrench(getNLSLanguage()) ? entry.fr : entry.en;
	return localize(key, message, ...args);
}

export function kuundaPublishLocalize2(key: KuundaPublishStringKey): ILocalizedString {
	return { original: KUUNDA_PUBLISH_STRINGS[key].en, value: kuundaPublishLocalize(key) };
}
