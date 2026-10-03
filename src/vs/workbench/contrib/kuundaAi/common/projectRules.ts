/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

export const PROJECT_RULE_FILENAMES = ['.projectrules', '.kuunda/rules', '.voidrules'] as const;
export const MAX_PROJECT_RULES_CHARS = 20_000;

export type ProjectRuleFile = {
	folderName: string;
	fileName: string;
	content: string;
};

export function collectProjectRules(files: ProjectRuleFile[]): ProjectRuleFile[] {
	return (files || [])
		.map((file) => ({
			folderName: String(file.folderName || ''),
			fileName: String(file.fileName || ''),
			content: String(file.content || '').trim(),
		}))
		.filter((file) => file.content);
}

export function formatProjectRules(files: ProjectRuleFile[], opts: { maxChars?: number } = {}): string {
	const maxChars = opts.maxChars ?? MAX_PROJECT_RULES_CHARS;
	const entries = collectProjectRules(files);
	if (!entries.length) {
		return '';
	}
	const body = entries
		.map((file) => `### ${file.folderName}/${file.fileName}\n${file.content}`)
		.join('\n\n');
	const out = `Project rules:\n${body}`;
	if (out.length <= maxChars) {
		return out;
	}
	return `${out.slice(0, maxChars)}\n…`;
}
