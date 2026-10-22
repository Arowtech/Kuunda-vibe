/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

/**
 * Per-request Auto router.
 * A cheap turn stays on the included model. A normal coding turn uses the
 * standard model. A hard turn uses the frontier model. Chat mode is one
 * signal among the latest user text, conversation depth, and recent tool calls.
 */

const EFFICIENT_MODEL = 'poolside/laguna-xs-2.1:free'
const STANDARD_MODEL = 'deepseek/deepseek-v4.1-flash'
const LONG_CONTEXT_MODEL = 'z-ai/glm-5.3-flash'
const FRONTIER_MODEL = 'anthropic/claude-sonnet-5'

const HARD_TASK = /\b(refactor|architect|architecture|migrate|migration|rewrite|from scratch|whole (codebase|repo|project)|multi-file|security audit|race condition|deadlock|redesign)\b|refacto|architecture|migrer|réécris|reecris|tout le (projet|depot|dépôt|codebase)/i
const DEBUG_TASK = /\b(stack trace|traceback|exception|bug|failing test|error:|crash|segfault)\b|erreur|plantage|échoue|echoue/i
const LONG_CONTEXT_TASK = /\b(long context|large file|entire file|ui|layout|css|interface)\b|contexte long|fichier entier|interface/i
const ACTION_TASK = /\b(implement|fix|create|add|update|build|edit|write)\b|implémente|implemente|corrige|ajoute|crée|cree|modifie/i

function textFromUnknown(value: unknown): string {
	if (typeof value === 'string') return value
	if (Array.isArray(value)) return value.map(textFromUnknown).join('\n')
	if (!value || typeof value !== 'object') return ''
	const record = value as Record<string, unknown>
	if (typeof record.text === 'string') return record.text
	if ('content' in record) return textFromUnknown(record.content)
	if ('parts' in record) return textFromUnknown(record.parts)
	return ''
}

function isToolMessage(message: Record<string, unknown>): boolean {
	if (message.role === 'tool') return true
	if (Array.isArray(message.tool_calls) && message.tool_calls.length > 0) return true
	if (Array.isArray(message.parts) && message.parts.some(part => part && typeof part === 'object' && ('functionCall' in (part as object) || 'functionResponse' in (part as object)))) return true
	if (Array.isArray(message.content) && message.content.some(part => part && typeof part === 'object' && (('type' in (part as object) && ((part as { type?: string }).type === 'tool_use' || (part as { type?: string }).type === 'tool_result'))))) return true
	return false
}

export function resolveKuundaAutoModel(chatMode: string | null | undefined, messages: readonly unknown[] | undefined): string {
	const list = Array.isArray(messages) ? messages : []
	const records = list.filter((message): message is Record<string, unknown> => !!message && typeof message === 'object')
	const userTexts = records
		.filter(message => message.role === 'user')
		.map(message => textFromUnknown(message.content ?? message.parts))
		.filter(text => text.trim().length > 0)
	const latest = userTexts[userTexts.length - 1] ?? ''
	const toolTurns = records.filter(isToolMessage).length
	const chars = latest.length

	let complexity = 0
	if (chars > 280) complexity += 1
	if (chars > 1200) complexity += 2
	if (chars > 4000) complexity += 2
	if (userTexts.length >= 4) complexity += 1
	if (toolTurns >= 2) complexity += 1
	if (toolTurns >= 6) complexity += 2
	if (HARD_TASK.test(latest)) complexity += 3
	if (DEBUG_TASK.test(latest)) complexity += 2
	if (chatMode === 'debug' && chars > 80) complexity += 1
	if ((chatMode === 'agent' || chatMode === 'debug') && toolTurns >= 1) complexity += 1

	const simpleTurn = complexity <= 1 && chars < 240 && toolTurns === 0 && !ACTION_TASK.test(latest) && !HARD_TASK.test(latest) && !DEBUG_TASK.test(latest) && !LONG_CONTEXT_TASK.test(latest)
	if (simpleTurn) return EFFICIENT_MODEL
	if (LONG_CONTEXT_TASK.test(latest) && complexity < 5) return LONG_CONTEXT_MODEL
	if (complexity >= 5) return FRONTIER_MODEL
	return STANDARD_MODEL
}
