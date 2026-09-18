/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import {
	canonicalizeFsPath,
	isAbsoluteFsPath,
	joinFsPath,
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

function unquotePath(value: string): string {
	const text = String(value || '').trim();
	if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
		return text.slice(1, -1).replace(/\\"/g, '"');
	}
	return text;
}

function quoteShellPath(path: string): string {
	return `"${String(path || '').replace(/"/g, '\\"')}"`;
}

function isWindowsFsPath(path: string): boolean {
	return /^[A-Za-z]:[\\/]/.test(path) || (path.includes('\\') && !path.startsWith('/'));
}

function prefixCd(cwd: string, rest: string): string {
	const quoted = quoteShellPath(cwd);
	const cd = isWindowsFsPath(cwd) ? `cd /d ${quoted}` : `cd ${quoted}`;
	const tail = String(rest || '').trim();
	return tail ? `${cd} && ${tail}` : cd;
}

export function extractLeadingCd(command: string | undefined): { dir: string; rest: string; unsafe: boolean } | undefined {
	const text = String(command || '');
	if (!/^\s*(?:cd|chdir|pushd|set-location|sl)(?:\s|\/|$)/i.test(text)) {
		return undefined;
	}
	const match = text.match(/^\s*(?:cd|chdir|pushd|set-location|sl)(?:\s+\/[dD])?\s+(?:"((?:\\.|[^"])*)"|'([^']*)'|([^\s;&|]+))\s*(?:(?:&&|&|\|\||\||;)\s*([\s\S]*))?$/i);
	if (!match) {
		return { dir: '', rest: '', unsafe: true };
	}
	const dir = unquotePath(match[1] ?? match[2] ?? match[3] ?? '');
	if (!dir || dir === '-' || dir.startsWith('~') || dir === '/' || /[%$]/.test(dir)) {
		return { dir, rest: String(match[4] || '').trim(), unsafe: true };
	}
	return { dir, rest: String(match[4] || '').trim(), unsafe: false };
}

export function rewritePersistentShell(input: {
	command?: string;
	cwd?: string | null;
	workspaceFolders?: string[];
}): { ok: true; command: string; rewritten: boolean; cwd?: string } | { ok: false; error: 'no_workspace' | 'outside_workspace'; command: string } {
	const command = String(input.command || '');
	const folders = (input.workspaceFolders || []).filter(Boolean);
	const leading = extractLeadingCd(command);
	if (!leading) {
		return { ok: true, command, rewritten: false };
	}
	if (leading.unsafe) {
		return { ok: false, error: 'outside_workspace', command };
	}
	let target = leading.dir;
	if (!isAbsoluteFsPath(target)) {
		const base = input.cwd || folders[0];
		if (!base) {
			return { ok: false, error: 'no_workspace', command };
		}
		target = joinFsPath(base, target);
	}
	const resolved = resolveAgentCwd({ cwd: target, workspaceFolders: folders, command });
	if (!resolved.ok) {
		return { ok: false, error: resolved.error, command };
	}
	return {
		ok: true,
		command: prefixCd(resolved.cwd, leading.rest),
		rewritten: true,
		cwd: resolved.cwd,
	};
}
