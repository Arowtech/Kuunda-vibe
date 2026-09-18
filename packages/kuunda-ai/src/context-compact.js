/**
 * Phase 3.4 — keep the first user turn and the recent tail, summarize the middle.
 * Runs before Void's character trim so long tool payloads do not evict the task.
 */

function totalChars(messages) {
	let n = 0;
	for (const m of messages) n += (m.content || '').length;
	return n;
}

/**
 * @param {{ role?: string, content?: string, name?: string }} message
 */
export function summarizeMessage(message) {
	const preview = String(message.content || '').replace(/\s+/g, ' ').trim().slice(0, 160);
	if (message.role === 'tool') {
		return `[compacted tool ${message.name || 'unknown'}] ${preview}`;
	}
	if (message.role === 'assistant') {
		return `[compacted assistant] ${preview}`;
	}
	return preview || '[compacted]';
}

/**
 * @template { { role?: string, content?: string, name?: string } } T
 * @param {T[]} messages
 * @param {{ maxChars?: number, keepLast?: number }} [opts]
 * @returns {T[]}
 */
export function compactChatContext(messages, opts = {}) {
	const maxChars = opts.maxChars ?? 80_000;
	const keepLast = opts.keepLast ?? 6;
	const out = messages.map((m) => ({ ...m }));
	if (totalChars(out) <= maxChars) return out;

	const protectedIdx = new Set();
	const firstUser = out.findIndex((m) => m.role === 'user');
	if (firstUser >= 0) protectedIdx.add(firstUser);
	for (let i = Math.max(0, out.length - keepLast); i < out.length; i += 1) {
		protectedIdx.add(i);
	}

	for (let i = 0; i < out.length && totalChars(out) > maxChars; i += 1) {
		if (protectedIdx.has(i)) continue;
		out[i] = { ...out[i], content: summarizeMessage(out[i]) };
	}

	if (totalChars(out) > maxChars) {
		for (let i = 0; i < out.length && totalChars(out) > maxChars; i += 1) {
			if (protectedIdx.has(i)) continue;
			const short = String(out[i].content || '').slice(0, 80);
			out[i] = { ...out[i], content: short };
		}
	}

	return out;
}

/**
 * Character budget for compaction, derived from the model context window.
 * Leaves headroom for the system prompt and Void's later character trim.
 */
export function contextBudgetChars(contextWindow, reservedOutputTokenSpace, charsPerToken = 4) {
	const window = Number(contextWindow) || 0;
	const reserved = Math.max(window * 0.5, reservedOutputTokenSpace ?? 4_096);
	return Math.max(5_000, Math.floor((window - reserved) * charsPerToken * 0.85));
}
