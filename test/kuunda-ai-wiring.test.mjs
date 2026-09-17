import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(relPath) {
	return readFileSync(join(root, relPath), 'utf8');
}

describe('Phase 2 — branchement IDE kuundaAi', () => {
	it('workbench charge kuundaAi isolé à côté de void', () => {
		const main = read('src/vs/workbench/workbench.common.main.ts');
		assert.match(main, /contrib\/kuundaAi\/browser\/kuundaAi\.contribution\.js/);
		assert.match(main, /contrib\/void\/browser\/void\.contribution\.js/);
	});

	it('Tab est activé par défaut et la politique Kuunda pilote autocompleteService', () => {
		const settings = read('src/vs/workbench/contrib/void/common/voidSettingsTypes.ts');
		assert.match(settings, /enableAutocomplete:\s*true/);
		const auto = read('src/vs/workbench/contrib/void/browser/autocompleteService.ts');
		assert.match(auto, /decideAutocompleteMode/);
		assert.match(auto, /predictionType: 'multi-line-start-on-next-line'/);
		const stored = read('src/vs/workbench/contrib/void/common/voidSettingsService.ts');
		assert.match(stored, /enableAutocomplete === undefined/);
	});

	it('le chat mentionne @codebase et injecte l’index Kuunda', () => {
		const inputs = read('src/vs/workbench/contrib/void/browser/react/src/util/inputs.tsx');
		assert.match(inputs, /fullName: 'codebase'/);
		const convert = read('src/vs/workbench/contrib/void/browser/convertToLLMMessageService.ts');
		assert.match(convert, /IKuundaCodebaseService/);
		assert.match(convert, /kuundaCodebaseService\.search/);
	});

	it('l’apply streamé parse SEARCH/REPLACE Kuunda en plus d’ORIGINAL/FINAL', () => {
		const apply = read('src/vs/workbench/contrib/void/browser/editCodeService.ts');
		assert.match(apply, /extractApplyBlocks/);
		assert.doesNotMatch(apply, /extractSearchReplaceBlocks\(/);
		const helper = read('src/vs/workbench/contrib/kuundaAi/common/extractApplyBlocks.ts');
		assert.match(helper, /parseStreamingDiff/);
	});

	it('chaque clé nls kuundaAi a en et fr distincts', () => {
		const strings = JSON.parse(read('src/vs/workbench/contrib/kuundaAi/common/strings.json'));
		const nlsSrc = read('src/vs/workbench/contrib/kuundaAi/common/kuundaAiNls.ts');
		for (const [key, value] of Object.entries(strings)) {
			assert.match(key, /^kuunda\.(ai|agent|terminal|dev|git)\./);
			assert.ok(value.en && value.fr);
			assert.notEqual(value.en, value.fr);
			assert.ok(nlsSrc.includes(value.en), `${key} en manquant`);
			assert.ok(nlsSrc.includes(value.fr), `${key} fr manquant`);
		}
	});
});
