/**
 * Phase 4.2 — format git context for the agent (no secrets, no credentials).
 */

export const MAX_GIT_CONTEXT_CHARS = 12_000;

/**
 * @param {string} text `git status --porcelain`
 */
export function parseGitStatusPorcelain(text) {
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

export function formatGitSnapshot({ folderName, folderPath, branch, stat, log, status }) {
	const title = folderName || folderPath || 'repo';
	const parts = [`## ${title}`];
	if (branch) {
		parts.push(`branch: ${branch}`);
	}
	if (stat) {
		parts.push(String(stat).trim());
	}
	if (status) {
		const rows = parseGitStatusPorcelain(status);
		if (rows.length) {
			parts.push(rows.map((row) => `${row.code} ${row.path}`.trim()).join('\n'));
		}
	}
	if (log) {
		parts.push(`recent:\n${String(log).trim()}`);
	}
	return parts.join('\n');
}

export function formatMultiRepoGit(snapshots, opts = {}) {
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
