/**
 * Phase 4.4 — project rules files (.projectrules, plus Void/Kuunda aliases).
 */

export const PROJECT_RULE_FILENAMES = Object.freeze([
	'.projectrules',
	'.kuunda/rules',
	'.voidrules',
]);

export const MAX_PROJECT_RULES_CHARS = 20_000;

/**
 * @param {{ folderName: string, fileName: string, content: string }[]} files
 */
export function collectProjectRules(files) {
	return (files || [])
		.map((file) => ({
			folderName: String(file.folderName || ''),
			fileName: String(file.fileName || ''),
			content: String(file.content || '').trim(),
		}))
		.filter((file) => file.content);
}

/**
 * @param {{ folderName: string, fileName: string, content: string }[]} files
 * @param {{ maxChars?: number }} [opts]
 */
export function formatProjectRules(files, opts = {}) {
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
