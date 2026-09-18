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
		en: "Identity, credits, usage and Cloud — the same account as app.kuunda.cloud.",
		fr: "Identité, crédits, usage et Cloud — le même compte que app.kuunda.cloud.",
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
		en: "Create your Kuunda account here to attach a Cloud sandbox to this project. The IDE agent can then manage the sandbox on its own. You promote migrations to production from Kuunda Cloud.",
		fr: "Créez votre compte Kuunda ici pour rattacher un sandbox Cloud à ce projet. L’agent de l’IDE pourra alors gérer le sandbox de façon autonome. Vous poussez les migrations en production depuis Kuunda Cloud.",
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
	"kuunda.account.oauth.github": {
		en: "Continue with GitHub",
		fr: "Continuer avec GitHub",
	},
	"kuunda.account.oauth.apple": {
		en: "Continue with Apple",
		fr: "Continuer avec Apple",
	},
	"kuunda.account.oauth.hint": {
		en: "Providers are those enabled on Kuunda Cloud. The browser returns to this app via kuunda-vibe://",
		fr: "Les fournisseurs sont ceux activés sur Kuunda Cloud. Le navigateur revient dans l’app via kuunda-vibe://",
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
		en: "Open Kuunda Cloud",
		fr: "Ouvrir Kuunda Cloud",
	},
	"kuunda.account.cloud.body": {
		en: "This IDE shares the same login as Kuunda Cloud. The agent manages the sandbox; you promote migrations to production on app.kuunda.cloud.",
		fr: "Cet IDE partage la même connexion que Kuunda Cloud. L’agent gère le sandbox ; vous poussez les migrations en production sur app.kuunda.cloud.",
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
	"kuunda.account.error.offline": {
		en: "Kuunda Cloud is unreachable. Try again when you are online.",
		fr: "Kuunda Cloud est injoignable. Réessayez une fois en ligne.",
	},
	"kuunda.account.error.timeout": {
		en: "The sign-in request timed out.",
		fr: "La connexion a expiré.",
	},
	"kuunda.account.error.unavailable": {
		en: "Account service is not ready yet. Email, Google, GitHub and Apple must be enabled on Kuunda Cloud.",
		fr: "Le service de compte n’est pas encore prêt. E-mail, Google, GitHub et Apple doivent être activés sur Kuunda Cloud.",
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
