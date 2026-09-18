/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

export function normalizeFsPath(p: string): string {
	return String(p || '').replace(/\\/g, '/').replace(/\/+$/, '');
}

export function isAbsoluteFsPath(p: string): boolean {
	const n = normalizeFsPath(p);
	return n.startsWith('/') || /^[A-Za-z]:\//.test(n) || /^[A-Za-z]:$/.test(n);
}

export function joinFsPath(base: string, rel: string): string {
	const baseN = normalizeFsPath(base);
	const relN = normalizeFsPath(rel);
	const driveMatch = baseN.match(/^([A-Za-z]:)(\/.*)?$/);
	const unixAbs = baseN.startsWith('/');
	const parts: string[] = [];
	if (driveMatch) {
		parts.push(driveMatch[1]);
		const rest = (driveMatch[2] || '').replace(/^\//, '');
		if (rest) {
			parts.push(...rest.split('/').filter(Boolean));
		}
	} else if (unixAbs) {
		parts.push('');
		const rest = baseN.replace(/^\//, '');
		if (rest) {
			parts.push(...rest.split('/').filter(Boolean));
		}
	} else if (baseN) {
		parts.push(...baseN.split('/').filter(Boolean));
	}
	for (const seg of relN.split('/')) {
		if (!seg || seg === '.') {
			continue;
		}
		if (seg === '..') {
			if (driveMatch && parts.length <= 1) {
				continue;
			}
			if (unixAbs && parts.length <= 1) {
				continue;
			}
			if (parts.length) {
				parts.pop();
			}
			continue;
		}
		parts.push(seg);
	}
	if (driveMatch) {
		return parts.length === 1 ? `${parts[0]}/` : `${parts[0]}/${parts.slice(1).join('/')}`;
	}
	if (unixAbs) {
		return `/${parts.filter(Boolean).join('/')}`;
	}
	return parts.join('/');
}

export function canonicalizeFsPath(p: string): string {
	const n = normalizeFsPath(p);
	if (n.startsWith('/')) {
		return joinFsPath('/', n.slice(1) || '.');
	}
	if (/^[A-Za-z]:/.test(n)) {
		const drive = n.slice(0, 2);
		const rest = n.slice(2).replace(/^\//, '');
		return joinFsPath(`${drive}/`, rest || '.');
	}
	return n;
}

export function pathIsInside(child: string, parent: string): boolean {
	const c = canonicalizeFsPath(child).toLowerCase();
	const p = canonicalizeFsPath(parent).toLowerCase();
	if (!c || !p) {
		return false;
	}
	return c === p || c.startsWith(`${p}/`);
}

export function pickWorkspaceFolder(targetPath: string | null | undefined, folders: string[]): string | null {
	const list = (folders || []).filter(Boolean);
	if (!list.length) {
		return null;
	}
	if (!targetPath) {
		return list[0];
	}
	if (!isAbsoluteFsPath(targetPath)) {
		return list[0];
	}
	const canonical = canonicalizeFsPath(targetPath);
	const hits = list.filter((folder) => pathIsInside(canonical, folder));
	hits.sort((a, b) => canonicalizeFsPath(b).length - canonicalizeFsPath(a).length);
	return hits[0] || null;
}

export function folderNameOf(path: string): string {
	return canonicalizeFsPath(path).split('/').filter(Boolean).pop() || path;
}

export function resolveRelativeCwd(rel: string, folders: string[]): string | null {
	const list = (folders || []).filter(Boolean);
	if (!list.length) {
		return null;
	}
	const n = normalizeFsPath(rel).replace(/^\.\//, '');
	const first = n.split('/')[0];
	const named = list.filter((folder) => folderNameOf(folder).toLowerCase() === String(first || '').toLowerCase());
	if (named.length === 1) {
		const rest = n.split('/').slice(1).join('/');
		return rest ? joinFsPath(named[0], rest) : canonicalizeFsPath(named[0]);
	}
	return joinFsPath(list[0], n);
}

export function listWorkspaceRoots(folders: string[]): Array<{ path: string; name: string }> {
	return (folders || []).filter(Boolean).map((folder) => ({
		path: folder,
		name: folderNameOf(folder),
	}));
}

export function formatWorkspaceRoots(folders: string[]): string {
	const roots = listWorkspaceRoots(folders);
	if (roots.length <= 1) {
		return '';
	}
	return `Workspace folders (multi-root):\n${roots.map((r) => `- ${r.name}: ${r.path}`).join('\n')}`;
}
