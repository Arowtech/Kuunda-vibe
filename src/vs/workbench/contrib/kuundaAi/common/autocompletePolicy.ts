/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

export type AutocompleteMode = 'skip' | 'single-line' | 'multi-line';

export type AutocompleteDecision = {
	mode: AutocompleteMode;
	shouldGenerate: boolean;
	stopSequences: string[];
	maxLines: number;
};

export function lastLine(text: string, lineBreak = '\n'): string {
	const parts = text.split(lineBreak);
	return parts[parts.length - 1] ?? '';
}

export function firstLine(text: string, lineBreak = '\n'): string {
	return text.split(lineBreak)[0] ?? '';
}

export function decideAutocompleteMode(ctx: { prefix: string; suffix: string; justAccepted?: boolean; lineBreak?: string }): AutocompleteDecision {
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

export function postprocessCompletion(generated: string, opts: { suffix?: string; mode?: AutocompleteMode } = {}): string {
	let text = generated ?? '';
	const suffix = opts.suffix ?? '';
	if (opts.mode === 'single-line') {
		text = text.split(/\r?\n/)[0] ?? '';
	}
	const suffixStart = suffix.trim()[0];
	if (suffixStart && text.includes(suffixStart) && `{}()[]<>\`'"`.includes(suffixStart)) {
		const idx = text.indexOf(suffixStart);
		if (idx >= 0) {
			text = text.slice(0, idx);
		}
	}
	return text.replace(/^\n+/, '').replace(/\s+$/g, match => (match.includes('\n') ? '\n' : ''));
}
