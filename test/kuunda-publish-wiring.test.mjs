import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(relPath) {
	return readFileSync(join(root, relPath), 'utf8');
}

describe('Phase 7 — branchement publication mobile', () => {
	it('workbench charge kuundaPublish isolé', () => {
		const main = read('src/vs/workbench/workbench.common.main.ts');
		assert.match(main, /contrib\/kuundaPublish\/browser\/kuundaPublish\.contribution\.js/);
		assert.match(main, /contrib\/kuundaCloud\/browser\/kuundaCloud\.contribution\.js/);
	});

	it('le panneau n’est visible que pour mobile et n’embarque pas de secret store', () => {
		const contrib = read('src/vs/workbench/contrib/kuundaPublish/browser/kuundaPublish.contribution.ts');
		assert.match(contrib, /kuunda\.publish\.visible/);
		assert.match(contrib, /kuunda\.publish\.start/);
		assert.match(contrib, /kuunda\.publish\.configurePlay/);
		assert.match(contrib, /showOpenDialog/);
		assert.match(contrib, /KUUNDA_PUBLISH_VIEW_ID/);
		assert.doesNotMatch(contrib, /service_role|sk_live_|whsec_|BEGIN PRIVATE KEY/);
		const service = read('src/vs/workbench/contrib/kuundaPublish/common/kuundaPublishService.ts');
		assert.match(service, /startPublish/);
		assert.match(service, /PUBLISH_PLAY_JSON_PATH/);
		assert.match(service, /lastPublicStatus/);
		assert.match(service, /ensureScaffold/);
		assert.match(service, /verifyPublishFiles/);
		assert.match(service, /sanitizePublishError/);
		assert.doesNotMatch(service, /GITHUB_DISPATCH_TOKEN/);
		const gitignore = read('.gitignore');
		assert.match(gitignore, /\.kuunda\/play-service-account\.json/);
		assert.match(gitignore, /\.kuunda\/authkey\.p8/);
		const ext = read('src/vs/workbench/contrib/kuundaExt/common/kuundaExtService.ts');
		assert.match(ext, /publish\.status/);
		assert.match(ext, /lastPublicStatus/);
		const convert = read('src/vs/workbench/contrib/void/browser/convertToLLMMessageService.ts');
		assert.match(convert, /IKuundaPublishService/);
		assert.match(convert, /kuundaPublishService\.formatContext/);
	});

	it('chaque clé nls Phase 7 a en et fr distincts', () => {
		const strings = JSON.parse(read('src/vs/workbench/contrib/kuundaPublish/common/strings.json'));
		const nlsSrc = read('src/vs/workbench/contrib/kuundaPublish/common/kuundaPublishNls.ts');
		for (const [key, value] of Object.entries(strings)) {
			assert.match(key, /^kuunda\.publish\./);
			assert.ok(value.en && value.fr);
			assert.notEqual(value.en, value.fr, key);
			assert.ok(nlsSrc.includes(value.en), `${key} en manquant`);
			assert.ok(nlsSrc.includes(value.fr), `${key} fr manquant`);
		}
	});
});
