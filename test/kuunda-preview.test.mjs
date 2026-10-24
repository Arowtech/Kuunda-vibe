import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function read(relPath) {
	return readFileSync(join(root, relPath), 'utf8');
}

describe('aperçu navigateur local', () => {
	it('ouvre Browser Menu dans l’éditeur central, Select Element par défaut', () => {
		const main = read('src/vs/workbench/workbench.common.main.ts');
		assert.match(main, /contrib\/kuundaPreview\/browser\/kuundaPreview\.contribution\.js/);
		const contrib = read('src/vs/workbench/contrib/kuundaPreview/browser/kuundaPreview.contribution.ts');
		assert.match(contrib, /kuunda\.preview\.open/);
		assert.match(contrib, /MenuId\.MenubarViewMenu/);
		assert.match(contrib, /preserveFocus: true, auto: true/);
		assert.match(contrib, /LifecyclePhase\.Eventually/);
		const service = read('src/vs/workbench/contrib/kuundaPreview/browser/kuundaPreviewService.ts');
		assert.match(service, /SIDE_GROUP/);
		assert.match(service, /onDidChangeContent/);
		assert.match(service, /onDidFilesChange/);
		assert.match(service, /mode = 'select'/);
		assert.match(service, /kuunda\.preview/);
		const shell = read('src/vs/workbench/contrib/kuundaPreview/browser/previewShell.ts');
		assert.match(shell, /let mode = 'select'/);
		assert.match(shell, /data-mode="select" aria-checked="true"/);
		assert.match(shell, /id="browser-menu"/);
		const editor = read('src/vs/workbench/browser/parts/editor/editorConfiguration.ts');
		assert.match(editor, /'kuunda\.preview'/);
	});

	it('chaque clé nls a en et fr distincts', () => {
		const strings = JSON.parse(read('src/vs/workbench/contrib/kuundaPreview/common/strings.json'));
		const nlsSrc = read('src/vs/workbench/contrib/kuundaPreview/common/kuundaPreviewNls.ts');
		for (const [key, value] of Object.entries(strings)) {
			assert.match(key, /^kuunda\.preview\./);
			assert.ok(value.en && value.fr);
			assert.notEqual(value.en, value.fr, key);
			assert.ok(nlsSrc.includes(value.en), `${key} en manquant`);
			assert.ok(nlsSrc.includes(value.fr), `${key} fr manquant`);
		}
		assert.match(nlsSrc, /Browser Menu/);
		assert.match(nlsSrc, /Select Element/);
	});

	it('reconstruit la page locale et choisit index.html', () => {
		const href = pathToFileURL(join(root, 'src/vs/workbench/contrib/kuundaPreview/common/previewDocument.ts')).href;
		const script = `
			import { buildPreviewHtml, pickPreviewEntry, isLivePreviewPath, rebaseCssUrls, isLocalPreviewUrl } from ${JSON.stringify(href)};
			const html = buildPreviewHtml({
				html: '<html><head><link rel="stylesheet" href="styles.css"></head><body><img src="a.png"><script src="script.js"></script><script src="https://cdn.example/a.js"></script></body></html>',
				baseHref: 'https://example.test/proj/',
				nonce: 'n',
				version: '5',
				styles: { 'styles.css': 'body{color:red}' },
				scripts: { 'script.js': 'console.log(1)' },
			});
			if (!html.includes('body{color:red}')) throw new Error('css missing');
			if (!html.includes('console.log(1)')) throw new Error('js missing');
			if (!html.includes('https://cdn.example/a.js')) throw new Error('cdn removed');
			if (!html.includes('a.png?kuundaPreview=5')) throw new Error('cache ' + html);
			if (!html.includes('https://example.test/proj/')) throw new Error('base');
			if (!html.includes('kuunda-select-mode')) throw new Error('select style');
			if (pickPreviewEntry(['src/index.html', 'index.html']) !== 'index.html') throw new Error('pick index');
			if (pickPreviewEntry(['src/public/index.html']) !== 'src/public/index.html') throw new Error('pick public');
			if (pickPreviewEntry(['readme.html', 'about.html']) !== 'about.html') throw new Error('pick sort');
			if (!isLivePreviewPath('/proj/styles.css')) throw new Error('css path');
			if (isLivePreviewPath('/proj/app.ts')) throw new Error('ts path');
			if (isLocalPreviewUrl('https://example.test')) throw new Error('remote');
			const css = rebaseCssUrls('body{background:url(../a.png)}', 'css/styles.css');
			if (!css.includes('css/../a.png')) throw new Error(css);
		`;
		const result = spawnSync(process.execPath, ['--experimental-strip-types', '--input-type=module', '-e', script], { encoding: 'utf8' });
		assert.equal(result.status, 0, result.stderr || result.stdout);
	});
});
