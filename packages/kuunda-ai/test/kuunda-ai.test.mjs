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
	decideToolPermission,
	DEFAULT_TOOL_PERMISSIONS,
	compactChatContext,
	summarizeMessage,
	contextBudgetChars,
	planAgentTurn,
	planAfterTool,
	MAX_AGENT_STEPS,
	createBackgroundJob,
	transitionBackgroundJob,
	collectCheckpointPaths,
	isSupportedAgentProvider,
	BYOK_PROVIDERS,
	LOCAL_AGENT_PROVIDERS,
	pickWorkspaceFolder,
	pathIsInside,
	formatWorkspaceRoots,
	resolveAgentCwd,
	classifyShellCommand,
	TERMINAL_TOOL_NAMES,
	formatProjectRules,
	PROJECT_RULE_FILENAMES,
	parseGitStatusPorcelain,
	formatMultiRepoGit,
	joinFsPath,
	resolveRelativeCwd,
	KUUNDA_API_VERSION,
	isSupportedExtensionFormat,
	isApiVersionCompatible,
	parseKuundaContribution,
	decideMarketplaceInstall,
	decideKuundaApiAccess,
	describeKuundaApi,
	redactApiPayload,
	marketplaceSourceFromInstall,
	canGrantPermission,
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

describe('Phase 3.1 — boucle outil / observation / action', () => {
	it('enchaîne un tool call autorisé puis un nouvel appel LLM', () => {
		assert.equal(planAgentTurn({
			step: 0,
			hasToolCall: true,
			permissionAction: 'run',
		}).type, 'run_tool');
		assert.equal(planAfterTool({ step: 0 }).type, 'call_llm');
	});

	it('attend une permission au lieu d’exécuter', () => {
		assert.equal(planAgentTurn({
			step: 1,
			hasToolCall: true,
			permissionAction: 'wait',
		}).type, 'wait_permission');
	});

	it('refuse un outil interdit puis peut continuer', () => {
		assert.equal(planAgentTurn({
			step: 1,
			hasToolCall: true,
			permissionAction: 'refuse',
		}).type, 'refuse_tool');
		assert.equal(planAfterTool({ step: 1 }).type, 'call_llm');
	});

	it('plafonne les étapes multi-fichiers', () => {
		assert.equal(MAX_AGENT_STEPS, 48);
		assert.equal(planAgentTurn({
			step: MAX_AGENT_STEPS,
			hasToolCall: true,
			permissionAction: 'run',
		}).type, 'finish');
	});
});

describe('Phase 3.3 — permissions à quatre niveaux', () => {
	it('laisse passer les lectures sans confirmation', () => {
		const d = decideToolPermission({ toolName: 'read_file' });
		assert.equal(d.level, 'allow');
		assert.equal(d.action, 'run');
		assert.equal(DEFAULT_TOOL_PERMISSIONS.read_file, 'allow');
	});

	it('demande confirmation pour le terminal même si on n’a pas de toggle', () => {
		const d = decideToolPermission({ toolName: 'run_command' });
		assert.equal(d.level, 'confirm');
		assert.equal(d.action, 'wait');
		assert.equal(d.kind, 'terminal');
	});

	it('honore autoApprove seulement au niveau confirm, jamais en review', () => {
		const autoEdit = decideToolPermission({
			toolName: 'edit_file',
			autoApproveByKind: { edits: true },
		});
		assert.equal(autoEdit.action, 'run');
		const mustReview = decideToolPermission({
			toolName: 'delete_file_or_folder',
			autoApproveByKind: { edits: true },
		});
		assert.equal(mustReview.level, 'review');
		assert.equal(mustReview.action, 'wait');
	});

	it('refuse un outil overridé', () => {
		const d = decideToolPermission({
			toolName: 'run_command',
			policyOverrides: { run_command: 'refuse' },
		});
		assert.equal(d.action, 'refuse');
	});

	it('traite un outil MCP inconnu comme confirm', () => {
		const d = decideToolPermission({ toolName: 'browser_navigate' });
		assert.equal(d.kind, 'MCP tools');
		assert.equal(d.action, 'wait');
	});
});

describe('Phase 3.4 — compactage de contexte', () => {
	it('résume le milieu et garde le premier user + la queue', () => {
		const messages = [
			{ role: 'user', content: 'fix the login bug' },
			{ role: 'assistant', content: 'x'.repeat(400) },
			{ role: 'tool', name: 'read_file', content: 'y'.repeat(400) },
			{ role: 'assistant', content: 'still working' },
			{ role: 'user', content: 'continue' },
		];
		const out = compactChatContext(messages, { maxChars: 200, keepLast: 2 });
		assert.equal(out[0].content, 'fix the login bug');
		assert.match(out[1].content, /\[compacted assistant\]/);
		assert.match(out[2].content, /\[compacted tool read_file\]/);
		assert.equal(out[4].content, 'continue');
		assert.ok(summarizeMessage({ role: 'tool', name: 'ls_dir', content: 'a'.repeat(300) }).startsWith('[compacted tool ls_dir]'));
	});

	it('calibre le budget sur la fenêtre de contexte du modèle', () => {
		const budget = contextBudgetChars(32_000, 4_096);
		assert.ok(budget >= 5_000);
		assert.ok(budget < 32_000 * 4);
	});
});

describe('Phase 3.5 — BYOK + Ollama', () => {
	it('exige Anthropic, OpenAI, Gemini et Ollama', () => {
		assert.deepEqual([...BYOK_PROVIDERS], ['anthropic', 'openAI', 'gemini']);
		assert.deepEqual([...LOCAL_AGENT_PROVIDERS], ['ollama']);
		assert.equal(isSupportedAgentProvider('anthropic'), true);
		assert.equal(isSupportedAgentProvider('ollama'), true);
		assert.equal(isSupportedAgentProvider('unknown-llm'), false);
	});
});

describe('Phase 3.6 — job d’arrière-plan livrant un diff à revoir', () => {
	it('passe queued → running → needs_review, jamais auto-accepté', () => {
		let job = createBackgroundJob({ id: 'j1', prompt: 'refactor auth', threadId: 't1', now: '2026-09-17T00:00:00.000Z' });
		assert.equal(job.status, 'queued');
		job = transitionBackgroundJob(job, { type: 'start' });
		assert.equal(job.status, 'running');
		job = transitionBackgroundJob(job, { type: 'complete', changedPaths: ['src/a.ts'] });
		assert.equal(job.status, 'needs_review');
		assert.deepEqual(job.changedPaths, ['src/a.ts']);
		assert.equal(transitionBackgroundJob(job, { type: 'start' }).status, 'needs_review');
		job = transitionBackgroundJob(job, { type: 'review' });
		assert.equal(job.status, 'reviewed');
	});

	it('extrait les chemins des checkpoints Void', () => {
		const paths = collectCheckpointPaths([
			{ role: 'user', content: 'go' },
			{ role: 'checkpoint', voidFileSnapshotOfURI: { 'src/a.ts': {}, 'src/b.ts': {} } },
		]);
		assert.deepEqual(paths, ['src/a.ts', 'src/b.ts']);
	});
});

describe('Phase 4.1 — terminal agent cwd', () => {
	it('refuse un cwd hors workspace', () => {
		const folders = ['C:/proj/app', 'C:/proj/api'];
		assert.equal(pathIsInside('C:/proj/app/src/a.ts', 'C:/proj/app'), true);
		assert.equal(pickWorkspaceFolder('C:/proj/api/index.ts', folders), 'C:/proj/api');
		const inside = resolveAgentCwd({ cwd: 'C:/proj/app/src', workspaceFolders: folders });
		assert.equal(inside.ok, true);
		const outside = resolveAgentCwd({ cwd: 'C:/Windows', workspaceFolders: folders });
		assert.equal(outside.ok, false);
		assert.equal(outside.error, 'outside_workspace');
		assert.equal(resolveAgentCwd({ cwd: null, workspaceFolders: [] }).error, 'no_workspace');
		assert.equal(classifyShellCommand('git status'), 'git');
		assert.equal(classifyShellCommand('npm test'), 'shell');
		assert.equal(resolveAgentCwd({ cwd: '../secret', workspaceFolders: folders }).ok, false);
		assert.equal(resolveAgentCwd({ cwd: 'C:/proj/app/../../Windows', workspaceFolders: folders }).ok, false);
		assert.equal(joinFsPath('C:/proj/app', '../secret'), 'C:/proj/secret');
		assert.deepEqual([...TERMINAL_TOOL_NAMES], [
			'run_command',
			'open_persistent_terminal',
			'run_persistent_command',
			'kill_persistent_terminal',
		]);
	});
});

describe('Phase 4.3 — multi-root', () => {
	it('liste plus d’un dossier', () => {
		const text = formatWorkspaceRoots(['/ws/frontend', '/ws/backend']);
		assert.match(text, /multi-root/);
		assert.match(text, /frontend/);
		assert.match(text, /backend/);
		assert.equal(formatWorkspaceRoots(['/ws/only']), '');
	});

	it('un cwd relatif api vise le dossier api, pas app/api', () => {
		const folders = ['C:/proj/app', 'C:/proj/api'];
		assert.equal(resolveRelativeCwd('api', folders), 'C:/proj/api');
		const resolved = resolveAgentCwd({ cwd: 'api/src', workspaceFolders: folders, command: 'git status' });
		assert.equal(resolved.ok, true);
		if (resolved.ok) {
			assert.equal(resolved.folder, 'C:/proj/api');
			assert.equal(resolved.cwd, 'C:/proj/api/src');
			assert.equal(resolved.kind, 'git');
		}
	});
});

describe('Phase 4.4 — .projectrules', () => {
	it('formate les règles par dossier', () => {
		const text = formatProjectRules([
			{ folderName: 'app', fileName: '.projectrules', content: 'Use TypeScript.' },
			{ folderName: 'api', fileName: '.voidrules', content: '' },
		]);
		assert.match(text, /Project rules/);
		assert.match(text, /app\/\.projectrules/);
		assert.match(text, /Use TypeScript/);
		assert.ok(PROJECT_RULE_FILENAMES.includes('.projectrules'));
	});
});

describe('Phase 4.2 — git multi-repo', () => {
	it('parse porcelain et formate plusieurs racines', () => {
		const rows = parseGitStatusPorcelain('## main...origin/main\n M src/a.ts\n?? new.js\n');
		assert.equal(rows.length, 2);
		assert.equal(rows[0].path, 'src/a.ts');
		assert.equal(rows.some((row) => row.path.includes('main')), false);
		const text = formatMultiRepoGit([
			{ folderName: 'app', branch: 'main', stat: ' src/a.ts | 2 ++', log: 'abc|init|2026-09-17', status: '?? new.js' },
			{ folderName: 'api', branch: 'dev', stat: ' index.ts | 1 +', log: 'def|wip|2026-09-16' },
		]);
		assert.match(text, /Git repositories/);
		assert.match(text, /app/);
		assert.match(text, /api/);
		assert.match(text, /branch: main/);
		assert.match(text, /\?\? new\.js/);
	});
});

describe('Phase 4bis — API d’extension', () => {
	it('reste sur le VSIX et refuse un format propriétaire', () => {
		assert.equal(isSupportedExtensionFormat('theme.vsix'), true);
		assert.equal(isSupportedExtensionFormat('pack.kuunda-ext'), false);
		assert.equal(decideMarketplaceInstall({ format: 'kuunda-ext', source: 'openvsx' }).ok, false);
		assert.equal(decideMarketplaceInstall({ format: 'vsix', source: 'openvsx' }).ok, true);
		assert.equal(decideMarketplaceInstall({ format: 'vsix', source: 'kuunda_marketplace', reviewStatus: 'pending' }).error, 'review_required');
		assert.equal(decideMarketplaceInstall({ format: 'vsix', source: 'kuunda_marketplace', reviewStatus: 'approved' }).ok, true);
		assert.equal(marketplaceSourceFromInstall({ installSource: 'vsix' }), 'sideload');
		assert.equal(marketplaceSourceFromInstall({ installSource: 'gallery' }), 'openvsx');
		assert.equal(canGrantPermission(['agent'], 'credits'), false);
		assert.equal(canGrantPermission(['agent', 'credits'], 'credits'), true);
	});

	it('versionne l’API et exige une permission explicite', () => {
		assert.equal(KUUNDA_API_VERSION, '1.0.0');
		assert.equal(isApiVersionCompatible('1.0.0'), true);
		assert.equal(isApiVersionCompatible('1.0'), true);
		assert.equal(isApiVersionCompatible('2.0.0'), false);
		const declared = parseKuundaContribution({
			contributes: { kuunda: { apiVersion: '1.0.0', permissions: ['agent', 'credits', 'unknown'] } },
		});
		assert.deepEqual(declared.permissions, ['agent', 'credits']);
		const denied = decideKuundaApiAccess({
			method: 'credits.balance',
			extensionId: 'acme.tools',
			declaredPermissions: declared.permissions,
			grantedPermissions: [],
			source: 'openvsx',
			apiVersion: '1.0.0',
		});
		assert.equal(denied.error, 'not_granted');
		const allowed = decideKuundaApiAccess({
			method: 'credits.balance',
			extensionId: 'acme.tools',
			declaredPermissions: declared.permissions,
			grantedPermissions: ['credits'],
			source: 'openvsx',
			apiVersion: '1.0.0',
		});
		assert.equal(allowed.ok, true);
		assert.equal(decideKuundaApiAccess({ method: 'api.version', extensionId: 'acme.tools', source: 'openvsx' }).ok, true);
		const desc = describeKuundaApi();
		assert.equal(desc.marketplace, 'openvsx');
		assert.equal(desc.format, 'vsix');
		assert.equal(redactApiPayload({ remaining: 12, secret: 'hidden' }).remaining, 12);
		assert.equal('secret' in redactApiPayload({ remaining: 12, secret: 'hidden' }), false);
	});
});
