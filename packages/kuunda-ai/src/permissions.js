/**
 * Phase 3.3 — four permission levels for agent tools.
 * Void only has a boolean autoApprove per kind; Kuunda maps that onto
 * allow / confirm / review / refuse without rewriting toolsService.
 */

export const PERMISSION_LEVELS = Object.freeze(['allow', 'confirm', 'review', 'refuse']);

/** @typedef {'allow' | 'confirm' | 'review' | 'refuse'} PermissionLevel */
/** @typedef {'edits' | 'terminal' | 'MCP tools' | 'read'} ApprovalKind */

export const DEFAULT_TOOL_PERMISSIONS = Object.freeze({
	read_file: 'allow',
	ls_dir: 'allow',
	get_dir_tree: 'allow',
	search_pathnames_only: 'allow',
	search_for_files: 'allow',
	search_in_file: 'allow',
	read_lint_errors: 'allow',
	rewrite_file: 'confirm',
	edit_file: 'confirm',
	create_file_or_folder: 'confirm',
	delete_file_or_folder: 'review',
	run_command: 'confirm',
	open_persistent_terminal: 'confirm',
	run_persistent_command: 'confirm',
	kill_persistent_terminal: 'confirm',
});

const KIND_OF_TOOL = Object.freeze({
	create_file_or_folder: 'edits',
	delete_file_or_folder: 'edits',
	rewrite_file: 'edits',
	edit_file: 'edits',
	run_command: 'terminal',
	run_persistent_command: 'terminal',
	open_persistent_terminal: 'terminal',
	kill_persistent_terminal: 'terminal',
});

/**
 * @param {string} toolName
 * @returns {ApprovalKind}
 */
export function approvalKindOfTool(toolName) {
	if (DEFAULT_TOOL_PERMISSIONS[toolName] === 'allow') return 'read';
	if (KIND_OF_TOOL[toolName]) return KIND_OF_TOOL[toolName];
	return 'MCP tools';
}

/**
 * @param {{ toolName: string, autoApproveByKind?: Record<string, boolean | undefined>, policyOverrides?: Record<string, PermissionLevel> }} input
 */
export function decideToolPermission(input) {
	const toolName = input.toolName || '';
	const level = input.policyOverrides?.[toolName] ?? DEFAULT_TOOL_PERMISSIONS[toolName] ?? 'confirm';
	const kind = approvalKindOfTool(toolName);

	if (level === 'refuse') {
		return { level, kind, action: 'refuse' };
	}
	if (level === 'allow') {
		return { level, kind, action: 'run' };
	}
	if (level === 'review') {
		return { level, kind, action: 'wait' };
	}
	if (input.autoApproveByKind?.[kind]) {
		return { level, kind, action: 'run' };
	}
	return { level, kind, action: 'wait' };
}
