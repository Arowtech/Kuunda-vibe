/**
 * Phase 4.1 — agent terminal cwd must stay inside the workspace.
 */

import {
	canonicalizeFsPath,
	isAbsoluteFsPath,
	pathIsInside,
	pickWorkspaceFolder,
	resolveRelativeCwd,
} from './workspace-roots.js';

export const TERMINAL_TOOL_NAMES = Object.freeze([
	'run_command',
	'open_persistent_terminal',
	'run_persistent_command',
	'kill_persistent_terminal',
]);

export function classifyShellCommand(command) {
	const trimmed = String(command || '').trim();
	if (/^git(\s|$)/i.test(trimmed)) {
		return 'git';
	}
	return 'shell';
}

export function resolveAgentCwd({ cwd, workspaceFolders, command }) {
	const kind = classifyShellCommand(command);
	const folders = (workspaceFolders || []).filter(Boolean);
	if (!folders.length) {
		return { ok: false, error: 'no_workspace', kind };
	}
	let resolved;
	if (!cwd) {
		resolved = canonicalizeFsPath(folders[0]);
	} else if (!isAbsoluteFsPath(cwd)) {
		resolved = resolveRelativeCwd(cwd, folders);
	} else {
		resolved = canonicalizeFsPath(cwd);
	}
	const folder = pickWorkspaceFolder(resolved, folders);
	if (!folder || !pathIsInside(resolved, folder)) {
		return { ok: false, error: 'outside_workspace', kind };
	}
	return { ok: true, cwd: resolved, folder, kind };
}
