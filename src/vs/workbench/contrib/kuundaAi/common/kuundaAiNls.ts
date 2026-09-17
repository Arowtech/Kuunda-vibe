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
} as const;

export type KuundaAiStringKey = keyof typeof KUUNDA_AI_STRINGS;

function isFrench(language: string | undefined): boolean {
	return typeof language === 'string' && (language === 'fr' || language.startsWith('fr-') || language.startsWith('fr_'));
}

export function kuundaAiLocalize(key: KuundaAiStringKey, ...args: Array<string | number>): string {
	const entry = KUUNDA_AI_STRINGS[key];
	const message = isFrench(getNLSLanguage()) ? entry.fr : entry.en;
	return localize(key, message, ...args);
}

export function kuundaAiLocalize2(key: KuundaAiStringKey): ILocalizedString {
	return { original: KUUNDA_AI_STRINGS[key].en, value: kuundaAiLocalize(key) };
}
