/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

type Compactable = { role?: string; content?: string; name?: string };

function totalChars(messages: Compactable[]): number {
	let n = 0;
	for (const m of messages) {
		n += (m.content || '').length;
	}
	return n;
}

export function summarizeMessage(message: Compactable): string {
	const preview = String(message.content || '').replace(/\s+/g, ' ').trim().slice(0, 160);
	if (message.role === 'tool') {
		return `[compacted tool ${message.name || 'unknown'}] ${preview}`;
	}
	if (message.role === 'assistant') {
		return `[compacted assistant] ${preview}`;
	}
	return preview || '[compacted]';
}

export function compactChatContext<T extends Compactable>(messages: T[], opts: { maxChars?: number; keepLast?: number } = {}): T[] {
	const maxChars = opts.maxChars ?? 80_000;
	const keepLast = opts.keepLast ?? 6;
	const out = messages.map((m) => ({ ...m }));
	if (totalChars(out) <= maxChars) {
		return out;
	}

	const protectedIdx = new Set<number>();
	const firstUser = out.findIndex((m) => m.role === 'user');
	if (firstUser >= 0) {
		protectedIdx.add(firstUser);
	}
	for (let i = Math.max(0, out.length - keepLast); i < out.length; i += 1) {
		protectedIdx.add(i);
	}

	for (let i = 0; i < out.length && totalChars(out) > maxChars; i += 1) {
		if (protectedIdx.has(i)) {
			continue;
		}
		out[i] = { ...out[i], content: summarizeMessage(out[i]) };
	}

	if (totalChars(out) > maxChars) {
		for (let i = 0; i < out.length && totalChars(out) > maxChars; i += 1) {
			if (protectedIdx.has(i)) {
				continue;
			}
			out[i] = { ...out[i], content: String(out[i].content || '').slice(0, 80) };
		}
	}

	return out;
}

export function contextBudgetChars(contextWindow: number, reservedOutputTokenSpace: number | null | undefined, charsPerToken = 4): number {
	const window = Number(contextWindow) || 0;
	const reserved = Math.max(window * 0.5, reservedOutputTokenSpace ?? 4_096);
	return Math.max(5_000, Math.floor((window - reserved) * charsPerToken * 0.85));
}
