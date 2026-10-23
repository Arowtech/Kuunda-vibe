/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import { getNLSLanguage, type ILocalizedString } from '../../../../nls.js';
import { formatKuundaMessage } from '../../kuundaBrand/common/kuundaNls.js';
import type { AuthErrorCode } from './accountPolicy.js';

export const KUUNDA_ACCOUNT_STRINGS = {
	"kuunda.account.tagline": {
		en: "One Kuunda identity for the IDE and the web: credits, usage, Cloud projects, never a Cursor clone.",
		fr: "Une identité Kuunda pour l’IDE et le web : crédits, usage, projets Cloud, jamais un clone de Cursor.",
	},
	"kuunda.account.openStudio": {
		en: "Kuunda Vibe: Open Studio",
		fr: "Kuunda Vibe : ouvrir le Studio",
	},
	"kuunda.account.signOut": {
		en: "Kuunda Vibe: Sign Out of This Device",
		fr: "Kuunda Vibe : se déconnecter de cet appareil",
	},
	"kuunda.account.signOutEverywhere": {
		en: "Kuunda Vibe: Sign Out Everywhere",
		fr: "Kuunda Vibe : se déconnecter partout",
	},
	"kuunda.account.studio.title": {
		en: "Kuunda Studio",
		fr: "Studio Kuunda",
	},
	"kuunda.account.studio.subtitle": {
		en: "Identity, credits, usage and Cloud — managed in the IDE and on the web.",
		fr: "Identité, crédits, usage et Cloud — gérés dans l’IDE comme sur le web.",
	},
	"kuunda.account.studio.close": {
		en: "Close",
		fr: "Fermer",
	},
	"kuunda.account.signedOut.title": {
		en: "Your Studio, not a sign-in wall",
		fr: "Votre Studio, pas un mur de connexion",
	},
	"kuunda.account.signedOut.body": {
		en: "Create an account or sign in here. Local Ollama and BYOK keep working without a Kuunda account. Cloud credits, billing and provisioning need this identity.",
		fr: "Créez un compte ou connectez-vous ici. Ollama local et le BYOK restent utilisables sans compte Kuunda. Les crédits Cloud, la facturation et le provisionnement exigent cette identité.",
	},
	"kuunda.account.signedOut.cloud.title": {
		en: "Link this IDE to Kuunda Cloud",
		fr: "Lier cet IDE à Kuunda Cloud",
	},
	"kuunda.account.signedOut.cloud.body": {
		en: "Create your Kuunda account here. Its database is provisioned automatically through the Kuunda Cloud API, then managed in this Studio.",
		fr: "Créez votre compte Kuunda ici. Sa base est provisionnée automatiquement via l’API Kuunda Cloud, puis gérée dans ce Studio.",
	},
	"kuunda.account.email": {
		en: "Email",
		fr: "E-mail",
	},
	"kuunda.account.password": {
		en: "Password",
		fr: "Mot de passe",
	},
	"kuunda.account.displayName": {
		en: "Display name",
		fr: "Nom affiché",
	},
	"kuunda.account.password.hint": {
		en: "At least 10 characters. Never stored in the IDE.",
		fr: "Au moins 10 caractères. Jamais stocké dans l’IDE.",
	},
	"kuunda.account.signIn": {
		en: "Sign in",
		fr: "Se connecter",
	},
	"kuunda.account.signUp": {
		en: "Create account",
		fr: "Créer le compte",
	},
	"kuunda.account.toggleSignUp": {
		en: "New here? Create an account",
		fr: "Nouveau ? Créer un compte",
	},
	"kuunda.account.toggleSignIn": {
		en: "Already have an account? Sign in",
		fr: "Déjà un compte ? Se connecter",
	},
	"kuunda.account.oauth.google": {
		en: "Continue with Google",
		fr: "Continuer avec Google",
	},
	"kuunda.account.oauth.hint": {
		en: "Google opens the browser, then returns to this app via kuunda-vibe://",
		fr: "Google ouvre le navigateur, puis revient dans l’app via kuunda-vibe://",
	},
	"kuunda.account.device.title": {
		en: "Pair from the web",
		fr: "Apparier depuis le web",
	},
	"kuunda.account.device.body": {
		en: "Approve this IDE on app.kuunda.cloud with a short code — no password typed in the editor.",
		fr: "Approuvez cet IDE sur app.kuunda.cloud avec un code court — aucun mot de passe saisi dans l’éditeur.",
	},
	"kuunda.account.device.start": {
		en: "Generate pairing code",
		fr: "Générer un code d’appariement",
	},
	"kuunda.account.device.waiting": {
		en: "Waiting for approval on the web…",
		fr: "En attente d’approbation sur le web…",
	},
	"kuunda.account.tab.identity": {
		en: "Identity",
		fr: "Identité",
	},
	"kuunda.account.tab.credits": {
		en: "Credits",
		fr: "Crédits",
	},
	"kuunda.account.tab.usage": {
		en: "Usage",
		fr: "Consommation",
	},
	"kuunda.account.tab.devices": {
		en: "Devices",
		fr: "Appareils",
	},
	"kuunda.account.tab.cloud": {
		en: "Cloud projects",
		fr: "Projets Cloud",
	},
	"kuunda.account.tab.security": {
		en: "Security",
		fr: "Sécurité",
	},
	"kuunda.account.identity.plan": {
		en: "Plan {0}",
		fr: "Offre {0}",
	},
	"kuunda.account.identity.org": {
		en: "Organization {0}",
		fr: "Organisation {0}",
	},
	"kuunda.account.identity.verified": {
		en: "Email verified",
		fr: "E-mail vérifié",
	},
	"kuunda.account.identity.unverified": {
		en: "Email not verified yet",
		fr: "E-mail pas encore vérifié",
	},
	"kuunda.account.credits.openPlans": {
		en: "Open plans on the web",
		fr: "Ouvrir les offres sur le web",
	},
	"kuunda.account.credits.topup": {
		en: "Top up or change plan",
		fr: "Recharger ou changer d’offre",
	},
	"kuunda.account.credits.empty": {
		en: "Sign in to see remaining credits and the included quota.",
		fr: "Connectez-vous pour voir les crédits restants et le quota inclus.",
	},
	"kuunda.account.usage.empty": {
		en: "No usage yet this period. Agent, Tab and publish will appear here — not a silent telemetry feed.",
		fr: "Aucun usage sur cette période. Agent, Tab et publication apparaîtront ici — pas un flux de télémétrie silencieuse.",
	},
	"kuunda.account.usage.agent": {
		en: "Agent runs",
		fr: "Passages agent",
	},
	"kuunda.account.usage.tab": {
		en: "Tab completion",
		fr: "Complétion Tab",
	},
	"kuunda.account.usage.publish": {
		en: "Publish jobs",
		fr: "Jobs de publication",
	},
	"kuunda.account.devices.empty": {
		en: "This device is the only session we can list until the platform returns more.",
		fr: "Cet appareil est la seule session listable tant que la plateforme n’en renvoie pas d’autres.",
	},
	"kuunda.account.devices.thisDevice": {
		en: "This IDE",
		fr: "Cet IDE",
	},
	"kuunda.account.devices.revoke": {
		en: "Revoke",
		fr: "Révoquer",
	},
	"kuunda.account.cloud.open": {
		en: "Refresh",
		fr: "Actualiser",
	},
	"kuunda.account.cloud.body": {
		en: "This account’s database is created automatically through the Kuunda Cloud API. Analytics, Database, Users, Storage, AI, Payments, Emails, Connectors, Security, SEO, Usage and Settings stay in this Studio.",
		fr: "La base de ce compte est créée automatiquement via l’API Kuunda Cloud. Analytique, base de données, utilisateurs, stockage, IA, paiements, e-mails, connecteurs, sécurité, SEO, usage et réglages restent dans ce Studio.",
	},
	"kuunda.account.cloud.empty": {
		en: "Nothing to show for this section yet.",
		fr: "Rien à afficher pour cette section pour le moment.",
	},
	"kuunda.account.cloud.save": {
		en: "Save",
		fr: "Enregistrer",
	},
	"kuunda.account.cloud.notice.pending": {
		en: "This section is wired in the IDE. The Kuunda Cloud API does not serve it yet.",
		fr: "Cette section est branchée dans l’IDE. L’API Kuunda Cloud ne la sert pas encore.",
	},
	"kuunda.account.cloud.notice.database": {
		en: "The account database is still being created.",
		fr: "La base du compte est encore en cours de création.",
	},
	"kuunda.account.cloud.notice.invalid": {
		en: "Check the fields and try again.",
		fr: "Vérifiez les champs et réessayez.",
	},
	"kuunda.account.cloud.notice.offline": {
		en: "Kuunda Cloud is unreachable.",
		fr: "Kuunda Cloud est injoignable.",
	},
	"kuunda.account.cloud.notice.refused": {
		en: "Kuunda refused this call. The console project, another environment and another organization get the same answer.",
		fr: "Kuunda a refusé cet appel. Le projet de la console, un autre environnement et une autre organisation reçoivent la même réponse.",
	},
	"kuunda.account.cloud.notice.rate": {
		en: "Limit of 30 calls per minute. The call is logged.",
		fr: "Limite de 30 appels par minute. L’appel est journalisé.",
	},
	"kuunda.account.cloud.notice.git": {
		en: "Git tokens stay refused until the org key carries git_tokens.",
		fr: "Les jetons Git restent refusés tant que la clé d’organisation ne porte pas git_tokens.",
	},
	"kuunda.account.cloud.notice.domains": {
		en: "Client domains stay refused until the org key carries sites_domains.",
		fr: "Les domaines clients restent refusés tant que la clé d’organisation ne porte pas sites_domains.",
	},
	"kuunda.account.security.providers": {
		en: "Linked sign-in methods",
		fr: "Méthodes de connexion liées",
	},
	"kuunda.account.security.handoff": {
		en: "Continue in the browser, already signed in",
		fr: "Continuer dans le navigateur, déjà connecté",
	},
	"kuunda.account.security.handoff.done": {
		en: "Browser opened with a short-lived handoff. It expires quickly and is not stored here.",
		fr: "Navigateur ouvert avec un passage de relais de courte durée. Il expire vite et n’est pas stocké ici.",
	},
	"kuunda.account.error.invalid_credentials": {
		en: "Email or password is incorrect.",
		fr: "E-mail ou mot de passe incorrect.",
	},
	"kuunda.account.error.invalid_email": {
		en: "Enter a valid email address.",
		fr: "Saisissez une adresse e-mail valide.",
	},
	"kuunda.account.error.weak_password": {
		en: "Use at least 10 characters.",
		fr: "Utilisez au moins 10 caractères.",
	},
	"kuunda.account.error.invalid_account": {
		en: "Kuunda Cloud refused this account. Check the email and use at least 10 characters.",
		fr: "Kuunda Cloud a refusé ce compte. Vérifiez l’e-mail et utilisez au moins 10 caractères.",
	},
	"kuunda.account.error.email_taken": {
		en: "An account already exists for this email. Sign in instead.",
		fr: "Un compte existe déjà pour cet e-mail. Connectez-vous.",
	},
	"kuunda.account.error.provider_unavailable": {
		en: "This provider is not available yet. Create the account with email and password.",
		fr: "Ce fournisseur n’est pas encore disponible. Créez le compte avec l’e-mail et le mot de passe.",
	},
	"kuunda.account.error.offline": {
		en: "Kuunda Cloud is unreachable. Try again when you are online.",
		fr: "Kuunda Cloud est injoignable. Réessayez une fois en ligne.",
	},
	"kuunda.account.error.timeout": {
		en: "The sign-in request timed out.",
		fr: "La connexion a expiré.",
	},
	"kuunda.account.error.unavailable": {
		en: "Account service is not ready yet. Email and Google must be enabled on Kuunda Cloud.",
		fr: "Le service de compte n’est pas encore prêt. L’e-mail et Google doivent être activés sur Kuunda Cloud.",
	},
	"kuunda.account.error.strict_offline": {
		en: "Strict offline mode blocks account sign-in.",
		fr: "Le mode hors ligne strict bloque la connexion au compte.",
	},
	"kuunda.account.error.oauth_denied": {
		en: "The provider denied access.",
		fr: "Le fournisseur a refusé l’accès.",
	},
	"kuunda.account.error.expired": {
		en: "This sign-in step expired. Start again.",
		fr: "Cette étape a expiré. Recommencez.",
	},
	"kuunda.account.statusbar.signedOut": {
		en: "Kuunda: sign in",
		fr: "Kuunda : connexion",
	},
	"kuunda.account.home.cta": {
		en: "Open Kuunda Studio",
		fr: "Ouvrir le Studio Kuunda",
	},
	"kuunda.account.home.cta.detail": {
		en: "Account, credits and Cloud — same login as the web.",
		fr: "Compte, crédits et Cloud — même connexion que le web.",
	},
	"kuunda.account.busy": {
		en: "Working…",
		fr: "Traitement…",
	},
} as const;

export type KuundaAccountStringKey = keyof typeof KUUNDA_ACCOUNT_STRINGS;

function isFrench(language: string | undefined): boolean {
	return typeof language === 'string' && (language === 'fr' || language.startsWith('fr-') || language.startsWith('fr_'));
}

export function kuundaAccountLocalize(key: KuundaAccountStringKey, ...args: Array<string | number>): string {
	const entry = KUUNDA_ACCOUNT_STRINGS[key];
	const message = isFrench(getNLSLanguage()) ? entry.fr : entry.en;
	return formatKuundaMessage(message, args);
}

export function kuundaAccountLocalize2(key: KuundaAccountStringKey): ILocalizedString {
	return { original: KUUNDA_ACCOUNT_STRINGS[key].en, value: kuundaAccountLocalize(key) };
}

const AUTH_ERROR_KEYS: Record<AuthErrorCode, KuundaAccountStringKey> = {
	invalid_credentials: 'kuunda.account.error.invalid_credentials',
	invalid_email: 'kuunda.account.error.invalid_email',
	weak_password: 'kuunda.account.error.weak_password',
	invalid_account: 'kuunda.account.error.invalid_account',
	email_taken: 'kuunda.account.error.email_taken',
	provider_unavailable: 'kuunda.account.error.provider_unavailable',
	offline: 'kuunda.account.error.offline',
	timeout: 'kuunda.account.error.timeout',
	unavailable: 'kuunda.account.error.unavailable',
	strict_offline: 'kuunda.account.error.strict_offline',
	oauth_denied: 'kuunda.account.error.oauth_denied',
	expired: 'kuunda.account.error.expired',
};

export function kuundaAccountErrorMessage(code: AuthErrorCode): string {
	return kuundaAccountLocalize(AUTH_ERROR_KEYS[code]);
}
