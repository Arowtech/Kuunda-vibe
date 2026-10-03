/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

export const MARKERS = {
	search: '<<<<<<< SEARCH',
	divider: '=======',
	replace: '>>>>>>> REPLACE',
	original: '<<<<<<< ORIGINAL',
	final: '>>>>>>> FINAL',
} as const;

export type DiffHunk = {
	id: string;
	search: string;
	replace: string;
	state: 'pending' | 'complete';
};

function nextMarker(text: string, from: number): { index: number; marker: string } | null {
	const candidates = [MARKERS.search, MARKERS.original, MARKERS.divider, MARKERS.replace, MARKERS.final];
	let best = -1;
	let which = '';
	for (const m of candidates) {
		const i = text.indexOf(m, from);
		if (i >= 0 && (best === -1 || i < best)) {
			best = i;
			which = m;
		}
	}
	return best === -1 ? null : { index: best, marker: which };
}

export function parseStreamingDiff(buffer: string): { hunks: DiffHunk[]; hasIncomplete: boolean } {
	const text = buffer ?? '';
	const hunks: DiffHunk[] = [];
	let i = 0;
	let n = 0;
	let hasIncomplete = false;

	while (i < text.length) {
		const start = nextMarker(text, i);
		if (!start || (start.marker !== MARKERS.search && start.marker !== MARKERS.original)) {
			break;
		}
		const searchStart = start.index + start.marker.length;
		const afterNl = text[searchStart] === '\n' ? searchStart + 1 : searchStart;
		const div = text.indexOf(`\n${MARKERS.divider}`, afterNl);
		if (div === -1) {
			hunks.push({ id: `h${n++}`, search: text.slice(afterNl), replace: '', state: 'pending' });
			hasIncomplete = true;
			break;
		}
		const search = text.slice(afterNl, div);
		const replaceStart = div + 1 + MARKERS.divider.length;
		const afterDivNl = text[replaceStart] === '\n' ? replaceStart + 1 : replaceStart;
		const endA = text.indexOf(`\n${MARKERS.replace}`, afterDivNl);
		const endB = text.indexOf(`\n${MARKERS.final}`, afterDivNl);
		const end = [endA, endB].filter(x => x >= 0).sort((a, b) => a - b)[0];
		if (end === undefined) {
			hunks.push({ id: `h${n++}`, search, replace: text.slice(afterDivNl), state: 'pending' });
			hasIncomplete = true;
			break;
		}
		const closer = text.startsWith(`\n${MARKERS.replace}`, end) ? MARKERS.replace : MARKERS.final;
		hunks.push({ id: `h${n++}`, search, replace: text.slice(afterDivNl, end), state: 'complete' });
		i = end + 1 + closer.length;
	}

	return { hunks, hasIncomplete };
}

export function applyAcceptedHunks(original: string, hunks: DiffHunk[], acceptedIds: string[]): string {
	const accept = new Set(acceptedIds ?? []);
	let output = original ?? '';
	for (const hunk of hunks ?? []) {
		if (hunk.state !== 'complete' || !accept.has(hunk.id)) {
			continue;
		}
		if (!hunk.search) {
			output = hunk.replace;
			continue;
		}
		const at = output.indexOf(hunk.search);
		if (at === -1) {
			continue;
		}
		output = output.slice(0, at) + hunk.replace + output.slice(at + hunk.search.length);
	}
	return output;
}

export function hunksFromRewrite(original: string, proposed: string): DiffHunk[] {
	if (original === proposed) {
		return [];
	}
	return [{ id: 'h0', search: original, replace: proposed, state: 'complete' }];
}
