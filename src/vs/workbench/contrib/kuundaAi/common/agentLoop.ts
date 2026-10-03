/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

export const MAX_AGENT_STEPS = 48;

export type AgentTurnPlan =
	| { type: 'run_tool' }
	| { type: 'wait_permission' }
	| { type: 'refuse_tool' }
	| { type: 'call_llm' }
	| { type: 'finish'; reason?: string }
	| { type: 'needs_review'; reason?: string }
	| { type: 'stop'; reason?: string };

export function planAgentTurn(state: {
	step: number;
	maxSteps?: number;
	hasToolCall: boolean;
	permissionAction?: 'run' | 'wait' | 'refuse';
	interrupted?: boolean;
	background?: boolean;
}): AgentTurnPlan {
	const maxSteps = state.maxSteps ?? MAX_AGENT_STEPS;
	if (state.interrupted) {
		return { type: 'stop', reason: 'interrupted' };
	}
	if (state.step >= maxSteps) {
		return { type: state.background ? 'needs_review' : 'finish', reason: 'max_steps' };
	}
	if (state.hasToolCall) {
		if (state.permissionAction === 'refuse') {
			return { type: 'refuse_tool' };
		}
		if (state.permissionAction === 'wait') {
			return { type: 'wait_permission' };
		}
		return { type: 'run_tool' };
	}
	if (state.background) {
		return { type: 'needs_review' };
	}
	return { type: 'finish' };
}

export function planAfterTool(state: {
	step: number;
	maxSteps?: number;
	interrupted?: boolean;
	background?: boolean;
}): AgentTurnPlan {
	const maxSteps = state.maxSteps ?? MAX_AGENT_STEPS;
	if (state.interrupted) {
		return { type: 'stop', reason: 'interrupted' };
	}
	if (state.step + 1 >= maxSteps) {
		return { type: state.background ? 'needs_review' : 'finish', reason: 'max_steps' };
	}
	return { type: 'call_llm' };
}
