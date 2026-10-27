/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

export const SKILL_FILE_NAME = 'SKILL.md';
export const SKILLS_DIR_NAME = 'skills';
export const PROJECT_SKILLS_DIR = '.kuunda/skills';
export const MAX_SKILLS_CHARS = 20_000;
export const MAX_SKILL_FILE_CHARS = 8_000;

const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i;

export type SkillScope = 'user' | 'project';

export type SkillPromptEntry = {
	key: string;
	title: string;
	description: string;
	body: string;
	enabled: boolean;
};

export function sanitizeSkillId(value: string | undefined): string {
	const cleaned = String(value || '')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 64);
	if (!cleaned || cleaned === '.' || cleaned === '..' || WINDOWS_RESERVED_NAMES.test(cleaned)) {
		return '';
	}
	return cleaned;
}

export function parseSkillFile(raw: string | undefined): { name: string; description: string; body: string } | undefined {
	const text = String(raw || '').replace(/\r\n/g, '\n');
	let name = '';
	let description = '';
	let body = text.trim();
	if (text.startsWith('---\n')) {
		const end = text.indexOf('\n---', 4);
		if (end !== -1) {
			const front = text.slice(4, end);
			body = text.slice(end + 4).replace(/^\n/, '').trim();
			for (const line of front.split('\n')) {
				const trimmed = line.trim();
				const nameMatch = /^name:\s*(.*)$/.exec(trimmed);
				const descriptionMatch = /^description:\s*(.*)$/.exec(trimmed);
				if (nameMatch) {
					name = stripQuotes(nameMatch[1]);
				}
				if (descriptionMatch) {
					description = stripQuotes(descriptionMatch[1]);
				}
			}
		}
	}
	if (!body && !description && !name) {
		return undefined;
	}
	return {
		name: name.slice(0, 80),
		description: description.slice(0, 400),
		body: body.slice(0, MAX_SKILL_FILE_CHARS),
	};
}

export function starterSkill(id: string): string {
	const safe = sanitizeSkillId(id) || 'new-skill';
	return `---
name: ${safe}
description: When the agent should follow this skill.
---

# ${safe}

Write the steps and constraints the agent must follow for this kind of work.
`;
}

export function formatSkills(entries: SkillPromptEntry[] | undefined, opts: { maxChars?: number } = {}): string {
	const maxChars = opts.maxChars ?? MAX_SKILLS_CHARS;
	const enabled = (entries || []).filter((entry) => entry && entry.enabled && (entry.body || entry.description));
	if (!enabled.length) {
		return '';
	}
	const body = enabled
		.map((entry) => {
			const description = entry.description ? `${entry.description}\n\n` : '';
			return `### ${entry.title}\n${description}${entry.body}`.trim();
		})
		.join('\n\n');
	const out = `Skills:\n${body}`;
	if (out.length <= maxChars) {
		return out;
	}
	return `${out.slice(0, maxChars)}\n…`;
}

function stripQuotes(value: string): string {
	return value.trim().replace(/^["']|["']$/g, '');
}
