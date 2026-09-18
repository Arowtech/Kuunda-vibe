import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(relPath) {
	return readFileSync(join(root, relPath), 'utf8');
}

describe('Phase 6 — branchement Kuunda Cloud', () => {
	it('workbench charge kuundaCloud isolé', () => {
		const main = read('src/vs/workbench/workbench.common.main.ts');
		assert.match(main, /contrib\/kuundaCloud\/browser\/kuundaCloud\.contribution\.js/);
		assert.match(main, /contrib\/kuundaProject\/browser\/kuundaProject\.contribution\.js/);
	});

	it('le wizard provisionne après create et le panel n’embarque pas de secret', () => {
		const contrib = read('src/vs/workbench/contrib/kuundaProject/browser/kuundaProject.contribution.ts');
		assert.match(contrib, /IKuundaCloudService/);
		assert.match(contrib, /IKuundaPublishService/);
		assert.match(contrib, /prepareFolder/);
		assert.match(contrib, /provisionFolder/);
		assert.match(contrib, /kuunda\.cloud\.provision\.pendingUser/);
		assert.match(contrib, /kuunda\.account\.openStudio/);
		assert.match(contrib, /reason: 'cloud'/);
		const cloudContrib = read('src/vs/workbench/contrib/kuundaCloud/browser/kuundaCloud.contribution.ts');
		assert.match(cloudContrib, /kuunda\.cloud\.showPanel/);
		assert.match(cloudContrib, /kuunda\.cloud\.disable/);
		assert.match(cloudContrib, /kuunda\.cloud\.replace/);
		assert.match(cloudContrib, /dialog\.confirm/);
		assert.match(cloudContrib, /pickWorkspaceFolder/);
		assert.match(cloudContrib, /KUUNDA_CLOUD_VIEW_ID/);
		assert.match(cloudContrib, /needsStudioLink/);
		assert.match(cloudContrib, /retryUnlinkedFolders/);
		assert.match(cloudContrib, /intent: 'signUp'/);
		assert.match(cloudContrib, /reason: 'cloud'/);
		assert.match(cloudContrib, /onDidChangeSession/);
		assert.match(cloudContrib, /onDidChangeWorkspaceFolders/);
		assert.match(cloudContrib, /studioPrompted/);
		assert.doesNotMatch(cloudContrib, /service_role|sk_live_|whsec_/);
		const service = read('src/vs/workbench/contrib/kuundaCloud/common/kuundaCloudService.ts');
		assert.match(service, /serializeManifestWithCloud/);
		assert.match(service, /CLOUD_ENV_PATH/);
		assert.match(service, /lastPublicStatus/);
		assert.doesNotMatch(service, /service_role/);
		assert.match(service, /IKuundaAccountService/);
		assert.match(service, /getAccessToken/);
		assert.match(service, /Authorization/);
		assert.match(service, /env: 'sandbox'/);
		assert.match(service, /needsStudioLink/);
		assert.match(service, /retryUnlinkedFolders/);
		assert.match(service, /hasLiveSession/);
		assert.match(service, /resolveCloudRecordAfterDecision/);
		assert.match(service, /overwriteSecrets = decision\.action === 'provision'/);
		assert.match(service, /platform_http_401/);
		const ext = read('src/vs/workbench/contrib/kuundaExt/common/kuundaExtService.ts');
		assert.match(ext, /lastPublicStatus/);
		assert.doesNotMatch(ext, /available: false, phase: 6/);
		const convert = read('src/vs/workbench/contrib/void/browser/convertToLLMMessageService.ts');
		assert.match(convert, /IKuundaCloudService/);
		assert.match(convert, /kuundaCloudService\.formatContext/);
	});

	it('chaque clé nls Phase 6 a en et fr distincts', () => {
		const strings = JSON.parse(read('src/vs/workbench/contrib/kuundaCloud/common/strings.json'));
		const nlsSrc = read('src/vs/workbench/contrib/kuundaCloud/common/kuundaCloudNls.ts');
		for (const [key, value] of Object.entries(strings)) {
			assert.match(key, /^kuunda\.cloud\./);
			assert.ok(value.en && value.fr);
			assert.notEqual(value.en, value.fr, key);
			assert.ok(nlsSrc.includes(value.en), `${key} en manquant`);
			assert.ok(nlsSrc.includes(value.fr), `${key} fr manquant`);
		}
	});
});
