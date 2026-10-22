import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(relPath) {
	return readFileSync(join(root, relPath), 'utf8');
}

describe('Phase 10 — branchement feedback / upstream', () => {
	it('workbench charge kuundaFeedback isolé et coupe le canal hors-ligne', () => {
		assert.match(read('src/vs/workbench/workbench.common.main.ts'), /contrib\/kuundaFeedback\/browser\/kuundaFeedback\.contribution\.js/);
		const contrib = read('src/vs/workbench/contrib/kuundaFeedback/browser/kuundaFeedback.contribution.ts');
		assert.match(contrib, /kuunda\.feedback\.send/);
		assert.match(contrib, /kuunda\.feedback\.showPanel/);
		const service = read('src/vs/workbench/contrib/kuundaFeedback/common/kuundaFeedbackService.ts');
		assert.match(service, /decideSend\('feedback'\)/);
		assert.match(service, /recordUsageSignal/);
		assert.match(service, /sanitizeFeedbackPayload/);
		assert.doesNotMatch(service, /includeWorkspace: true/);
		assert.match(read('packages/kuunda-ai/src/legal-policy.js'), /'feedback'/);
		assert.match(read('packages/kuunda-ai/src/legal-policy.js'), /usage_telemetry/);
		assert.match(read('packages/kuunda-ai/src/post-launch-policy.js'), /USAGE_TELEMETRY_DEFAULT = false/);
		assert.match(read('packages/kuunda-ai/src/post-launch-policy.js'), /isAllowedFeedbackOrigin/);
		assert.match(read('src/vs/workbench/contrib/kuundaFeedback/common/kuundaFeedbackService.ts'), /kuundaFeedbackLocalize\('kuunda\.feedback\.panel\.intro'\)/);
	});

	it('le plan upstream n’exécute pas de rebase et Dependabot reste hebdo', () => {
		assert.match(read('scripts/kuunda-upstream/plan.mjs'), /planUpstreamSync/);
		assert.match(read('.github/workflows/kuunda-upstream.yml'), /kuunda-upstream/);
		assert.doesNotMatch(read('.github/workflows/kuunda-upstream.yml'), /git rebase/);
		assert.doesNotMatch(read('.github/workflows/kuunda-upstream.yml'), /wrangler deploy/);
		assert.match(read('.github/dependabot.yml'), /interval: weekly/);
		assert.match(read('packages/cloud-client/src/http-client.js'), /\/v1\/feedback/);
	});

	it('chaque clé nls kuundaFeedback a en et fr distincts', () => {
		const strings = JSON.parse(read('src/vs/workbench/contrib/kuundaFeedback/common/strings.json'));
		const nlsSrc = read('src/vs/workbench/contrib/kuundaFeedback/common/kuundaFeedbackNls.ts');
		for (const [key, value] of Object.entries(strings)) {
			assert.match(key, /^kuunda\.feedback\./);
			assert.ok(value.en && value.fr);
			assert.notEqual(value.en, value.fr, key);
			assert.ok(nlsSrc.includes(value.en), `${key} en manquant`);
			assert.ok(nlsSrc.includes(value.fr), `${key} fr manquant`);
		}
	});
});
