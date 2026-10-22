import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(relPath) {
	return readFileSync(join(root, relPath), 'utf8');
}

describe('Phase 9 — branchement packaging / updates', () => {
	it('product.json pointe vers updates.ide.kuunda-cloud.com en canal internal', () => {
		const product = JSON.parse(read('product.json'));
		assert.equal(product.quality, 'internal');
		assert.equal(product.updateUrl, 'https://updates.ide.kuunda-cloud.com');
		assert.equal(product.kuundaUpdatePublicKey, undefined);
	});

	it('kuunda-builder est le pipeline Windows/macOS et refuse une update sans signature', () => {
		assert.match(read('scripts/kuunda-builder/plan.mjs'), /planKuundaBuild/);
		assert.match(read('.github/workflows/kuunda-builder.yml'), /kuunda-builder/);
		assert.doesNotMatch(read('.github/workflows/kuunda-builder.yml'), /wrangler deploy/);
		assert.match(read('.github/workflows/kuunda-builder.yml'), /HAS_WINDOWS_CERT/);
		assert.equal(read('.github/workflows/kuunda-builder.yml').includes('WINDOWS_CERT_PFX: ${{ secrets.WINDOWS_CERT_PFX }}'), false);
		assert.match(read('.github/workflows/kuunda-builder.yml'), /compile-windows\.ps1/);
		assert.match(read('.github/workflows/kuunda-builder.yml'), /compile-darwin\.sh/);
		assert.equal(read('.github/workflows/kuunda-builder.yml').includes('GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}'), true);
		assert.match(read('.github/workflows/kuunda-builder.yml'), /upload-artifact/);
		assert.match(read('scripts/kuunda-builder/compile-windows.ps1'), /vscode-win32-\$Arch-user-setup/);
		assert.match(read('scripts/kuunda-builder/compile-darwin.sh'), /hdiutil create/);
		assert.doesNotMatch(read('scripts/kuunda-builder/compile-windows.ps1'), /wrangler/);
		assert.doesNotMatch(read('scripts/kuunda-builder/compile-darwin.sh'), /codesign/);
		assert.match(read('src/vs/platform/update/electron-main/updateService.win32.ts'), /assertKuundaSignedFile/);
		assert.match(read('src/vs/platform/update/electron-main/updateService.win32.ts'), /_applySpecificUpdate refused/);
		assert.match(read('src/vs/platform/update/electron-main/updateService.darwin.ts'), /assertKuundaSignedFile/);
		assert.doesNotMatch(read('src/vs/platform/update/electron-main/updateService.darwin.ts'), /autoUpdater\.checkForUpdates/);
		assert.doesNotMatch(read('src/vs/platform/update/electron-main/updateService.darwin.ts'), /autoUpdater\.setFeedURL/);
		assert.match(read('src/vs/platform/update/electron-main/updateService.linux.ts'), /inspectUpdateManifest/);
		assert.doesNotMatch(read('src/vs/platform/update/electron-main/updateService.linux.ts'), /productService\.downloadUrl/);
		assert.match(read('src/vs/platform/update/common/packagingPolicy.ts'), /signature_required/);
		assert.match(read('src/vs/platform/update/common/packagingPolicy.ts'), /url_not_allowed/);
		assert.match(read('packages/kuunda-ai/src/packaging-policy.js'), /void-builder/);
		assert.match(read('packages/kuunda-ai/src/packaging-policy.js'), /vscode-win32-x64-user-setup/);
	});
});
