/**
 * Phase 4.1 — agent terminal cwd must stay inside the workspace.
 */

import {
	canonicalizeFsPath,
	isAbsoluteFsPath,
	joinFsPath,
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

function unquotePath(value) {
	const text = String(value || '').trim();
	if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
		return text.slice(1, -1).replace(/\\"/g, '"');
	}
	return text;
}

function quoteShellPath(path) {
	return `"${String(path || '').replace(/"/g, '\\"')}"`;
}

function isWindowsFsPath(path) {
	return /^[A-Za-z]:[\\/]/.test(path) || (path.includes('\\') && !path.startsWith('/'));
}

function prefixCd(cwd, rest) {
	const quoted = quoteShellPath(cwd);
	const cd = isWindowsFsPath(cwd) ? `cd /d ${quoted}` : `cd ${quoted}`;
	const tail = String(rest || '').trim();
	return tail ? `${cd} && ${tail}` : cd;
}

/**
 * Parse a leading directory change (`cd` / `chdir` / `pushd` / PowerShell Set-Location).
 * Unparseable cd is unsafe (fail closed). `&` / `||` are treated as separators.
 * @param {string} command
 * @returns {{ dir: string, rest: string, unsafe: boolean } | undefined}
 */
export function extractLeadingCd(command) {
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

/**
 * Confirm `cd` in an already-open persistent terminal stays inside the workspace.
 * Commands without a leading `cd` are left unchanged (cwd was set at open).
 *
 * @param {{ command?: string, cwd?: string | null, workspaceFolders?: string[] }} input
 */
export function rewritePersistentShell(input = {}) {
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
