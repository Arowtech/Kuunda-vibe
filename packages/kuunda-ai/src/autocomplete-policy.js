/**
 * Tab / FIM policy for Kuunda Vibe (Phase 2.1).
 * Isolated from Void autocompleteService; that file stays rebase-able.
 *
 * Default is multi-line when the rest of the current line is empty.
 * Mid-line completions stay single-line so ghost text does not jump the suffix.
 */

/**
 * @typedef {'skip' | 'single-line' | 'multi-line'} AutocompleteMode
 *
 * @typedef {object} AutocompleteContext
 * @property {string} prefix
 * @property {string} suffix
 * @property {boolean} [justAccepted]
 * @property {string} [lineBreak]
 *
 * @typedef {object} AutocompleteDecision
 * @property {AutocompleteMode} mode
 * @property {boolean} shouldGenerate
 * @property {string[]} stopSequences
 * @property {number} maxLines
 */

const IDENT_OR_WORD = /[A-Za-z0-9_]+/g;

export function lastLine(text, lineBreak = '\n') {
	const parts = text.split(lineBreak);
	return parts[parts.length - 1] ?? '';
}

export function firstLine(text, lineBreak = '\n') {
	return (text.split(lineBreak)[0] ?? '');
}

/**
 * @param {AutocompleteContext} ctx
 * @returns {AutocompleteDecision}
 */
export function decideAutocompleteMode(ctx) {
	const lineBreak = ctx.lineBreak ?? '\n';
	const prefixLine = lastLine(ctx.prefix ?? '', lineBreak);
	const suffixLine = firstLine(ctx.suffix ?? '', lineBreak);
	const suffixRestEmpty = suffixLine.trim().length === 0;
	const prefixLineEmpty = prefixLine.trim().length === 0;
	const lineEmpty = prefixLineEmpty && suffixRestEmpty;

	if (ctx.justAccepted && suffixRestEmpty) {
		return { mode: 'multi-line', shouldGenerate: true, stopSequences: [`${lineBreak}${lineBreak}`], maxLines: 12 };
	}
	if (lineEmpty) {
		return { mode: 'multi-line', shouldGenerate: true, stopSequences: [`${lineBreak}${lineBreak}`], maxLines: 12 };
	}
	if (!suffixRestEmpty && suffixLine.trim().length > 3) {
		return { mode: 'single-line', shouldGenerate: true, stopSequences: [lineBreak, '\r\n'], maxLines: 1 };
	}
	if (!prefixLineEmpty && suffixRestEmpty) {
		return { mode: 'multi-line', shouldGenerate: true, stopSequences: [`${lineBreak}${lineBreak}`], maxLines: 8 };
	}
	if (!prefixLineEmpty) {
		return { mode: 'single-line', shouldGenerate: true, stopSequences: [lineBreak, '\r\n'], maxLines: 1 };
	}
	return { mode: 'skip', shouldGenerate: false, stopSequences: [], maxLines: 0 };
}

/**
 * Trim ghost-text so it does not duplicate the suffix or dump extra closers.
 * @param {string} generated
 * @param {{ suffix?: string, mode?: AutocompleteMode }} [opts]
 */
export function postprocessCompletion(generated, opts = {}) {
	let text = generated ?? '';
	const suffix = opts.suffix ?? '';
	if (opts.mode === 'single-line') {
		text = text.split(/\r?\n/)[0] ?? '';
	}
	const suffixStart = suffix.trim()[0];
	if (suffixStart && text.includes(suffixStart) && '{}()[]<>`\'"'.includes(suffixStart)) {
		const idx = text.indexOf(suffixStart);
		if (idx >= 0) {
			text = text.slice(0, idx);
		}
	}
	return text.replace(/^\n+/, '').replace(/\s+$/g, match => (match.includes('\n') ? '\n' : ''));
}

export function tokenizeForCache(prefix) {
	return (prefix ?? '').replace(/\s+$/g, '\n');
}

export function extractIdentifiers(text) {
	return (text ?? '').match(IDENT_OR_WORD) ?? [];
}
