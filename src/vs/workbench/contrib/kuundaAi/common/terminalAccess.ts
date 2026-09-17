/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import {
	canonicalizeFsPath,
	isAbsoluteFsPath,
	pathIsInside,
	pickWorkspaceFolder,
	resolveRelativeCwd,
} from './workspaceRoots.js';

export const TERMINAL_TOOL_NAMES = [
	'run_command',
	'open_persistent_terminal',
	'run_persistent_command',
	'kill_persistent_terminal',
] as const;

export type TerminalToolName = typeof TERMINAL_TOOL_NAMES[number];

export function classifyShellCommand(command: string | undefined): 'git' | 'shell' {
	const trimmed = String(command || '').trim();
	if (/^git(\s|$)/i.test(trimmed)) {
		return 'git';
	}
	return 'shell';
}

export function resolveAgentCwd(input: {
	cwd: string | null | undefined;
	workspaceFolders: string[];
	command?: string;
}): { ok: true; cwd: string; folder: string; kind: 'git' | 'shell' } | { ok: false; error: 'no_workspace' | 'outside_workspace'; kind: 'git' | 'shell' } {
	const kind = classifyShellCommand(input.command);
	const folders = (input.workspaceFolders || []).filter(Boolean);
	if (!folders.length) {
		return { ok: false, error: 'no_workspace', kind };
	}
	let resolved: string | null;
	if (!input.cwd) {
		resolved = canonicalizeFsPath(folders[0]);
	} else if (!isAbsoluteFsPath(input.cwd)) {
		resolved = resolveRelativeCwd(input.cwd, folders);
	} else {
		resolved = canonicalizeFsPath(input.cwd);
	}
	const folder = pickWorkspaceFolder(resolved, folders);
	if (!resolved || !folder || !pathIsInside(resolved, folder)) {
		return { ok: false, error: 'outside_workspace', kind };
	}
	return { ok: true, cwd: resolved, folder, kind };
}
