import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	decideAutocompleteMode,
	postprocessCompletion,
	createCodebaseIndex,
	formatCodebaseContext,
	shouldIndexPath,
	parseStreamingDiff,
	createDiffStreamParser,
	applyAcceptedHunks,
	createInlineEditPlan,
	applyInlineEdit,
	rejectInlineEdit,
	MARKERS,
} from '../src/index.js';

describe('Phase 2.1 — autocomplete Tab policy', () => {
	it('demande du multi-ligne sur ligne vide (parité Tab)', () => {
		const d = decideAutocompleteMode({ prefix: 'function foo() {\n', suffix: '\n}\n' });
		assert.equal(d.mode, 'multi-line');
		assert.equal(d.shouldGenerate, true);
		assert.ok(d.stopSequences.includes('\n\n'));
	});

	it('reste mono-ligne au milieu d’une ligne avec suffixe', () => {
		const d = decideAutocompleteMode({ prefix: 'const [x, ', suffix: '] = useState()' });
		assert.equal(d.mode, 'single-line');
		assert.equal(d.maxLines, 1);
	});

	it('continue en multi-ligne après acceptation Tab', () => {
		const d = decideAutocompleteMode({
			prefix: 'const x = 1',
			suffix: '',
			justAccepted: true,
		});
		assert.equal(d.mode, 'multi-line');
	});

	it('reste mono-ligne si le suffixe de ligne est du code', () => {
		const d = decideAutocompleteMode({ prefix: '\n', suffix: 'already' });
		assert.equal(d.shouldGenerate, true);
		assert.equal(d.mode, 'single-line');
	});

	it('coupe le ghost text au premier closer du suffixe', () => {
		const out = postprocessCompletion('bar)] = 1', { suffix: '] = 1', mode: 'single-line' });
		assert.equal(out.includes(']'), false);
	});
});

describe('Phase 2.3 — index @Codebase', () => {
	it('classe le fichier sémantiquement proche avant un fichier hors sujet', () => {
		const index = createCodebaseIndex();
		index.replaceAll([
			{ path: 'src/pay/ledger.ts', content: 'export function creditBalance(userId: string) { return userId }' },
			{ path: 'README.md', content: 'hello world from the desktop ide' },
			{ path: 'src/ui/button.ts', content: 'export function Button() { return null }' },
		]);
		const hits = index.search('credit user balance ledger');
		assert.ok(hits.length >= 1);
		assert.equal(hits[0].path, 'src/pay/ledger.ts');
		assert.ok(hits[0].score > 0);
		assert.match(formatCodebaseContext(hits), /ledger\.ts/);
	});

	it('ignore node_modules et .git', () => {
		assert.equal(shouldIndexPath('src/app.ts'), true);
		assert.equal(shouldIndexPath('node_modules/foo/index.js'), false);
		assert.equal(shouldIndexPath('pkg/.git/config'), false);
		const index = createCodebaseIndex();
		index.replaceAll([{ path: 'node_modules/x.js', content: 'secret token value' }]);
		assert.equal(index.size(), 0);
		assert.deepEqual(index.search('secret'), []);
	});
});

describe('Phase 2.4 — diffs streaming', () => {
	it('accumule les hunks sans reculer quand le flux grandit', () => {
		const parser = createDiffStreamParser();
		const p1 = parser.push(`${MARKERS.search}\nfoo\n`);
		assert.equal(p1.hunks.length, 1);
		assert.equal(p1.hunks[0].state, 'pending');
		assert.equal(p1.hasIncomplete, true);
		const p2 = parser.push(`${MARKERS.divider}\nbar\n${MARKERS.replace}\n`);
		assert.equal(p2.hunks.length, 1);
		assert.equal(p2.hunks[0].state, 'complete');
		assert.equal(p2.hunks[0].search, 'foo');
		assert.equal(p2.hunks[0].replace, 'bar');
		assert.equal(p2.hasIncomplete, false);
	});

	it('parse aussi les marqueurs ORIGINAL / FINAL de Void', () => {
		const { hunks } = parseStreamingDiff(
			`${MARKERS.original}\nold()\n${MARKERS.divider}\nnew()\n${MARKERS.final}\n`
		);
		assert.equal(hunks[0].search, 'old()');
		assert.equal(hunks[0].replace, 'new()');
		assert.equal(hunks[0].state, 'complete');
	});
});

describe('Phase 2.2 — Ctrl+K accept / reject / partiel', () => {
	it('rejette = fichier d’origine', () => {
		const plan = createInlineEditPlan({
			original: 'a()\n',
			instruction: 'rename',
			proposed: 'b()\n',
		});
		assert.equal(rejectInlineEdit(plan), 'a()\n');
	});

	it('accepte le hunk = fichier proposé', () => {
		const plan = createInlineEditPlan({
			original: 'const x = 1\n',
			instruction: 'change',
			proposed: 'const x = 2\n',
		});
		assert.equal(applyInlineEdit(plan, [plan.hunks[0].id]), 'const x = 2\n');
	});

	it('n’applique que les hunks acceptés (apply partiel)', () => {
		const original = 'one()\ntwo()\nthree()\n';
		const hunks = [
			{ id: 'h0', search: 'one()', replace: 'ONE()', state: 'complete' },
			{ id: 'h1', search: 'three()', replace: 'THREE()', state: 'complete' },
		];
		assert.equal(applyAcceptedHunks(original, hunks, ['h1']), 'one()\ntwo()\nTHREE()\n');
		assert.equal(applyAcceptedHunks(original, hunks, []), original);
	});
});
