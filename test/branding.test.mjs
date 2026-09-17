import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(relPath) {
	return readFileSync(join(root, relPath), 'utf8');
}

describe('Phase 1 — branding Kuunda Vibe', () => {
	it('product.json n’utilise plus l’identité Void', () => {
		const product = JSON.parse(read('product.json'));
		assert.equal(product.nameShort, 'Kuunda Vibe');
		assert.equal(product.nameLong, 'Kuunda Vibe');
		assert.equal(product.applicationName, 'kuunda-vibe');
		assert.equal(product.dataFolderName, '.kuunda-vibe');
		assert.equal(product.urlProtocol, 'kuunda-vibe');
		assert.equal(product.darwinBundleIdentifier, 'com.arowtech.kuundavibe');
		assert.equal(product.linuxIconName, 'kuunda-vibe');
		assert.equal(product.licenseName, 'Apache-2.0');
		assert.match(product.licenseUrl, /Arowtech\/Kuunda-vibe/);
		assert.doesNotMatch(product.applicationName, /^void$/i);
		assert.ok(product.linkProtectionTrustedDomains.includes('https://ide.kuunda-cloud.com'));
	});

	it('les logos source et les icônes plateforme existent', () => {
		assert.equal(existsSync(join(root, 'resources/branding/icon.png')), true);
		assert.equal(existsSync(join(root, 'resources/branding/wordmark.png')), true);
		assert.equal(existsSync(join(root, 'resources/linux/code.png')), true);
		assert.equal(existsSync(join(root, 'resources/win32/code.ico')), true);
		assert.equal(existsSync(join(root, 'resources/darwin/code.icns')), true);
	});

	it('chaque clé nls Kuunda a un anglais et un français', () => {
		const strings = JSON.parse(read('src/vs/workbench/contrib/kuundaBrand/common/strings.json'));
		for (const [key, value] of Object.entries(strings)) {
			assert.match(key, /^kuunda\./);
			assert.ok(value.en && value.en.length > 0, `${key} sans en`);
			assert.ok(value.fr && value.fr.length > 0, `${key} sans fr`);
			assert.notEqual(value.en, value.fr);
		}
		const contribution = read('src/vs/workbench/contrib/kuundaBrand/browser/kuundaBrand.contribution.ts');
		assert.match(contribution, /kuundaLocalize\(\s*'kuunda\.about\.attribution'/);
		assert.match(contribution, /kuundaLocalize\(\s*'kuunda\.product\.tagline'/);
		assert.match(read('src/vs/workbench/contrib/kuundaBrand/common/kuundaNls.ts'), /Default language: English/);
		assert.ok(Object.prototype.hasOwnProperty.call(strings, 'kuunda.product.tagline'));
	});

	it('kuundaNls.ts reste aligné sur strings.json et lit la locale', () => {
		const strings = JSON.parse(read('src/vs/workbench/contrib/kuundaBrand/common/strings.json'));
		const nlsSrc = read('src/vs/workbench/contrib/kuundaBrand/common/kuundaNls.ts');
		assert.match(nlsSrc, /getNLSLanguage/);
		assert.match(nlsSrc, /function resolveKuundaString/);
		for (const [key, value] of Object.entries(strings)) {
			assert.match(nlsSrc, new RegExp(`['"]${key.replace(/\./g, '\\.')}['"]`));
			assert.ok(nlsSrc.includes(value.en), `${key} en manquant dans kuundaNls.ts`);
			assert.ok(nlsSrc.includes(value.fr), `${key} fr manquant dans kuundaNls.ts`);
		}
	});

	it('les libellés Windows / transfert ne disent plus Void', () => {
		const visual = read('resources/win32/VisualElementsManifest.xml');
		assert.match(visual, /ShortDisplayName="Kuunda Vibe"/);
		assert.doesNotMatch(visual, /ShortDisplayName="Void"/);
		const transfer = read('src/vs/workbench/contrib/void/browser/extensionTransferService.ts');
		assert.match(transfer, /'Kuunda Vibe'/);
		assert.match(transfer, /'\.kuunda-vibe'/);
		assert.doesNotMatch(transfer, /'\.void-editor'/);
		const settings = read('src/vs/workbench/contrib/void/browser/voidSettingsPane.ts');
		assert.match(settings, /kuundaLocalize\('kuunda\.settings\.title'\)/);
		assert.doesNotMatch(settings, /Void\\'s Settings/);
		const fileMenu = read('src/vs/workbench/contrib/files/browser/fileActions.contribution.ts');
		assert.match(fileMenu, /kuundaLocalize\('kuunda\.settings\.openMenu'\)/);
	});

	it('workbench charge la contribution kuundaBrand isolée', () => {
		const main = read('src/vs/workbench/workbench.common.main.ts');
		assert.match(main, /contrib\/kuundaBrand\/browser\/kuundaBrand\.contribution\.js/);
		assert.match(main, /Modified 2026-09-17 by Arowtech/);
	});
});
