import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(relPath) {
	return readFileSync(join(root, relPath), 'utf8');
}

describe('Phase 8 — branchement sécurité / fiabilité', () => {
	it('la boucle agent passe production-adjacent et réécrit le cd persisté', () => {
		const chat = read('src/vs/workbench/contrib/void/browser/chatThreadService.ts');
		assert.match(chat, /isProductionAdjacent/);
		assert.match(chat, /rewritePersistentShell/);
		assert.match(chat, /run_persistent_command/);
		assert.match(chat, /productionAdjacent/);
		const service = read('src/vs/workbench/contrib/kuundaAi/common/kuundaAgentService.ts');
		assert.match(service, /isProductionAdjacent/);
		assert.match(service, /setProductionAdjacent/);
		assert.match(service, /PRODUCTION_ADJACENT_DEFAULT/);
	});

	it('les appels plateforme ont un timeout', () => {
		const http = read('packages/cloud-client/src/http-client.js');
		assert.match(http, /fetchWithTimeout/);
		assert.match(http, /timeoutMs/);
		const billing = read('src/vs/workbench/contrib/kuundaBilling/common/kuundaBillingService.ts');
		assert.match(billing, /fetchWithTimeout/);
		assert.match(billing, /notifyNetwork/);
		const cloud = read('src/vs/workbench/contrib/kuundaCloud/common/kuundaCloudService.ts');
		assert.match(cloud, /fetchWithTimeout/);
		assert.match(cloud, /classifyNetworkError/);
		const cloudUi = read('src/vs/workbench/contrib/kuundaCloud/browser/kuundaCloud.contribution.ts');
		assert.match(cloudUi, /kuunda\.cloud\.network\.timeout/);
		assert.match(cloudUi, /kuunda\.cloud\.network\.offline/);
		const publish = read('src/vs/workbench/contrib/kuundaPublish/common/kuundaPublishService.ts');
		assert.match(publish, /fetchWithTimeout/);
		assert.match(publish, /ok: false, error: api\.error/);
		const publishUi = read('src/vs/workbench/contrib/kuundaPublish/browser/kuundaPublish.contribution.ts');
		assert.match(publishUi, /kuunda\.publish\.network\.timeout/);
		assert.match(publishUi, /kuunda\.publish\.network\.offline/);
	});

	it('le gitignore racine couvre les secrets 8.1', () => {
		const gitignore = read('.gitignore');
		for (const entry of [
			'.env',
			'.env.*',
			'*.pem',
			'*.p12',
			'*.key',
			'*.p8',
			'*.keystore',
			'credentials.json',
			'.kuunda/cloud.local.json',
			'.kuunda/publish.local.json',
			'.kuunda/play-service-account.json',
			'.kuunda/authkey.p8',
			'.kuunda/upload.keystore',
		]) {
			assert.ok(gitignore.split(/\r?\n/).includes(entry), entry);
		}
	});

	it('la commande F1 production-adjacent existe', () => {
		const contrib = read('src/vs/workbench/contrib/kuundaAi/browser/kuundaAi.contribution.ts');
		assert.match(contrib, /kuunda\.agent\.setProductionAdjacent/);
		assert.match(contrib, /setProductionAdjacent/);
		assert.match(contrib, /kuunda\.terminal\.allowBlocked/);
	});

	it('chaque nouvelle clé nls Phase 8 a en et fr distincts', () => {
		const strings = JSON.parse(read('src/vs/workbench/contrib/kuundaAi/common/strings.json'));
		const nlsSrc = read('src/vs/workbench/contrib/kuundaAi/common/kuundaAiNls.ts');
		for (const key of [
			'kuunda.agent.setProductionAdjacent',
			'kuunda.agent.setProductionAdjacent.level',
			'kuunda.agent.setProductionAdjacent.on',
			'kuunda.agent.setProductionAdjacent.off',
			'kuunda.terminal.allowBlocked',
		]) {
			assert.ok(strings[key].en && strings[key].fr);
			assert.notEqual(strings[key].en, strings[key].fr, key);
			assert.ok(nlsSrc.includes(strings[key].en), `${key} en manquant`);
			assert.ok(nlsSrc.includes(strings[key].fr), `${key} fr manquant`);
		}
		const billing = JSON.parse(read('src/vs/workbench/contrib/kuundaBilling/common/strings.json'));
		const billingNls = read('src/vs/workbench/contrib/kuundaBilling/common/kuundaBillingNls.ts');
		for (const key of ['kuunda.billing.network.timeout', 'kuunda.billing.network.offline']) {
			assert.notEqual(billing[key].en, billing[key].fr, key);
			assert.ok(billingNls.includes(billing[key].en));
		}
		const cloud = JSON.parse(read('src/vs/workbench/contrib/kuundaCloud/common/strings.json'));
		const cloudNls = read('src/vs/workbench/contrib/kuundaCloud/common/kuundaCloudNls.ts');
		for (const key of ['kuunda.cloud.network.timeout', 'kuunda.cloud.network.offline']) {
			assert.notEqual(cloud[key].en, cloud[key].fr, key);
			assert.ok(cloudNls.includes(cloud[key].en));
		}
		const publish = JSON.parse(read('src/vs/workbench/contrib/kuundaPublish/common/strings.json'));
		const publishNls = read('src/vs/workbench/contrib/kuundaPublish/common/kuundaPublishNls.ts');
		for (const key of ['kuunda.publish.network.timeout', 'kuunda.publish.network.offline']) {
			assert.notEqual(publish[key].en, publish[key].fr, key);
			assert.ok(publishNls.includes(publish[key].en));
		}
	});
});
