import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(relPath) {
	return readFileSync(join(root, relPath), 'utf8');
}

describe('Phase 11 — branchement compte Studio', () => {
	it('workbench charge kuundaAccount isolé avant billing', () => {
		const main = read('src/vs/workbench/workbench.common.main.ts');
		assert.match(main, /contrib\/kuundaAccount\/browser\/kuundaAccount\.contribution\.js/);
		const accountAt = main.indexOf('contrib/kuundaAccount/browser/kuundaAccount.contribution.js');
		const billingAt = main.indexOf('contrib/kuundaBilling/browser/kuundaBilling.contribution.js');
		assert.ok(accountAt >= 0 && billingAt > accountAt);
	});

	it('le Studio, le protocole OAuth et le coffre de session sont branchés', () => {
		const contrib = read('src/vs/workbench/contrib/kuundaAccount/browser/kuundaAccount.contribution.ts');
		assert.match(contrib, /kuunda\.account\.openStudio/);
		assert.match(contrib, /MenuId\.AccountsContext/);
		assert.match(contrib, /registerHandler/);
		assert.match(contrib, /completeOAuthCallback/);
		const service = read('src/vs/workbench/contrib/kuundaAccount/common/kuundaAccountService.ts');
		assert.match(service, /ISecretStorageService/);
		assert.match(service, /\/v1\/auth\/signup/);
		assert.match(service, /\/v1\/auth\/login/);
		assert.match(service, /\/v1\/auth\/oauth\/start/);
		assert.match(service, /\/v1\/auth\/device\/start/);
		assert.match(service, /\/v1\/account\/usage/);
		assert.match(service, /decideSend\('auth'\)/);
		assert.doesNotMatch(service, /sk_|service_role|whsec_/);
		const studio = read('src/vs/workbench/contrib/kuundaAccount/browser/kuundaAccountStudio.ts');
		assert.match(studio, /openKuundaAccountStudio/);
		assert.match(studio, /parseStudioOpenIntent/);
		assert.match(studio, /signedOut\.cloud/);
		assert.match(studio, /activeStudio/);
		assert.match(contrib, /options\?: unknown/);
		assert.match(studio, /oauth\.\$\{provider\}/);
		assert.match(studio, /\['google', 'github', 'apple'\]/);
		assert.match(studio, /IKuundaBillingService/);
		const watermark = read('src/vs/workbench/browser/parts/editor/editorGroupWatermark.ts');
		assert.match(watermark, /appendKuundaHomeAccountCta/);
		const billing = read('src/vs/workbench/contrib/kuundaBilling/common/kuundaBillingService.ts');
		assert.match(billing, /IKuundaAccountService/);
		assert.match(billing, /getAccessToken/);
		assert.match(billing, /Authorization/);
		const billingUi = read('src/vs/workbench/contrib/kuundaBilling/browser/kuundaBilling.contribution.ts');
		assert.match(billingUi, /kuunda\.account\.openStudio/);
		assert.match(billingUi, /clearUserId/);
	});

	it('chaque clé nls kuundaAccount a en et fr distincts', () => {
		const strings = JSON.parse(read('src/vs/workbench/contrib/kuundaAccount/common/strings.json'));
		const nlsSrc = read('src/vs/workbench/contrib/kuundaAccount/common/kuundaAccountNls.ts');
		for (const [key, value] of Object.entries(strings)) {
			assert.match(key, /^kuunda\.account\./);
			assert.ok(value.en && value.fr);
			assert.notEqual(value.en, value.fr, key);
			assert.ok(nlsSrc.includes(value.en), `${key} en manquant`);
			assert.ok(nlsSrc.includes(value.fr), `${key} fr manquant`);
		}
	});
});
