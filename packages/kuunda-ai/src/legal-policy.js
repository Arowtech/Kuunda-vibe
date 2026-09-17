/**
 * Phase 8bis — privacy disclosure, strict offline, payment aggregators (not Genius Pay only).
 * No tariffs, no KYC payloads, no store secrets.
 */

import { LOCAL_AGENT_PROVIDERS } from './providers.js';

export const STRICT_OFFLINE_DEFAULT = false;

export const EXTERNAL_FEATURES = Object.freeze([
	'llm_cloud',
	'kuunda_cloud',
	'publish',
	'billing',
	'credits',
	'feedback',
	'usage_telemetry',
]);

/** Policy target; counsel must confirm before public launch. */
export const TRANSACTION_LOG_RETENTION_DAYS = 1825;

export const PAYMENT_AGGREGATOR_KIND = 'mobile_money_psp';

/** Current adapter plus reserved slots. IDs are opaque; UI uses generic labels. */
export const PAYMENT_AGGREGATORS = Object.freeze([
	{ id: 'genius-pay', status: 'current', regions: ['XOF'], kind: PAYMENT_AGGREGATOR_KIND },
]);

export const DEFAULT_PAYMENT_AGGREGATOR_ID = 'genius-pay';

export const DATA_DISCLOSURE = Object.freeze([
	{ id: 'workspace_files', location: 'local', thirdParty: null },
	{ id: 'prompts_ollama', location: 'local', thirdParty: null },
	{ id: 'prompts_byok', location: 'sent', thirdParty: 'ai_provider' },
	{ id: 'completions_byok', location: 'sent', thirdParty: 'ai_provider' },
	{ id: 'mcp_tools', location: 'sent', thirdParty: 'mcp_server' },
	{ id: 'kuunda_cloud', location: 'sent', thirdParty: 'kuunda_cloud' },
	{ id: 'store_credentials', location: 'local', thirdParty: null },
	{ id: 'publish_metadata', location: 'sent', thirdParty: 'kuunda_cloud' },
	{ id: 'payment_instrument', location: 'sent', thirdParty: 'payment_aggregator' },
	{ id: 'payment_credentials_ide', location: 'never', thirdParty: null },
	{ id: 'transaction_journal', location: 'sent', thirdParty: 'kuunda_cloud' },
	{ id: 'vscode_telemetry', location: 'settings', thirdParty: 'vscode_void' },
	{ id: 'opt_in_feedback', location: 'sent', thirdParty: 'kuunda_cloud' },
]);

export const CREDIT_REFUND_POLICY = Object.freeze({
	unusedPurchased: 'request',
	consumed: 'non_refundable',
	storeIapIfUsed: 'store_rules',
});

export function isLocalAgentProvider(name) {
	return LOCAL_AGENT_PROVIDERS.includes(String(name || ''));
}

export function isKnownPaymentAggregator(id) {
	return PAYMENT_AGGREGATORS.some((row) => row.id === id);
}

export function resolvePaymentAggregator(id) {
	const key = String(id || '').trim();
	if (isKnownPaymentAggregator(key)) {
		return key;
	}
	return DEFAULT_PAYMENT_AGGREGATOR_ID;
}

/**
 * @param {{ strictOffline?: boolean, feature?: string, provider?: string }} input
 */
export function decideExternalSend(input = {}) {
	const feature = String(input.feature || '');
	if (feature === 'usage_telemetry') {
		return { ok: false, error: 'silent_telemetry_forbidden', feature };
	}
	if (input.strictOffline !== true) {
		return { ok: true, feature };
	}
	if (feature === 'llm_cloud' && isLocalAgentProvider(input.provider)) {
		return { ok: true, feature, localOnly: true };
	}
	if (EXTERNAL_FEATURES.includes(feature)) {
		return { ok: false, error: 'strict_offline', disablesBilling: true, feature };
	}
	return { ok: true, feature };
}

export function formatDataDisclosure({ locale = 'en', strictOffline = false, aggregatorId } = {}) {
	const fr = typeof locale === 'string' && (locale === 'fr' || locale.startsWith('fr'));
	const aggregator = resolvePaymentAggregator(aggregatorId);
	const lines = fr
		? [
			'Données locales (ne quittent pas cette machine) :',
			'- Fichiers du workspace, index @Codebase, règles de projet, diffs.',
			'- Identifiants développeur stores (.p8, JSON Play, keystore) — gitignorés.',
			'- Prompts envoyés à Ollama local (chat, Tab, Ctrl+K).',
			'- L’IDE ne stocke jamais de PAN / MSISDN / secret de paiement.',
			'',
			'Données envoyées à des tiers (si le mode hors ligne strict est désactivé) :',
			'- Prompts, extraits de code, complétion Tab, Ctrl+K, messages de commit → fournisseur IA BYOK (Anthropic, OpenAI ou Gemini).',
			'- Outils MCP → les serveurs MCP que vous avez configurés (refusés en hors-ligne strict).',
			'- Métadonnées projet / tables seed → Kuunda Cloud (api.ide.kuunda-cloud.com).',
			'- Identifiant de compte crédits, plan, montant → agrégateur de paiement (adaptateur actuel : ' + aggregator + ').',
			'- Journaux de transaction (montant, statut, identifiant de livraison) conservés ' + TRANSACTION_LOG_RETENTION_DAYS + ' jours côté plateforme.',
			'- Rapport de feedback opt-in (titre, catégorie, version IDE) → Kuunda Cloud. Aucune télémétrie d’usage silencieuse, aucun fichier workspace.',
			'',
			strictOffline
				? 'Mode hors ligne strict : ACTIVÉ. Crédits, facturation en ligne, Kuunda Cloud, publication, feedback, MCP et LLM cloud (dont Tab / Ctrl+K) sont désactivés. Ollama local reste possible.'
				: 'Mode hors ligne strict : désactivé. Vous pouvez l’activer (F1) pour refuser tout envoi externe. La télémétrie VS Code/Void se désactive à part dans les paramètres.',
		]
		: [
			'Local data (stays on this machine):',
			'- Workspace files, @Codebase index, project rules, diffs.',
			'- Store developer credentials (.p8, Play JSON, keystore) — gitignored.',
			'- Prompts sent to local Ollama (chat, Tab, Ctrl+K).',
			'- The IDE never stores PAN / Mobile Money MSISDN / payment secrets.',
			'',
			'Sent to third parties (when strict offline mode is off):',
			'- Prompts, code excerpts, Tab completion, Ctrl+K, commit messages → your BYOK AI provider (Anthropic, OpenAI or Gemini).',
			'- MCP tools → MCP servers you configured (refused in strict offline mode).',
			'- Project metadata / seed tables → Kuunda Cloud (api.ide.kuunda-cloud.com).',
			'- Credits account id, plan, amount → payment aggregator (current adapter: ' + aggregator + ').',
			'- Transaction journals (amount, status, delivery id) kept ' + TRANSACTION_LOG_RETENTION_DAYS + ' days on the platform.',
			'- Opt-in feedback report (title, category, IDE version) → Kuunda Cloud. No silent usage telemetry, no workspace files.',
			'',
			strictOffline
				? 'Strict offline mode: ON. Online credits/billing, Kuunda Cloud, publishing, feedback, MCP and cloud LLMs (including Tab / Ctrl+K) are disabled. Local Ollama still works.'
				: 'Strict offline mode: off. Turn it on (F1) to refuse all external sends. VS Code/Void telemetry is separate — disable it in settings.',
		];
	return `${lines.join('\n')}\n`;
}

export function formatRefundPolicy(locale = 'en') {
	const fr = typeof locale === 'string' && (locale === 'fr' || locale.startsWith('fr'));
	if (fr) {
		return [
			'Remboursement des crédits Kuunda :',
			'- Crédits achetés et non consommés : demande au steward ; traité selon les règles de l’agrégateur de paiement (remboursement Mobile Money).',
			'- Crédits déjà consommés (appels agent / LLM) : non remboursables.',
			'- Si un jour l’achat passe par un store (Play / App Store) : les règles de remboursement de ce store s’appliquent.',
			'- Aucun identifiant de paiement n’est conservé dans l’IDE.',
		].join('\n') + '\n';
	}
	return [
		'Kuunda credit refunds:',
		'- Purchased unused credits: request to the steward; processed under the payment aggregator’s refund rules (Mobile Money reversal).',
		'- Already consumed credits (agent / LLM calls): not refundable.',
		'- If purchase ever goes through a store (Play / App Store): that store’s refund rules apply.',
		'- The IDE never stores payment credentials.',
	].join('\n') + '\n';
}

export function describeLicenseSplit() {
	return {
		publicLicense: 'Apache-2.0',
		inheritedEditorCore: 'MIT',
		proprietaryRepo: 'Arowtech/kuunda-vibe-cloud',
		proprietaryModules: [
			'billing',
			'genius-pay',
			'kuunda-cloud-operator',
			'credits-ledger',
			'update-control-plane',
			'mobile-ci',
			'feedback-plane',
		],
		paymentAggregatorsPluggable: true,
	};
}

export function describeDataSubjectRights() {
	return {
		access: true,
		erasure: true,
		portability: true,
		restriction: true,
		contact: 'https://ide.kuunda-cloud.com/legal',
		note: 'DSR endpoints must exist before public launch; this kernel only documents the obligation.',
	};
}

export function formatDataSubjectRights(locale = 'en') {
	const rights = describeDataSubjectRights();
	const fr = typeof locale === 'string' && (locale === 'fr' || locale.startsWith('fr'));
	if (fr) {
		return `Droits (accès, effacement, portabilité) : ${rights.contact} — le canal DSR réel doit exister avant le lancement public.\n`;
	}
	return `Data-subject rights (access, erasure, portability): ${rights.contact} — a live DSR channel is required before public launch.\n`;
}
