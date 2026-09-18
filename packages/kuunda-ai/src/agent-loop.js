/**
 * Phase 3.1 / 3.2 — decision kernel for tool → observation → action.
 * chatThreadService stays the runtime; this file is the testable policy.
 */

export const MAX_AGENT_STEPS = 48;

/**
 * @param {{
 *   step: number,
 *   maxSteps?: number,
 *   hasToolCall: boolean,
 *   permissionAction?: 'run' | 'wait' | 'refuse',
 *   interrupted?: boolean,
 *   background?: boolean,
 * }} state
 */
export function planAgentTurn(state) {
	const maxSteps = state.maxSteps ?? MAX_AGENT_STEPS;
	if (state.interrupted) {
		return { type: 'stop', reason: 'interrupted' };
	}
	if (state.step >= maxSteps) {
		return { type: state.background ? 'needs_review' : 'finish', reason: 'max_steps' };
	}
	if (state.hasToolCall) {
		if (state.permissionAction === 'refuse') return { type: 'refuse_tool' };
		if (state.permissionAction === 'wait') return { type: 'wait_permission' };
		return { type: 'run_tool' };
	}
	if (state.background) {
		return { type: 'needs_review' };
	}
	return { type: 'finish' };
}

/**
 * After a tool observation, either call the LLM again or stop.
 * @param {{ step: number, maxSteps?: number, interrupted?: boolean, background?: boolean }} state
 */
export function planAfterTool(state) {
	const maxSteps = state.maxSteps ?? MAX_AGENT_STEPS;
	if (state.interrupted) {
		return { type: 'stop', reason: 'interrupted' };
	}
	if (state.step + 1 >= maxSteps) {
		return { type: state.background ? 'needs_review' : 'finish', reason: 'max_steps' };
	}
	return { type: 'call_llm' };
}
