/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import { getNLSLanguage, type ILocalizedString } from '../../../../nls.js';
import { formatKuundaMessage } from '../../kuundaBrand/common/kuundaNls.js';

export const KUUNDA_CLOUD_STRINGS = {
	'kuunda.cloud.tagline': {
		en: 'Kuunda Cloud is on by default for new projects and can be disabled or replaced.',
		fr: 'Kuunda Cloud est activé par défaut pour les nouveaux projets et peut être désactivé ou remplacé.',
	},
	'kuunda.cloud.panel': {
		en: 'Kuunda Cloud data',
		fr: 'Données Kuunda Cloud',
	},
	'kuunda.cloud.showPanel': {
		en: 'Kuunda Vibe: Show Cloud Data',
		fr: 'Kuunda Vibe : afficher les données Cloud',
	},
	'kuunda.cloud.provision': {
		en: 'Kuunda Vibe: Provision Kuunda Cloud',
		fr: 'Kuunda Vibe : provisionner Kuunda Cloud',
	},
	'kuunda.cloud.provision.ok': {
		en: 'Kuunda Cloud ready ({0}).',
		fr: 'Kuunda Cloud prêt ({0}).',
	},
	'kuunda.cloud.provision.pendingUser': {
		en: 'Kuunda Vibe could not resolve a Cloud identity for this project yet. It retries automatically — no Kuunda Cloud account is required.',
		fr: 'Kuunda Vibe n’a pas encore pu résoudre une identité Cloud pour ce projet. Une nouvelle tentative est automatique — aucun compte Kuunda Cloud n’est requis.',
	},
	'kuunda.cloud.plan': {
		en: 'Kuunda Vibe: Manage Cloud Plan',
		fr: 'Kuunda Vibe : gérer le plan Cloud',
	},
	'kuunda.cloud.plan.current': {
		en: 'current plan',
		fr: 'plan actuel',
	},
	'kuunda.cloud.plan.free': {
		en: 'free',
		fr: 'gratuit',
	},
	'kuunda.cloud.plan.pick': {
		en: 'Which Kuunda Cloud plan should this project use?',
		fr: 'Quel plan Kuunda Cloud ce projet doit-il utiliser ?',
	},
	'kuunda.cloud.plan.ok': {
		en: 'Kuunda Cloud plan set to {0}.',
		fr: 'Plan Kuunda Cloud défini sur {0}.',
	},
	'kuunda.cloud.plan.statusbar': {
		en: 'Cloud: {0}',
		fr: 'Cloud : {0}',
	},
	'kuunda.cloud.setting.enabled': {
		en: 'Automatically create a Kuunda Cloud space for every project. No account is required.',
		fr: 'Créer automatiquement un espace Kuunda Cloud pour chaque projet. Aucun compte n’est requis.',
	},
	'kuunda.cloud.setting.defaultPlan': {
		en: 'Kuunda Cloud plan assigned to new projects (default: standard).',
		fr: 'Plan Kuunda Cloud attribué aux nouveaux projets (par défaut : standard).',
	},
	'kuunda.cloud.error.not_provisioned': {
		en: 'This project has no Kuunda Cloud space yet, so its plan cannot change.',
		fr: 'Ce projet n’a pas encore d’espace Kuunda Cloud : son plan ne peut pas changer.',
	},
	'kuunda.cloud.sync': {
		en: 'Kuunda Vibe: Sync Cloud Account',
		fr: 'Kuunda Vibe : synchroniser le compte Cloud',
	},
	'kuunda.cloud.sync.ok': {
		en: 'Synced. {0} project(s) linked, {1} known only in the cloud.',
		fr: 'Synchronisé. {0} projet(s) relié(s), {1} connu(s) uniquement dans le cloud.',
	},
	'kuunda.cloud.sync.linked': {
		en: '{0} project(s) attached to your Kuunda Cloud account.',
		fr: '{0} projet(s) rattaché(s) à votre compte Kuunda Cloud.',
	},
	'kuunda.cloud.sync.failed': {
		en: 'Could not reach Kuunda Cloud. The account will sync again automatically.',
		fr: 'Kuunda Cloud injoignable. Le compte se resynchronisera automatiquement.',
	},
	'kuunda.cloud.projects': {
		en: 'Kuunda Vibe: Cloud Account Projects',
		fr: 'Kuunda Vibe : projets du compte Cloud',
	},
	'kuunda.cloud.projects.empty': {
		en: 'No project is registered on this Cloud account yet.',
		fr: 'Aucun projet n’est encore enregistré sur ce compte Cloud.',
	},
	'kuunda.cloud.projects.pick': {
		en: 'Projects centralised under your Kuunda Cloud account:',
		fr: 'Projets centralisés sous votre compte Kuunda Cloud :',
	},
	'kuunda.cloud.projects.archived': {
		en: 'archived — restorable',
		fr: 'archivé — récupérable',
	},
	'kuunda.cloud.projects.active': {
		en: '{0} is active and already linked to a local folder.',
		fr: '{0} est actif et déjà relié à un dossier local.',
	},
	'kuunda.cloud.projects.restore.confirm': {
		en: 'Restore the archived Cloud space {0}?',
		fr: 'Récupérer l’espace Cloud archivé {0} ?',
	},
	'kuunda.cloud.projects.restore.ok': {
		en: 'Restore',
		fr: 'Récupérer',
	},
	'kuunda.cloud.projects.restored': {
		en: 'Cloud space {0} restored.',
		fr: 'Espace Cloud {0} récupéré.',
	},
	'kuunda.cloud.projects.repo': {
		en: 'Source location copied ({0}). Clone it here to work on this project.',
		fr: 'Emplacement du code copié ({0}). Clonez-le ici pour travailler sur ce projet.',
	},
	'kuunda.cloud.link': {
		en: 'Kuunda Vibe: Start Cloud Account Link',
		fr: 'Kuunda Vibe : démarrer le rattachement du compte Cloud',
	},
	'kuunda.cloud.link.ok': {
		en: 'Link code {0} copied. Enter it on your other machine with the Adopt Cloud Account command.',
		fr: 'Code de rattachement {0} copié. Saisissez-le sur votre autre machine avec la commande adopter le compte Cloud.',
	},
	'kuunda.cloud.adopt': {
		en: 'Kuunda Vibe: Adopt Cloud Account',
		fr: 'Kuunda Vibe : adopter le compte Cloud',
	},
	'kuunda.cloud.adopt.prompt': {
		en: 'Enter the link code shown on your other machine:',
		fr: 'Saisissez le code de rattachement affiché sur votre autre machine :',
	},
	'kuunda.cloud.adopt.ok': {
		en: 'Cloud account adopted. Your projects are syncing.',
		fr: 'Compte Cloud adopté. Vos projets se synchronisent.',
	},
	'kuunda.cloud.archive': {
		en: 'Kuunda Vibe: Archive Cloud Space',
		fr: 'Kuunda Vibe : archiver l’espace Cloud',
	},
	'kuunda.cloud.archive.confirm': {
		en: 'Archive the Cloud space of this project? Its data is kept and can be restored later; nothing is destroyed.',
		fr: 'Archiver l’espace Cloud de ce projet ? Les données sont conservées et récupérables plus tard ; rien n’est détruit.',
	},
	'kuunda.cloud.archive.confirm.ok': {
		en: 'Archive',
		fr: 'Archiver',
	},
	'kuunda.cloud.archive.ok': {
		en: 'Cloud space archived. Restore it any time from the Cloud account projects.',
		fr: 'Espace Cloud archivé. Récupérable à tout moment depuis les projets du compte Cloud.',
	},
	'kuunda.cloud.provision.pendingApi': {
		en: 'The project was created. Kuunda Cloud provisioning will retry when the platform is reachable. Placeholder credentials stay gitignored.',
		fr: 'Le projet a été créé. Le provisioning Kuunda Cloud sera retenté quand la plateforme sera joignable. Les identifiants placeholder restent ignorés par git.',
	},
	'kuunda.cloud.provision.skipped': {
		en: 'Kuunda Cloud is disabled for this project.',
		fr: 'Kuunda Cloud est désactivé pour ce projet.',
	},
	'kuunda.cloud.provision.reused': {
		en: 'Reusing Kuunda Cloud project {0}.',
		fr: 'Réutilisation du projet Kuunda Cloud {0}.',
	},
	'kuunda.cloud.provision.error': {
		en: 'Could not update Kuunda Cloud files: {0}',
		fr: 'Impossible de mettre à jour les fichiers Kuunda Cloud : {0}',
	},
	'kuunda.cloud.enable': {
		en: 'Kuunda Vibe: Enable Kuunda Cloud',
		fr: 'Kuunda Vibe : activer Kuunda Cloud',
	},
	'kuunda.cloud.enable.ok': {
		en: 'Kuunda Cloud enabled.',
		fr: 'Kuunda Cloud activé.',
	},
	'kuunda.cloud.disable': {
		en: 'Kuunda Vibe: Disable Kuunda Cloud',
		fr: 'Kuunda Vibe : désactiver Kuunda Cloud',
	},
	'kuunda.cloud.disable.ok': {
		en: 'Kuunda Cloud disabled. Existing project mapping is kept until you replace it.',
		fr: 'Kuunda Cloud désactivé. Le mapping projet est conservé jusqu’à un remplacement.',
	},
	'kuunda.cloud.replace': {
		en: 'Kuunda Vibe: Replace Kuunda Cloud Project',
		fr: 'Kuunda Vibe : remplacer le projet Kuunda Cloud',
	},
	'kuunda.cloud.replace.ok': {
		en: 'Allocated a new Kuunda Cloud project ({0}).',
		fr: 'Nouveau projet Kuunda Cloud alloué ({0}).',
	},
	'kuunda.cloud.replace.confirm': {
		en: 'Replace the Kuunda Cloud instance for this project? The previous mapping is dropped.',
		fr: 'Remplacer l’instance Kuunda Cloud de ce projet ? L’ancien mapping sera abandonné.',
	},
	'kuunda.cloud.replace.confirm.ok': {
		en: 'Replace',
		fr: 'Remplacer',
	},
	'kuunda.cloud.none': {
		en: 'Open a Kuunda project folder first.',
		fr: 'Ouvrez d’abord un dossier de projet Kuunda.',
	},
	'kuunda.cloud.pickFolder': {
		en: 'Which Kuunda project should be updated?',
		fr: 'Quel projet Kuunda faut-il mettre à jour ?',
	},
	'kuunda.cloud.error.write_failed': {
		en: 'Could not write Kuunda Cloud files. Check folder permissions.',
		fr: 'Impossible d’écrire les fichiers Kuunda Cloud. Vérifiez les permissions du dossier.',
	},
	'kuunda.cloud.error.strict_offline': {
		en: 'Strict offline mode is on, so Kuunda Cloud is not contacted.',
		fr: 'Le mode hors ligne strict est activé : Kuunda Cloud n’est pas contacté.',
	},
	'kuunda.cloud.network.timeout': {
		en: 'Kuunda Cloud timed out. Provisioning will retry when the platform responds.',
		fr: 'Kuunda Cloud a expiré. Le provisioning réessaiera quand la plateforme répondra.',
	},
	'kuunda.cloud.network.offline': {
		en: 'Kuunda Cloud is unreachable. Placeholder credentials stay gitignored until the platform is back.',
		fr: 'Kuunda Cloud est injoignable. Les identifiants placeholder restent ignorés par git jusqu’au retour de la plateforme.',
	},
	'kuunda.cloud.routes': {
		en: 'Kuunda Vibe: Route Report',
		fr: 'Kuunda Vibe : rapport des routes',
	},
	'kuunda.cloud.routes.removable': {
		en: 'legacy removal: ready',
		fr: 'suppression du legacy : prête',
	},
	'kuunda.cloud.routes.notRemovable': {
		en: 'legacy removal: not yet — missing spec proof',
		fr: 'suppression du legacy : pas encore — preuve manquante',
	},
	'kuunda.cloud.routes.unexercised': {
		en: 'not exercised yet',
		fr: 'pas encore exercée',
	},
	'kuunda.cloud.routes.legacyUsed': {
		en: 'served by the legacy route',
		fr: 'servie par la route legacy',
	},
	'kuunda.cloud.routes.specOnly': {
		en: 'served by the spec route',
		fr: 'servie par la route spec',
	},
	'kuunda.cloud.routes.reset': {
		en: 'Reset route evidence',
		fr: 'Réinitialiser les compteurs de routes',
	},
	'kuunda.cloud.routes.reset.detail': {
		en: 'All counters restart from zero.',
		fr: 'Tous les compteurs repartent de zéro.',
	},
	'kuunda.cloud.routes.reset.ok': {
		en: 'Route evidence cleared.',
		fr: 'Compteurs de routes réinitialisés.',
	},
	'kuunda.cloud.setting.legacyRoutes': {
		en: 'How the IDE reaches Kuunda Cloud while the platform API migrates. auto tries the /v1/accounts routes first and falls back to the legacy routes; off uses the spec routes only, so a missing route is reported as an error instead of being hidden.',
		fr: 'Comment l’IDE joint Kuunda Cloud pendant la migration de l’API. auto essaie d’abord les routes /v1/accounts puis retombe sur les routes legacy ; off n’utilise que les routes de la spec, donc une route manquante remonte comme une erreur au lieu d’être masquée.',
	},
	'kuunda.cloud.setting.legacyRoutes.auto': {
		en: 'auto — spec routes first, legacy fallback while the migration runs',
		fr: 'auto — routes de la spec d’abord, repli legacy pendant la migration',
	},
	'kuunda.cloud.setting.legacyRoutes.off': {
		en: 'off — spec routes only, never call a legacy route',
		fr: 'off — routes de la spec uniquement, aucun appel legacy',
	},
} as const;

export type KuundaCloudStringKey = keyof typeof KUUNDA_CLOUD_STRINGS;

function isFrench(language: string | undefined): boolean {
	return typeof language === 'string' && (language === 'fr' || language.startsWith('fr-') || language.startsWith('fr_'));
}

export function kuundaCloudLocalize(key: KuundaCloudStringKey, ...args: Array<string | number>): string {
	const entry = KUUNDA_CLOUD_STRINGS[key];
	const message = isFrench(getNLSLanguage()) ? entry.fr : entry.en;
	return formatKuundaMessage(message, args);
}

export function kuundaCloudLocalize2(key: KuundaCloudStringKey): ILocalizedString {
	return { original: KUUNDA_CLOUD_STRINGS[key].en, value: kuundaCloudLocalize(key) };
}
