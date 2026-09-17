import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(relPath) {
	return readFileSync(join(root, relPath), 'utf8');
}

describe('Phase 8bis — branchement conformité / légal', () => {
	it('workbench charge kuundaLegal isolé', () => {
		const main = read('src/vs/workbench/workbench.common.main.ts');
		assert.match(main, /contrib\/kuundaLegal\/browser\/kuundaLegal\.contribution\.js/);
	});

	it('le hors-ligne strict coupe billing, cloud, publish, LLM (Tab/Ctrl+K) et MCP', () => {
		const chat = read('src/vs/workbench/contrib/void/browser/chatThreadService.ts');
		assert.match(chat, /IKuundaLegalService/);
		assert.match(chat, /decideSend\('llm_cloud'/);
		assert.match(chat, /kuunda\.legal\.offline\.blocked/);
		assert.match(chat, /isStrictOffline/);
		assert.match(chat, /strictOffline: this\._kuundaLegal\.isStrictOffline\(\)/);
		const llm = read('src/vs/workbench/contrib/void/common/sendLLMMessageService.ts');
		assert.match(llm, /decideSend\('llm_cloud'/);
		assert.match(llm, /isStrictOffline\(\) \? \[\]/);
		const mcp = read('src/vs/workbench/contrib/void/common/mcpService.ts');
		assert.match(mcp, /isStrictOffline\(\)/);
		assert.match(mcp, /strict_offline/);
		const billing = read('src/vs/workbench/contrib/kuundaBilling/common/kuundaBillingService.ts');
		assert.match(billing, /decideSend\('credits'\)/);
		assert.match(billing, /decideSend\('billing'\)/);
		const cloud = read('src/vs/workbench/contrib/kuundaCloud/common/kuundaCloudService.ts');
		assert.match(cloud, /strict_offline/);
		assert.match(cloud, /decideSend\('kuunda_cloud'\)/);
		const publish = read('src/vs/workbench/contrib/kuundaPublish/common/kuundaPublishService.ts');
		assert.match(publish, /strict_offline/);
		assert.match(publish, /decideSend\('publish'\)/);
		const contrib = read('src/vs/workbench/contrib/kuundaLegal/browser/kuundaLegal.contribution.ts');
		assert.match(contrib, /kuunda\.legal\.setOfflineMode/);
		assert.match(contrib, /kuunda\.legal\.showPrivacy/);
		assert.match(contrib, /kuunda\.legal\.showRefunds/);
		assert.match(contrib, /kuunda\.legal\.firstRun/);
		const legal = read('src/vs/workbench/contrib/kuundaLegal/common/kuundaLegalService.ts');
		assert.match(legal, /formatDataSubjectRights/);
		assert.match(legal, /disclosureSeen/);
	});

	it('les politiques utilisateur existent et ne figent pas un seul PSP', () => {
		for (const file of [
			'docs/legal/PRIVACY-POLICY.md',
			'docs/legal/TERMS-OF-USE.md',
			'docs/legal/REFUND-POLICY.md',
			'docs/legal/GDPR-AND-LOCAL.md',
			'docs/legal/STORE-REQUIREMENTS.md',
			'docs/legal/PAYMENT-AGGREGATORS.md',
			'docs/codebase/08bis-legal.md',
		]) {
			const text = read(file);
			assert.ok(text.trim().length > 200, file);
		}
		assert.match(read('docs/legal/PAYMENT-AGGREGATORS.md'), /pluggable|remplaçable|autres/i);
		assert.match(read('packages/kuunda-ai/src/legal-policy.js'), /payment_aggregator/);
		assert.doesNotMatch(read('src/vs/workbench/contrib/kuundaLegal/common/strings.json'), /geniuspay\.ci/);
	});

	it('chaque clé nls kuundaLegal a en et fr distincts', () => {
		const strings = JSON.parse(read('src/vs/workbench/contrib/kuundaLegal/common/strings.json'));
		const nlsSrc = read('src/vs/workbench/contrib/kuundaLegal/common/kuundaLegalNls.ts');
		for (const [key, value] of Object.entries(strings)) {
			assert.match(key, /^kuunda\.legal\./);
			assert.ok(value.en && value.fr);
			assert.notEqual(value.en, value.fr, key);
			assert.ok(nlsSrc.includes(value.en), `${key} en manquant`);
			assert.ok(nlsSrc.includes(value.fr), `${key} fr manquant`);
		}
	});
});
