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
		assert.match(product.privacyStatementUrl, /PRIVACY-POLICY/);
		assert.equal(product.quality, 'internal');
		assert.equal(product.updateUrl, 'https://updates.ide.kuunda-cloud.com');
		assert.doesNotMatch(product.applicationName, /^void$/i);
		assert.ok(product.linkProtectionTrustedDomains.includes('https://ide.kuunda-cloud.com'));
	});

	it('les logos source et les icônes plateforme existent', () => {
		assert.equal(existsSync(join(root, 'resources/branding/icon.png')), true);
		assert.equal(existsSync(join(root, 'resources/branding/wordmark.png')), true);
		assert.equal(existsSync(join(root, 'resources/linux/code.png')), true);
		assert.equal(existsSync(join(root, 'resources/win32/code.ico')), true);
		assert.equal(existsSync(join(root, 'resources/darwin/code.icns')), true);
		assert.equal(existsSync(join(root, 'resources/win32/inno-kuunda.bmp')), true);
		assert.equal(existsSync(join(root, 'src/vs/workbench/browser/media/code-icon.png')), true);
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

	it('les helpers nls Kuunda n’appellent pas nls.localize avec une variable', () => {
		const files = [
			'src/vs/workbench/contrib/kuundaBrand/common/kuundaNls.ts',
			'src/vs/workbench/contrib/kuundaAi/common/kuundaAiNls.ts',
			'src/vs/workbench/contrib/kuundaBilling/common/kuundaBillingNls.ts',
			'src/vs/workbench/contrib/kuundaExt/common/kuundaExtNls.ts',
			'src/vs/workbench/contrib/kuundaProject/common/kuundaProjectNls.ts',
			'src/vs/workbench/contrib/kuundaCloud/common/kuundaCloudNls.ts',
			'src/vs/workbench/contrib/kuundaPublish/common/kuundaPublishNls.ts',
			'src/vs/workbench/contrib/kuundaLegal/common/kuundaLegalNls.ts',
			'src/vs/workbench/contrib/kuundaFeedback/common/kuundaFeedbackNls.ts',
		];
		for (const file of files) {
			const src = read(file);
			assert.doesNotMatch(src, /localize\(\s*key\s*,/, `${file} casse compile-build (eval nls)`);
			assert.match(src, /formatKuundaMessage/, `${file} doit formater {0} sans nls.localize dynamique`);
		}
	});

	it('l’installateur et l’accueil n’affichent plus la marque Void', () => {
		const iss = read('build/win32/code.iss');
		assert.match(iss, /inno-kuunda\.bmp/);
		assert.doesNotMatch(iss, /WizardSmallImageFile=.*inno-void\.bmp/);
		const onboarding = read('src/vs/workbench/contrib/void/browser/react/src/void-onboarding/VoidOnboarding.tsx');
		assert.match(onboarding, /Welcome to Kuunda Vibe/);
		assert.doesNotMatch(onboarding, /Welcome to Void/);
		assert.doesNotMatch(onboarding, /invert\(1\)/);
		const watermark = read('src/vs/workbench/browser/parts/editor/editorGroupWatermark.ts');
		assert.match(watermark, /appendKuundaHomeProjectCards/);
		assert.doesNotMatch(watermark, /invert\(1\)/);
		const titlebar = read('src/vs/workbench/browser/parts/titlebar/media/titlebarpart.css');
		assert.match(titlebar, /code-icon\.png/);
	});

	it('la charte Kuunda Cloud est le thème par défaut', () => {
		const defaults = read('src/vs/workbench/services/themes/common/workbenchThemeService.ts');
		assert.match(defaults, /COLOR_THEME_DARK = 'Kuunda Vibe Dark'/);
		assert.match(defaults, /COLOR_THEME_LIGHT = 'Kuunda Vibe Light'/);
		assert.equal(existsSync(join(root, 'extensions/theme-defaults/themes/kuunda_dark.json')), true);
		assert.equal(existsSync(join(root, 'extensions/theme-defaults/themes/kuunda_light.json')), true);
		const themePkg = JSON.parse(read('extensions/theme-defaults/package.json'));
		assert.equal(themePkg.contributes.themes[0].id, 'Kuunda Vibe Dark');
		assert.equal(themePkg.contributes.themes[1].id, 'Kuunda Vibe Light');
		const dark = JSON.parse(read('extensions/theme-defaults/themes/kuunda_dark.json'));
		assert.equal(dark.colors['button.background'], '#E4930A');
		assert.equal(dark.colors['editor.background'], '#111218');
		assert.equal(dark.colors['sideBar.background'], '#0E0F18');
		assert.equal(dark.colors['activityBar.activeBorder'], '#E4930A');
		const chrome = read('src/vs/workbench/contrib/kuundaBrand/browser/kuundaBrand.contribution.ts');
		assert.match(chrome, /media\/kuundaChrome\.css/);
		const voidCss = read('src/vs/workbench/contrib/void/browser/media/void.css');
		assert.doesNotMatch(voidCss, /#306dce|#2563eb|#3b82f6/);
		const styles = read('src/vs/workbench/contrib/void/browser/react/src/styles.css');
		assert.doesNotMatch(styles, /#007FD4/);
		assert.match(styles, /#E4930A/);
	});

	it('workbench charge la contribution kuundaBrand isolée', () => {
		const main = read('src/vs/workbench/workbench.common.main.ts');
		assert.match(main, /contrib\/kuundaBrand\/browser\/kuundaBrand\.contribution\.js/);
		assert.match(main, /Modified 2026-09-17 by Arowtech/);
	});
});
