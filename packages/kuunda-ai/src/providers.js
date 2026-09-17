/**
 * Phase 3.5 — BYOK providers required for agent mode, plus local Ollama.
 * Provider keys stay in Void settings, never in this package.
 */

export const BYOK_PROVIDERS = Object.freeze(['anthropic', 'openAI', 'gemini']);
export const LOCAL_AGENT_PROVIDERS = Object.freeze(['ollama']);
export const AGENT_PROVIDERS = Object.freeze([...BYOK_PROVIDERS, ...LOCAL_AGENT_PROVIDERS]);

export function isSupportedAgentProvider(name) {
	return AGENT_PROVIDERS.includes(name);
}
