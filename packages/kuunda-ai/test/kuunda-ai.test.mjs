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
	PROJECT_TYPES,
	sanitizeProjectName,
	decideProjectCreate,
	parseProjectManifest,
	scaffoldProjectFiles,
	selectFilesToWrite,
	formatProjectContext,
	publishOptionFromTargets,
	PROJECT_MANIFEST_PATH,
	decideDestination,
	CLOUD_ENABLED_DEFAULT,
	CLOUD_ENV_PATH,
	CLOUD_CLIENT_PATH,
	SECRET_PLACEHOLDER,
	parseCloudSettings,
	redactCloudPayload,
	decideCloudProvisioning,
	publicCloudRecord,
	mergeGitignore,
	persistableAnonKey,
	scaffoldCloudFiles,
	formatCloudContext,
	formatCloudPanel,
	serializeManifestWithCloud,
	isPublishPanelVisible,
	decidePublish,
	inspectPlayServiceAccount,
	inspectAppStoreP8,
	inspectAppStoreIds,
	inspectKeystore,
	verifyPublishFiles,
	sanitizePublishError,
	redactPublishPayload,
	redactPublishLog,
	scaffoldPublishFiles,
	formatPublishPanel,
	formatPublishContext,
	parsePublishLocal,
	persistablePublishLocal,
	buildPublishRequest,
	PUBLISH_LOCAL_PATH,
	PUBLISH_PLAY_JSON_PATH,
	PUBLISH_WORKFLOW_PATH,
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

describe('Phase 5 — type de projet', () => {
	it('refuse un projet sans type, nom ou cible mobile', () => {
		assert.deepEqual(PROJECT_TYPES, ['website', 'webapp', 'mobile', 'other']);
		assert.equal(sanitizeProjectName('../secret'), '');
		assert.equal(sanitizeProjectName('My App'), 'My-App');
		assert.equal(sanitizeProjectName('CON'), '');
		assert.equal(sanitizeProjectName('com1.txt'), '');
		assert.equal(decideDestination({ parentKind: 'missing' }).error, 'parent_missing');
		assert.equal(decideDestination({ parentKind: 'folder', folderKind: 'file' }).error, 'not_a_directory');
		assert.equal(decideDestination({ parentKind: 'folder', folderKind: 'folder', manifestExists: true, manifestValid: true }).error, 'already_kuunda_project');
		assert.equal(decideDestination({ parentKind: 'folder', folderKind: 'missing', manifestExists: true, manifestValid: false }).error, 'invalid_manifest');
		assert.equal(decideProjectCreate({ name: 'shop' }).error, 'type_required');
		assert.equal(decideProjectCreate({ type: 'website', name: '' }).error, 'name_required');
		assert.equal(decideProjectCreate({ type: 'mobile', name: 'shop' }).error, 'publish_required');
		assert.equal(decideProjectCreate({ type: 'website', name: 'shop', publishOption: 'google_play' }).error, 'publish_not_applicable');
		assert.equal(decideProjectCreate({ type: 'website', name: 'shop', destinationKind: 'file' }).error, 'not_a_directory');
		assert.equal(decideProjectCreate({ type: 'website', name: 'shop', existingManifest: true }).error, 'already_kuunda_project');
		const mobile = decideProjectCreate({ type: 'mobile', name: 'shop', publishOption: 'both' });
		assert.equal(mobile.ok, true);
		assert.deepEqual(mobile.ok ? mobile.publishTargets : [], ['google_play', 'app_store']);
		assert.equal(publishOptionFromTargets(['app_store']), 'app_store');
	});

	it('génère un template sans secret et n’écrase pas les fichiers existants', () => {
		const website = scaffoldProjectFiles({ type: 'website', name: 'landing' });
		assert.equal(website.ok, true);
		if (!website.ok) {
			return;
		}
		assert.ok(website.files.some((file) => file.path === PROJECT_MANIFEST_PATH));
		assert.equal(website.files.at(-1)?.path, PROJECT_MANIFEST_PATH);
		assert.ok(website.files.some((file) => file.path === 'index.html'));
		const parsed = parseProjectManifest(website.files.find((file) => file.path === PROJECT_MANIFEST_PATH)?.content);
		assert.equal(parsed.ok && parsed.manifest.type, 'website');
		const blob = website.files.map((file) => file.content).join('\n');
		assert.doesNotMatch(blob, /sk-|api[_-]?key|service_role|whsec_|BEGIN [A-Z ]+PRIVATE KEY/i);
		const skipped = selectFilesToWrite(website.files, ['index.html']);
		assert.ok(skipped.skipped.includes('index.html'));
		assert.ok(skipped.written.some((file) => file.path === PROJECT_MANIFEST_PATH));
		const mobile = scaffoldProjectFiles({ type: 'mobile', name: 'shop', publishTargets: ['google_play'] });
		assert.equal(mobile.ok, true);
		if (!mobile.ok) {
			return;
		}
		assert.ok(mobile.files.some((file) => file.path === 'store/play/README.md'));
		assert.equal(mobile.files.some((file) => file.path === 'store/appstore/README.md'), false);
		const none = scaffoldProjectFiles({ type: 'mobile', name: 'local', publishTargets: [] });
		assert.equal(none.ok, true);
		if (!none.ok) {
			return;
		}
		assert.equal(none.files.some((file) => file.path.startsWith('store/')), false);
		assert.match(formatProjectContext([{ folderName: 'shop', manifest: none.ok ? none.manifest : undefined }]), /mobile/);
	});
});

describe('Phase 6 — Kuunda Cloud par défaut', () => {
	it('provisionne par défaut, rédige les secrets, et ignore git pour les clés projet', () => {
		assert.equal(CLOUD_ENABLED_DEFAULT, true);
		assert.equal(decideCloudProvisioning({ enabled: false }).action, 'skip');
		assert.equal(decideCloudProvisioning({ enabled: true }).action, 'pending_user');
		assert.equal(decideCloudProvisioning({ enabled: true, userId: 'u1', apiOk: false }).action, 'pending_api');
		assert.equal(decideCloudProvisioning({ enabled: true, userId: 'u1', alreadyProvisioned: true }).action, 'reuse');
		assert.equal(decideCloudProvisioning({ enabled: true, userId: 'u1', apiOk: true }).action, 'provision');
		assert.equal(decideCloudProvisioning({ enabled: true, userId: 'u1' }).action, 'provision');
		assert.equal(sanitizeCloudUrlSafe(), undefined);
		assert.equal(publicCloudRecord({ url: 'https://evil.example', enabled: true }).url, undefined);
		assert.equal(publicCloudRecord({ url: 'https://proj-ab.kuunda-cloud.com', projectRef: '../etc' }).projectRef, undefined);
		assert.equal(publicCloudRecord({ url: 'https://proj-ab.kuunda-cloud.com', projectRef: 'proj_ab' }).url, 'https://proj-ab.kuunda-cloud.com');
		assert.equal(persistableAnonKey('service_role_xxx'), SECRET_PLACEHOLDER);
		assert.equal(persistableAnonKey('ok\nPATH=/tmp'), SECRET_PLACEHOLDER);
		assert.equal(persistableAnonKey('kuunda_anon_x='), SECRET_PLACEHOLDER);
		assert.equal('anonKey' in redactCloudPayload({ projectRef: 'proj_ab', anonKey: 'kuunda_anon_x' }), false);
		const parsed = parseCloudSettings({ cloud: { enabled: false, projectRef: 'proj_deadbeef', env: 'sandbox' } });
		assert.equal(parsed.enabled, false);
		assert.equal(parsed.projectRef, 'proj_deadbeef');
	});

	it('échafaude le client CRUD et des fichiers secrets gitignorés, jamais service_role', () => {
		const scaffold = scaffoldCloudFiles({
			type: 'webapp',
			url: 'https://proj-ab.kuunda-cloud.com',
			projectRef: 'proj_ab',
			anonKey: 'service_role_nope',
			existingGitignore: 'node_modules\n',
		});
		assert.equal(scaffold.ok, true);
		assert.ok(scaffold.files.some((file) => file.path === CLOUD_CLIENT_PATH));
		assert.ok(scaffold.files.some((file) => file.path === CLOUD_ENV_PATH && file.gitignored));
		const env = scaffold.files.find((file) => file.path === CLOUD_ENV_PATH);
		assert.match(env?.content || '', /KUUNDA_ANON_KEY="<SET VIA SECRET STORE>"/);
		assert.doesNotMatch(scaffold.files.map((file) => file.content).join('\n'), /service_role_nope/);
		const gitignore = scaffold.files.find((file) => file.path === '.gitignore');
		assert.match(gitignore?.content || '', /\.env\.local/);
		assert.equal(mergeGitignore('.env.local\n.kuunda/cloud.local.json\n').changed, false);
		const manifest = serializeManifestWithCloud({ type: 'webapp', name: 'shop' }, scaffold.cloud);
		assert.match(manifest, /"enabled": true/);
		assert.doesNotMatch(manifest, /anonKey|service_role|sk_/);
		assert.match(formatCloudContext(scaffold.cloud), /proj_ab/);
		assert.match(formatCloudPanel({ cloud: scaffold.cloud, tables: [{ name: 'items', rowCount: 0 }] }), /items \(0\)/);
		assert.match(formatCloudPanel({ cloud: scaffold.cloud, tables: [{ name: 'items\n- evil', rowCount: 0 }] }), /unknown \(0\)/);
		const website = scaffoldProjectFiles({ type: 'website', name: 'landing' });
		assert.equal(website.ok, true);
		if (website.ok) {
			assert.match(website.files.find((file) => file.path === 'README.md')?.content || '', /Kuunda Cloud is enabled by default/);
		}
	});
});

function sanitizeCloudUrlSafe() {
	return publicCloudRecord({ url: 'http://proj_ab.kuunda-cloud.com' }).url;
}

const SAMPLE_P8 = `-----BEGIN PRIVATE KEY-----
MIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgAAAAAAAAAAAAAAAA
-----END PRIVATE KEY-----
`;

describe('Phase 7 — publication mobile', () => {
	it('n’affiche le panneau que pour mobile et refuse les cibles incomplètes', () => {
		assert.equal(isPublishPanelVisible({ type: 'webapp' }), false);
		assert.equal(isPublishPanelVisible({ type: 'mobile', publishTargets: [] }), true);
		assert.equal(decidePublish({ type: 'webapp' }).error, 'not_mobile');
		assert.equal(decidePublish({ type: 'mobile', publishTargets: [] }).error, 'no_targets');
		assert.equal(decidePublish({
			type: 'mobile',
			publishTargets: ['google_play'],
			credentials: { googlePlay: true },
			signatureReady: true,
		}).error, 'incomplete_metadata');
		assert.equal(decidePublish({
			type: 'mobile',
			publishTargets: ['google_play'],
			credentials: {},
			metadata: { version: '1.0.0', packageId: 'com.example.app' },
			signatureReady: true,
		}).error, 'missing_credentials');
		assert.equal(decidePublish({
			type: 'mobile',
			publishTargets: ['google_play'],
			credentials: { googlePlay: true },
			metadata: { version: '1.0.0', packageId: 'com.example.app' },
		}).error, 'missing_signature');
		const ok = decidePublish({
			type: 'mobile',
			publishTargets: ['google_play', 'app_store'],
			credentials: { googlePlay: true, appStore: true },
			metadata: { version: '1.2.3', packageId: 'com.example.app' },
			signatureReady: true,
		});
		assert.equal(ok.ok, true);
		assert.deepEqual(ok.targets, ['google_play', 'app_store']);
	});

	it('inspecte les credentials sans persister la clé privée, et rédige les logs', () => {
		const play = inspectPlayServiceAccount({
			type: 'service_account',
			client_email: 'ci@x.iam.gserviceaccount.com',
			private_key: SAMPLE_P8,
		});
		assert.equal(play.ok, true);
		assert.equal(play.clientEmail, 'ci@x.iam.gserviceaccount.com');
		assert.equal('private_key' in play, false);
		assert.equal(inspectPlayServiceAccount({
			type: 'service_account',
			client_email: 'ci@x.iam.gserviceaccount.com',
		}).error, 'invalid_play_json');
		assert.equal(inspectPlayServiceAccount('{not json').error, 'invalid_play_json');
		assert.equal(inspectAppStoreP8(SAMPLE_P8).ok, true);
		assert.equal(inspectAppStoreP8('short').error, 'invalid_p8');
		assert.equal(inspectAppStoreIds({ keyId: 'AB12CD34', issuerId: '12345678-1234-1234-1234-1234567890ab' }).ok, true);
		assert.equal(inspectAppStoreIds({ keyId: 'x', issuerId: 'y' }).error, 'invalid_store_ids');
		assert.equal(inspectKeystore(16).error, 'invalid_keystore');
		assert.equal(inspectKeystore(64).ok, true);
		assert.equal(verifyPublishFiles({
			publishTargets: ['google_play'],
			files: { playJson: true, keystore: false },
		}).error, 'missing_signature');
		assert.equal(sanitizePublishError('missing_credentials'), 'missing_credentials');
		assert.equal(sanitizePublishError('DROP TABLE jobs'), 'write_failed');
		assert.equal('private_key' in redactPublishPayload({ packageId: 'com.example.app', private_key: SAMPLE_P8 }), false);
		assert.equal(redactPublishLog(SAMPLE_P8), '[redacted]');
		assert.equal(redactPublishLog('build_not_dispatched'), 'build_not_dispatched');
		const local = parsePublishLocal({
			version: '1.0.0',
			packageId: 'com.example.app',
			googlePlay: { configured: true, clientEmail: 'ci@x.iam.gserviceaccount.com', private_key: SAMPLE_P8 },
		});
		assert.equal(local.googlePlay.configured, true);
		assert.doesNotMatch(persistablePublishLocal(local), /BEGIN PRIVATE KEY|private_key/);
		const request = buildPublishRequest({
			userId: 'u1',
			decision: okDecision(),
			credentials: { googlePlay: true },
			signatureReady: true,
		});
		assert.equal(request.ok, true);
		assert.equal('private_key' in request.body, false);
		assert.equal(request.body.googlePlayConfigured, true);
	});

	it('échafaude un workflow public et un publish.local gitignoré', () => {
		const scaffold = scaffoldPublishFiles({ existingGitignore: 'node_modules\n' });
		assert.equal(scaffold.ok, true);
		assert.ok(scaffold.files.some((file) => file.path === PUBLISH_WORKFLOW_PATH));
		assert.ok(scaffold.files.some((file) => file.path === PUBLISH_LOCAL_PATH && file.gitignored));
		const gitignore = scaffold.files.find((file) => file.path === '.gitignore');
		assert.match(gitignore?.content || '', /play-service-account\.json/);
		assert.match(gitignore?.content || '', new RegExp(PUBLISH_PLAY_JSON_PATH.replace('.', '\\.')));
		const panel = formatPublishPanel({
			manifest: { type: 'mobile', publishTargets: ['google_play'] },
			local: { version: '1.0.0', packageId: 'com.example.app', googlePlay: { configured: true, clientEmail: 'ci@x.iam.gserviceaccount.com' } },
			job: { status: 'pending_ci' },
			logs: [SAMPLE_P8, 'build_not_dispatched'],
		});
		assert.match(panel, /pending_ci/);
		assert.match(panel, /build_not_dispatched/);
		assert.doesNotMatch(panel, /BEGIN PRIVATE KEY/);
		assert.match(formatPublishContext({ manifest: { type: 'mobile', publishTargets: ['app_store'] } }), /app_store/);
		assert.equal(formatPublishContext({ manifest: { type: 'website' } }), '');
	});
});

function okDecision() {
	return {
		ok: true,
		action: 'enqueue',
		targets: ['google_play'],
		metadata: { version: '1.0.0', packageId: 'com.example.app' },
	};
}
