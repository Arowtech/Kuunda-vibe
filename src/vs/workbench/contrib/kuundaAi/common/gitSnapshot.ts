/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

export const MAX_GIT_CONTEXT_CHARS = 12_000;

export type GitStatusRow = { code: string; path: string };

export type GitSnapshot = {
	folderName?: string;
	folderPath?: string;
	branch?: string;
	stat?: string;
	log?: string;
	status?: string;
};

export function parseGitStatusPorcelain(text: string): GitStatusRow[] {
	return String(text || '')
		.split('\n')
		.map((line) => line.trimEnd())
		.filter((line) => line && !line.startsWith('##'))
		.map((line) => ({
			code: line.slice(0, 2).trim(),
			path: line.slice(3).trim(),
		}))
		.filter((row) => row.path);
}

export function formatGitSnapshot(snapshot: GitSnapshot): string {
	const title = snapshot.folderName || snapshot.folderPath || 'repo';
	const parts = [`## ${title}`];
	if (snapshot.branch) {
		parts.push(`branch: ${snapshot.branch}`);
	}
	if (snapshot.stat) {
		parts.push(String(snapshot.stat).trim());
	}
	if (snapshot.status) {
		const rows = parseGitStatusPorcelain(snapshot.status);
		if (rows.length) {
			parts.push(rows.map((row) => `${row.code} ${row.path}`.trim()).join('\n'));
		}
	}
	if (snapshot.log) {
		parts.push(`recent:\n${String(snapshot.log).trim()}`);
	}
	return parts.join('\n');
}

export function formatMultiRepoGit(snapshots: GitSnapshot[], opts: { maxChars?: number } = {}): string {
	const maxChars = opts.maxChars ?? MAX_GIT_CONTEXT_CHARS;
	const rows = (snapshots || []).filter((row) => row && (row.branch || row.stat || row.log || row.status));
	if (!rows.length) {
		return '';
	}
	const body = rows.map((row) => formatGitSnapshot(row)).join('\n\n');
	const out = `Git repositories in this workspace:\n${body}`;
	if (out.length <= maxChars) {
		return out;
	}
	return `${out.slice(0, maxChars)}\n…`;
}
