import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(relPath) {
	return readFileSync(join(root, relPath), 'utf8');
}

describe('Phase 5 — branchement sélecteur de projet', () => {
	it('workbench charge kuundaProject isolé', () => {
		const main = read('src/vs/workbench/workbench.common.main.ts');
		assert.match(main, /contrib\/kuundaProject\/browser\/kuundaProject\.contribution\.js/);
		assert.match(main, /contrib\/kuundaExt\/browser\/kuundaExt\.contribution\.js/);
		assert.match(main, /contrib\/kuundaCloud\/browser\/kuundaCloud\.contribution/);
	});

	it('le wizard exige un type, un sous-écran mobile, et écrit le manifeste', () => {
		const contrib = read('src/vs/workbench/contrib/kuundaProject/browser/kuundaProject.contribution.ts');
		assert.match(contrib, /kuunda\.project\.create/);
		assert.match(contrib, /ignoreFocusLost: true/);
		assert.match(contrib, /type === 'mobile'/);
		assert.match(contrib, /pickProjectTypeCard/);
		assert.match(contrib, /pickPublishOptionCard/);
		assert.match(contrib, /MenuId\.MenubarFileMenu/);
		assert.match(contrib, /kuunda\.project\.create\.cancelled/);
		assert.match(contrib, /sanitizeProjectName/);
		assert.match(contrib, /localizeCreateError/);
		assert.match(contrib, /kuunda\.project\.showType\.mobile/);
		assert.match(contrib, /forceReuseWindow/);
		assert.match(contrib, /provisionFolder/);
		const cards = read('src/vs/workbench/contrib/kuundaProject/browser/kuundaProjectCards.ts');
		assert.match(cards, /kuunda-project-card/);
		assert.match(cards, /appendKuundaHomeProjectCards/);
		assert.match(cards, /MOBILE_PUBLISH_OPTIONS/);
		assert.match(read('src/vs/workbench/contrib/kuundaProject/browser/media/kuundaProject.css'), /\.kuunda-project-card/);
		const service = read('src/vs/workbench/contrib/kuundaProject/common/kuundaProjectService.ts');
		assert.match(service, /decideProjectCreate/);
		assert.match(service, /scaffoldProjectFiles/);
		assert.match(service, /selectFilesToWrite/);
		assert.match(service, /decideDestination/);
		assert.match(service, /manifestState/);
		assert.match(service, /write_failed/);
		assert.doesNotMatch(service, /IHostService/);
		const kernel = read('src/vs/workbench/contrib/kuundaProject/common/projectType.ts');
		assert.match(kernel, /invalid_manifest/);
		assert.match(kernel, /WINDOWS_RESERVED_NAMES/);
		const convert = read('src/vs/workbench/contrib/void/browser/convertToLLMMessageService.ts');
		assert.match(convert, /IKuundaProjectService/);
		assert.match(convert, /formatContext/);
		assert.match(convert, /IKuundaCloudService/);
	});

	it('chaque clé nls Phase 5 a en et fr distincts', () => {
		const strings = JSON.parse(read('src/vs/workbench/contrib/kuundaProject/common/strings.json'));
		const nlsSrc = read('src/vs/workbench/contrib/kuundaProject/common/kuundaProjectNls.ts');
		for (const [key, value] of Object.entries(strings)) {
			assert.match(key, /^kuunda\.project\./);
			assert.ok(value.en && value.fr);
			assert.notEqual(value.en, value.fr, key);
			assert.ok(nlsSrc.includes(value.en), `${key} en manquant`);
			assert.ok(nlsSrc.includes(value.fr), `${key} fr manquant`);
		}
	});
});
