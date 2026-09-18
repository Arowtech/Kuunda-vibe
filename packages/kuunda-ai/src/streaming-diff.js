/**
 * Streaming SEARCH/REPLACE parser and hunk apply (Phase 2.2 / 2.4).
 * Accepts Cursor-style markers and Void ORIGINAL/DIVIDER/FINAL markers.
 */

export const MARKERS = {
	search: '<<<<<<< SEARCH',
	divider: '=======',
	replace: '>>>>>>> REPLACE',
	original: '<<<<<<< ORIGINAL',
	final: '>>>>>>> FINAL',
};

/**
 * @typedef {object} DiffHunk
 * @property {string} id
 * @property {string} search
 * @property {string} replace
 * @property {'pending' | 'complete'} state
 *
 * @typedef {object} StreamParseResult
 * @property {DiffHunk[]} hunks
 * @property {boolean} hasIncomplete
 */

function nextMarker(text, from) {
	const candidates = [
		MARKERS.search,
		MARKERS.original,
		MARKERS.divider,
		MARKERS.replace,
		MARKERS.final,
	];
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

/**
 * Parse a (possibly incomplete) streamed buffer into hunks.
 * Completed hunks stay completed as more text arrives (monotonic).
 * @param {string} buffer
 * @returns {StreamParseResult}
 */
export function parseStreamingDiff(buffer) {
	const text = buffer ?? '';
	/** @type {DiffHunk[]} */
	const hunks = [];
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
			hunks.push({
				id: `h${n++}`,
				search: text.slice(afterNl),
				replace: '',
				state: 'pending',
			});
			hasIncomplete = true;
			break;
		}
		const search = text.slice(afterNl, div);
		const replaceStart = div + 1 + MARKERS.divider.length;
		const afterDivNl = text[replaceStart] === '\n' ? replaceStart + 1 : replaceStart;
		const endA = text.indexOf(`\n${MARKERS.replace}`, afterDivNl);
		const endB = text.indexOf(`\n${MARKERS.final}`, afterDivNl);
		const end = [endA, endB].filter((x) => x >= 0).sort((a, b) => a - b)[0];
		if (end === undefined) {
			hunks.push({
				id: `h${n++}`,
				search,
				replace: text.slice(afterDivNl),
				state: 'pending',
			});
			hasIncomplete = true;
			break;
		}
		const closer = text.startsWith(`\n${MARKERS.replace}`, end) ? MARKERS.replace : MARKERS.final;
		hunks.push({
			id: `h${n++}`,
			search,
			replace: text.slice(afterDivNl, end),
			state: 'complete',
		});
		i = end + 1 + closer.length;
	}

	return { hunks, hasIncomplete };
}

export function createDiffStreamParser() {
	let buffer = '';
	return {
		/**
		 * @param {string} chunk
		 */
		push(chunk) {
			buffer += chunk ?? '';
			return parseStreamingDiff(buffer);
		},
		snapshot() {
			return parseStreamingDiff(buffer);
		},
	};
}

/**
 * Apply a subset of complete hunks. Rejected hunks leave the original slice.
 * @param {string} original
 * @param {DiffHunk[]} hunks
 * @param {string[]} acceptedIds
 */
export function applyAcceptedHunks(original, hunks, acceptedIds) {
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

/**
 * @param {string} original
 * @param {string} proposed
 * @returns {DiffHunk[]}
 */
export function hunksFromRewrite(original, proposed) {
	if (original === proposed) {
		return [];
	}
	return [
		{
			id: 'h0',
			search: original,
			replace: proposed,
			state: 'complete',
		},
	];
}
