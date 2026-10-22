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
		// Cloud is anonymous-first: creating a project must never push a Studio signup.
		assert.doesNotMatch(contrib, /kuunda\.account\.openStudio/);
		assert.doesNotMatch(contrib, /intent: 'signUp'/);
		const cloudContrib = read('src/vs/workbench/contrib/kuundaCloud/browser/kuundaCloud.contribution.ts');
		assert.match(cloudContrib, /kuunda\.cloud\.showPanel/);
		assert.match(cloudContrib, /kuunda\.cloud\.disable/);
		assert.match(cloudContrib, /kuunda\.cloud\.replace/);
		assert.match(cloudContrib, /dialog\.confirm/);
		assert.match(cloudContrib, /pickWorkspaceFolder/);
		assert.match(cloudContrib, /KUUNDA_CLOUD_VIEW_ID/);
		assert.match(cloudContrib, /onDidChangeWorkspaceFolders/);
		assert.doesNotMatch(cloudContrib, /intent: 'signUp'/);
		assert.doesNotMatch(cloudContrib, /kuunda\.account\.openStudio/);
		// Plan management lives in the IDE, not on the Cloud website.
		assert.match(cloudContrib, /kuunda\.cloud\.plan/);
		assert.match(cloudContrib, /kuunda\.cloud\.sync/);
		assert.match(cloudContrib, /kuunda\.cloud\.projects/);
		// Multi-machine: the account can be re-adopted without any web signup.
		assert.match(cloudContrib, /kuunda\.cloud\.link/);
		assert.match(cloudContrib, /kuunda\.cloud\.adopt/);
		assert.match(cloudContrib, /IClipboardService/);
		assert.match(cloudContrib, /kuunda\.cloud\.archive/);
		assert.match(cloudContrib, /syncProjects/);
		assert.match(cloudContrib, /startPlanCheckout/);
		assert.match(cloudContrib, /registerConfiguration/);
		assert.match(cloudContrib, /kuunda\.cloud\.defaultPlan/);
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
		// One auto-created main account owns every project of the install.
		assert.match(service, /cloudOwnerId/);
		assert.match(service, /cloudAccountId/);
		assert.match(service, /CLOUD_ACCOUNT_STORAGE_KEY/);
		assert.match(service, /CLOUD_ACCOUNT_PREFIX/);
		// Account inventory reconciliation (push then pull).
		assert.match(service, /syncProjects/);
		assert.match(service, /\/v1\/account\/projects/);
		assert.match(service, /accountProjects/);
		assert.match(service, /archivedProjects/);
		assert.match(service, /archiveFolder/);
		assert.match(service, /restoreProject/);
		// Cross-machine link + source location so code can be re-cloned.
		assert.match(service, /linkAccount/);
		assert.match(service, /adoptAccount/);
		assert.match(service, /parseGitRemote/);
		assert.match(service, /sanitizeRepoUrl/);
		assert.match(service, /\/v1\/account\/link\/start/);
		assert.match(service, /\/v1\/account\/link\/claim/);
		// Spec routes first, legacy routes as a temporary fallback.
		assert.match(service, /requestSpecOrLegacy/);
		assert.match(service, /\/v1\/accounts\//);
		assert.match(service, /\/v1\/account\/projects\?accountId=/);
		assert.match(service, /specMethod: 'PUT'/);
		assert.match(service, /ROUTE_PROBE_TTL/);
		// Transition evidence: the fallback is deleted on counters, not on hope.
		assert.match(service, /ROUTE_FAMILIES/);
		assert.match(service, /sanitizeRouteMode/);
		assert.match(service, /ROUTE_EVIDENCE_STORAGE_KEY/);
		assert.match(service, /recordRoute/);
		assert.match(service, /routeReport\(\)/);
		assert.match(service, /resetRouteEvidence/);
		assert.match(service, /routeMode\(\) === 'off'/);
		assert.match(cloudContrib, /kuunda\.cloud\.legacyRoutes/);
		assert.match(cloudContrib, /kuunda\.cloud\.routes/);
		assert.match(cloudContrib, /routeReport\(\)/);
		assert.match(cloudContrib, /resetRouteEvidence/);
		assert.match(cloudContrib, /formatRouteReport/);
		// The shared kernel carries the family table, the mode and the report text.
		const kernel = read('src/vs/workbench/contrib/kuundaCloud/common/cloudProvision.ts');
		assert.match(kernel, /ROUTE_FAMILIES/);
		assert.match(kernel, /sanitizeRouteMode/);
		assert.match(kernel, /formatRouteReport/);
		// Hand-maintained JS mirror of the kernel: keep both sides honest.
		const kernelJs = read('packages/kuunda-ai/src/cloud-provision.js');
		assert.match(kernelJs, /ROUTE_FAMILIES/);
		assert.match(kernelJs, /sanitizeRouteMode/);
		assert.match(kernelJs, /formatRouteReport/);
		// Every platform call goes through the shim: no stray direct fetch.
		assert.equal((service.match(/fetchWithTimeout\(/g) || []).length, 1);
		assert.match(service, /DEFAULT_CLOUD_PLAN/);
		assert.match(service, /listPlans/);
		assert.match(service, /startPlanCheckout/);
		assert.match(service, /sanitizePlanId/);
		assert.doesNotMatch(service, /hasLiveSession/);
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
