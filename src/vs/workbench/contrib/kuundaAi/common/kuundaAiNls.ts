/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import { getNLSLanguage, type ILocalizedString } from '../../../../nls.js';
import { formatKuundaMessage } from '../../kuundaBrand/common/kuundaNls.js';

export const KUUNDA_AI_STRINGS = {
	'kuunda.ai.tagline': {
		en: 'Code completion, inline edit, codebase chat, and streaming diffs.',
		fr: 'Complétion de code, édition inline, chat codebase et diffs en flux.',
	},
	'kuunda.ai.reindex': {
		en: 'Kuunda Vibe: Reindex Codebase',
		fr: 'Kuunda Vibe : réindexer le codebase',
	},
	'kuunda.agent.tagline': {
		en: 'Autonomous agent: tools, permissions, long context, background review.',
		fr: 'Agent autonome : outils, permissions, long contexte, revue en arrière-plan.',
	},
	'kuunda.agent.background': {
		en: 'Kuunda Vibe: Run Agent in Background',
		fr: 'Kuunda Vibe : lancer l’agent en arrière-plan',
	},
	'kuunda.agent.background.prompt': {
		en: 'What should the agent do in the background?',
		fr: 'Que doit faire l’agent en arrière-plan ?',
	},
	'kuunda.agent.background.started': {
		en: 'Background agent started. You will get a reviewable diff when it finishes.',
		fr: 'Agent d’arrière-plan lancé. Un diff à revoir sera proposé à la fin.',
	},
	'kuunda.agent.background.empty': {
		en: 'Enter a task for the background agent.',
		fr: 'Saisissez une tâche pour l’agent d’arrière-plan.',
	},
	'kuunda.agent.needsPermission': {
		en: 'Background agent is waiting for your approval.',
		fr: 'L’agent d’arrière-plan attend votre approbation.',
	},
	'kuunda.agent.needsReview': {
		en: 'Background agent finished. Review the diff ({0} file(s)).',
		fr: 'Agent d’arrière-plan terminé. Relisez le diff ({0} fichier(s)).',
	},
	'kuunda.agent.failed': {
		en: 'Background agent failed: {0}',
		fr: 'L’agent d’arrière-plan a échoué : {0}',
	},
	'kuunda.agent.jump': {
		en: 'Jump to agent',
		fr: 'Aller à l’agent',
	},
	'kuunda.agent.setPermission': {
		en: 'Kuunda Vibe: Set Agent Tool Permission',
		fr: 'Kuunda Vibe : définir la permission d’un outil agent',
	},
	'kuunda.agent.setPermission.tool': {
		en: 'Which tool permission should change?',
		fr: 'Quelle permission d’outil modifier ?',
	},
	'kuunda.agent.setPermission.level': {
		en: 'Permission level',
		fr: 'Niveau de permission',
	},
	'kuunda.agent.reviewJobs': {
		en: 'Kuunda Vibe: Review Background Agent Diff',
		fr: 'Kuunda Vibe : relire le diff de l’agent d’arrière-plan',
	},
	'kuunda.agent.reviewJobs.empty': {
		en: 'No background agent diff is waiting for review.',
		fr: 'Aucun diff d’agent d’arrière-plan n’attend de relecture.',
	},
	'kuunda.terminal.setAccess': {
		en: 'Kuunda Vibe: Set Agent Terminal Access',
		fr: 'Kuunda Vibe : définir l’accès terminal de l’agent',
	},
	'kuunda.terminal.setAccess.level': {
		en: 'Terminal access for the agent (default: confirm; production-adjacent ignores auto-run)',
		fr: 'Accès terminal de l’agent (défaut : confirm ; le mode production-adjacent ignore l’exécution automatique)',
	},
	'kuunda.agent.setProductionAdjacent': {
		en: 'Kuunda Vibe: Set Production-Adjacent Agent Mode',
		fr: 'Kuunda Vibe : définir le mode agent production-adjacent',
	},
	'kuunda.agent.setProductionAdjacent.level': {
		en: 'Production-adjacent mode (default: on — shell always asks first)',
		fr: 'Mode production-adjacent (défaut : activé — le shell demande toujours confirmation)',
	},
	'kuunda.agent.setProductionAdjacent.on': {
		en: 'On (confirm every shell command)',
		fr: 'Activé (confirmer chaque commande shell)',
	},
	'kuunda.agent.setProductionAdjacent.off': {
		en: 'Off (local sandbox — auto-approve terminal is allowed)',
		fr: 'Désactivé (bac à sable local — l’auto-approbation du terminal est autorisée)',
	},
	'kuunda.terminal.allowBlocked': {
		en: 'Production-adjacent mode is on, so the agent still asks before every shell command.',
		fr: 'Le mode production-adjacent est activé : l’agent demande encore confirmation avant chaque commande shell.',
	},
	'kuunda.dev.reloadRules': {
		en: 'Kuunda Vibe: Reload Project Rules',
		fr: 'Kuunda Vibe : recharger les règles de projet',
	},
	'kuunda.dev.reloadRules.none': {
		en: 'No .projectrules (or .kuunda/rules / .voidrules) found in the workspace.',
		fr: 'Aucun fichier .projectrules (ni .kuunda/rules / .voidrules) dans l’espace de travail.',
	},
	'kuunda.dev.reloadRules.ok': {
		en: 'Project rules reloaded.',
		fr: 'Règles de projet rechargées.',
	},
	'kuunda.git.showStatus': {
		en: 'Kuunda Vibe: Show Workspace Git Status',
		fr: 'Kuunda Vibe : afficher le statut Git des dossiers',
	},
	'kuunda.git.showStatus.none': {
		en: 'No git repository in the open workspace folders.',
		fr: 'Aucun dépôt Git dans les dossiers ouverts.',
	},
} as const;

export type KuundaAiStringKey = keyof typeof KUUNDA_AI_STRINGS;

function isFrench(language: string | undefined): boolean {
	return typeof language === 'string' && (language === 'fr' || language.startsWith('fr-') || language.startsWith('fr_'));
}

export function kuundaAiLocalize(key: KuundaAiStringKey, ...args: Array<string | number>): string {
	const entry = KUUNDA_AI_STRINGS[key];
	const message = isFrench(getNLSLanguage()) ? entry.fr : entry.en;
	return formatKuundaMessage(message, args);
}

export function kuundaAiLocalize2(key: KuundaAiStringKey): ILocalizedString {
	return { original: KUUNDA_AI_STRINGS[key].en, value: kuundaAiLocalize(key) };
}
