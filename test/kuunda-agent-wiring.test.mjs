import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(relPath) {
	return readFileSync(join(root, relPath), 'utf8');
}

describe('Phase 3 — branchement IDE agent Kuunda', () => {
	it('la boucle Void applique la politique de permission et plafonne les étapes', () => {
		const chat = read('src/vs/workbench/contrib/void/browser/chatThreadService.ts');
		assert.match(chat, /decideToolPermission/);
		assert.match(chat, /getPolicyOverrides/);
		assert.match(chat, /planAgentTurn/);
		assert.match(chat, /planAfterTool/);
		assert.match(chat, /MAX_AGENT_STEPS/);
		assert.match(chat, /IKuundaAgentService/);
		assert.match(chat, /settleThread/);
		assert.match(chat, /cancelThread/);
		assert.match(chat, /_notifyKuundaBackground/);
	});

	it('le contexte chat est compacté avec le budget du modèle', () => {
		const convert = read('src/vs/workbench/contrib/void/browser/convertToLLMMessageService.ts');
		assert.match(convert, /compactChatContext/);
		assert.match(convert, /contextBudgetChars/);
	});

	it('la commande arrière-plan existe et bascule de fil', () => {
		const contrib = read('src/vs/workbench/contrib/kuundaAi/browser/kuundaAi.contribution.ts');
		assert.match(contrib, /kuunda\.agent\.runBackground/);
		assert.match(contrib, /kuunda\.agent\.setPermission/);
		assert.match(contrib, /kuunda\.agent\.reviewJobs/);
		assert.match(contrib, /openNewThread/);
		assert.match(contrib, /switchToThread/);
		assert.match(contrib, /addUserMessageAndStreamResponse/);
	});

	it('BYOK Anthropic / OpenAI / Gemini et Ollama sont branchés au service agent', () => {
		const caps = read('src/vs/workbench/contrib/void/common/modelCapabilities.ts');
		assert.match(caps, /anthropic:\s*\{/);
		assert.match(caps, /openAI:\s*\{/);
		assert.match(caps, /gemini:\s*\{/);
		assert.match(caps, /ollama:\s*\{/);
		const service = read('src/vs/workbench/contrib/kuundaAi/common/kuundaAgentService.ts');
		assert.match(service, /AGENT_PROVIDERS/);
		assert.match(service, /supportedProviders/);
		assert.match(service, /getPolicyOverrides/);
		assert.match(service, /setToolPermission/);
	});

	it('MCP reste branché (service + tools dans le prompt)', () => {
		const mcp = read('src/vs/workbench/contrib/void/common/mcpService.ts');
		assert.match(mcp, /getMCPTools/);
		assert.match(mcp, /callMCPTool/);
		const convert = read('src/vs/workbench/contrib/void/browser/convertToLLMMessageService.ts');
		assert.match(convert, /mcpService\.getMCPTools/);
		const settings = read('src/vs/workbench/contrib/void/browser/react/src/void-settings-tsx/Settings.tsx');
		assert.match(settings, /tab: 'mcp'/);
	});

	it('le mode chat par défaut est agent', () => {
		const settings = read('src/vs/workbench/contrib/void/common/voidSettingsTypes.ts');
		assert.match(settings, /chatMode:\s*'agent'/);
	});
});
