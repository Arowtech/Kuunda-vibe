/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

export const BYOK_PROVIDERS = ['anthropic', 'openAI', 'gemini'] as const;
export const LOCAL_AGENT_PROVIDERS = ['ollama'] as const;
export const AGENT_PROVIDERS = [...BYOK_PROVIDERS, ...LOCAL_AGENT_PROVIDERS] as const;

export function isSupportedAgentProvider(name: string): boolean {
	return (AGENT_PROVIDERS as readonly string[]).includes(name);
}
