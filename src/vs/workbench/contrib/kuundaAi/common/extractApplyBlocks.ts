/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import { extractSearchReplaceBlocks, type ExtractedSearchReplaceBlock } from '../../void/common/helpers/extractCodeFromResult.js';
import { parseStreamingDiff } from './streamingDiff.js';

/**
 * Void ORIGINAL/FINAL first; Cursor SEARCH/REPLACE if Void found nothing.
 */
export function extractApplyBlocks(fullText: string): ExtractedSearchReplaceBlock[] {
	const voidBlocks = extractSearchReplaceBlocks(fullText);
	if (voidBlocks.length > 0) {
		return voidBlocks;
	}
	const { hunks } = parseStreamingDiff(fullText);
	return hunks.map(hunk => ({
		orig: hunk.search,
		final: hunk.replace,
		state: hunk.state === 'complete' ? 'done' as const : hunk.replace ? 'writingFinal' as const : 'writingOriginal' as const,
	}));
}
