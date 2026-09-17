/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

export type PermissionLevel = 'allow' | 'confirm' | 'review' | 'refuse';
export type ApprovalKind = 'edits' | 'terminal' | 'MCP tools' | 'read';
export type PermissionAction = 'run' | 'wait' | 'refuse';

export const PERMISSION_LEVELS: readonly PermissionLevel[] = ['allow', 'confirm', 'review', 'refuse'];

export const DEFAULT_TOOL_PERMISSIONS: Readonly<Record<string, PermissionLevel>> = {
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
};

const KIND_OF_TOOL: Record<string, ApprovalKind> = {
	create_file_or_folder: 'edits',
	delete_file_or_folder: 'edits',
	rewrite_file: 'edits',
	edit_file: 'edits',
	run_command: 'terminal',
	run_persistent_command: 'terminal',
	open_persistent_terminal: 'terminal',
	kill_persistent_terminal: 'terminal',
};

export function approvalKindOfTool(toolName: string): ApprovalKind {
	if (DEFAULT_TOOL_PERMISSIONS[toolName] === 'allow') {
		return 'read';
	}
	return KIND_OF_TOOL[toolName] ?? 'MCP tools';
}

export function decideToolPermission(input: {
	toolName: string;
	autoApproveByKind?: { [kind: string]: boolean | undefined };
	policyOverrides?: { [toolName: string]: PermissionLevel };
}): { level: PermissionLevel; kind: ApprovalKind; action: PermissionAction } {
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
