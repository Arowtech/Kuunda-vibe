import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(relPath) {
	return readFileSync(join(root, relPath), 'utf8');
}

describe('Phase 4 — branchement terminal / git / rules', () => {
	it('l’agent refuse un cwd hors workspace', () => {
		const chat = read('src/vs/workbench/contrib/void/browser/chatThreadService.ts');
		assert.match(chat, /IKuundaWorkspaceService/);
		assert.match(chat, /resolveAgentCwd/);
		assert.match(chat, /outside_workspace/);
		assert.match(chat, /run_command/);
		assert.match(chat, /open_persistent_terminal/);
		assert.match(chat, /command/);
		assert.match(chat, /bindAgentTerminalCwd/);
		assert.ok(
			chat.indexOf('bindAgentTerminalCwd') < chat.indexOf('awaitingUserApproval: true'),
			'cwd hors workspace doit être refusé avant la confirmation',
		);
	});

	it('le prompt charge rules + git + multi-root', () => {
		const convert = read('src/vs/workbench/contrib/void/browser/convertToLLMMessageService.ts');
		assert.match(convert, /formatDevContext/);
		assert.match(convert, /ensureRules/);
		assert.match(convert, /getCachedRulesText/);
		const service = read('src/vs/workbench/contrib/kuundaAi/common/kuundaWorkspaceService.ts');
		assert.match(service, /PROJECT_RULE_FILENAMES/);
		assert.match(service, /gitBranch/);
		assert.match(service, /gitStatus/);
		assert.match(service, /rulesReady/);
		assert.match(service, /scmService/);
		assert.match(service, /formatWorkspaceRoots/);
		assert.match(service, /primeRuleModels/);
		assert.match(service, /watchRuleModel/);
		assert.match(service, /fileService\.exists/);
		const scm = read('src/vs/workbench/contrib/void/common/voidSCMTypes.ts');
		assert.match(scm, /gitStatus/);
		const rules = read('src/vs/workbench/contrib/kuundaAi/common/projectRules.ts');
		assert.match(rules, /\.projectrules/);
		const prompts = read('src/vs/workbench/contrib/void/common/prompt/prompts.ts');
		assert.match(prompts, /MUST stay inside a workspace folder/);
	});

	it('les terminaux persistants s’appellent Kuunda Agent', () => {
		const term = read('src/vs/workbench/contrib/void/browser/terminalToolService.ts');
		assert.match(term, /Kuunda Agent/);
		assert.match(term, /Void Agent/);
		assert.match(term, /Number\(match\[1\]\)/);
	});

	it('les commandes F1 terminal / rules / git existent', () => {
		const contrib = read('src/vs/workbench/contrib/kuundaAi/browser/kuundaAi.contribution.ts');
		assert.match(contrib, /kuunda\.terminal\.setAccess/);
		assert.match(contrib, /setTerminalAccess/);
		assert.match(contrib, /kuunda\.dev\.reloadRules/);
		assert.match(contrib, /kuunda\.git\.showStatus/);
		const settings = read('src/vs/workbench/contrib/void/browser/react/src/void-settings-tsx/Settings.tsx');
		assert.match(settings, /\.projectrules/);
		const sidebar = read('src/vs/workbench/contrib/void/browser/react/src/sidebar-tsx/SidebarChat.tsx');
		assert.match(sidebar, /Create a \.projectrules file for me/);
	});

	it('chaque nouvelle clé nls Phase 4 a en et fr distincts', () => {
		const strings = JSON.parse(read('src/vs/workbench/contrib/kuundaAi/common/strings.json'));
		const nlsSrc = read('src/vs/workbench/contrib/kuundaAi/common/kuundaAiNls.ts');
		for (const key of [
			'kuunda.terminal.setAccess',
			'kuunda.dev.reloadRules',
			'kuunda.git.showStatus',
		]) {
			assert.ok(strings[key].en && strings[key].fr);
			assert.notEqual(strings[key].en, strings[key].fr);
			assert.ok(nlsSrc.includes(strings[key].en), `${key} en manquant`);
			assert.ok(nlsSrc.includes(strings[key].fr), `${key} fr manquant`);
		}
	});
});
