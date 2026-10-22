/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import { applyAcceptedHunks, hunksFromRewrite, type DiffHunk } from './streamingDiff.js';

export type InlineEditPlan = {
	original: string;
	instruction: string;
	hunks: DiffHunk[];
};

export function createInlineEditPlan(req: { original: string; instruction: string; proposed?: string }): InlineEditPlan {
	const original = req.original ?? '';
	const proposed = req.proposed ?? original;
	return {
		original,
		instruction: req.instruction ?? '',
		hunks: hunksFromRewrite(original, proposed),
	};
}

export function applyInlineEdit(plan: InlineEditPlan | undefined, acceptedIds: string[]): string {
	if (!plan) {
		return '';
	}
	if (!acceptedIds || acceptedIds.length === 0) {
		return plan.original;
	}
	return applyAcceptedHunks(plan.original, plan.hunks, acceptedIds);
}

export function rejectInlineEdit(plan: InlineEditPlan | undefined): string {
	return plan?.original ?? '';
}
