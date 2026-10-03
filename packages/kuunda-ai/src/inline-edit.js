/**
 * Ctrl+K inline edit plan: accept / reject / partial apply (Phase 2.2).
 */

import { applyAcceptedHunks, hunksFromRewrite } from './streaming-diff.js';

/**
 * @typedef {object} InlineEditRequest
 * @property {string} original
 * @property {string} instruction
 * @property {string} [proposed]
 *
 * @typedef {object} InlineEditPlan
 * @property {string} original
 * @property {string} instruction
 * @property {import('./streaming-diff.js').DiffHunk[]} hunks
 */

/**
 * @param {InlineEditRequest} req
 * @returns {InlineEditPlan}
 */
export function createInlineEditPlan(req) {
	const original = req.original ?? '';
	const proposed = req.proposed ?? original;
	return {
		original,
		instruction: req.instruction ?? '',
		hunks: hunksFromRewrite(original, proposed),
	};
}

/**
 * @param {InlineEditPlan} plan
 * @param {string[]} acceptedIds
 */
export function applyInlineEdit(plan, acceptedIds) {
	if (!plan) {
		return '';
	}
	if (!acceptedIds || acceptedIds.length === 0) {
		return plan.original;
	}
	if (acceptedIds.length === plan.hunks.length) {
		const last = plan.hunks[plan.hunks.length - 1];
		if (last && acceptedIds.includes(last.id)) {
			return applyAcceptedHunks(plan.original, plan.hunks, acceptedIds);
		}
	}
	return applyAcceptedHunks(plan.original, plan.hunks, acceptedIds);
}

export function rejectInlineEdit(plan) {
	return plan?.original ?? '';
}
