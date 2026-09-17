/**
 * Local lexical-semantic codebase index (Phase 2.3, @Codebase).
 * No embeddings API, no secrets: BM25 over path + content tokens.
 */

const TOKEN = /[A-Za-z_][A-Za-z0-9_]*|[0-9]+/g;
const SKIP_PATH = /(^|[\\/])(node_modules|\.git|out|dist|\.build)([\\/]|$)/i;

/**
 * @typedef {object} CodebaseDocument
 * @property {string} path
 * @property {string} content
 *
 * @typedef {object} CodebaseHit
 * @property {string} path
 * @property {number} score
 * @property {string} snippet
 */

function tokenize(text) {
	const raw = (text ?? '').toLowerCase().match(TOKEN) ?? [];
	return raw.filter((t) => t.length > 1);
}

function snippetAround(content, queryTerms, maxLen = 240) {
	const lower = content.toLowerCase();
	let idx = -1;
	for (const term of queryTerms) {
		idx = lower.indexOf(term);
		if (idx >= 0) {
			break;
		}
	}
	if (idx < 0) {
		return content.slice(0, maxLen).trim();
	}
	const start = Math.max(0, idx - 80);
	return (start > 0 ? '…' : '') + content.slice(start, start + maxLen).trim();
}

export function shouldIndexPath(path) {
	return !SKIP_PATH.test(path ?? '');
}

export function createCodebaseIndex() {
	/** @type {CodebaseDocument[]} */
	let docs = [];
	/** @type {Map<string, number>} */
	let df = new Map();
	let avgLen = 0;

	function rebuildStats() {
		df = new Map();
		let total = 0;
		for (const doc of docs) {
			const unique = new Set(tokenize(`${doc.path}\n${doc.content}`));
			total += tokenize(doc.content).length;
			for (const term of unique) {
				df.set(term, (df.get(term) ?? 0) + 1);
			}
		}
		avgLen = docs.length === 0 ? 0 : total / docs.length;
	}

	return {
		/**
		 * @param {CodebaseDocument[]} next
		 */
		replaceAll(next) {
			docs = (next ?? []).filter((d) => d && shouldIndexPath(d.path));
			rebuildStats();
		},
		size() {
			return docs.length;
		},
		/**
		 * @param {string} query
		 * @param {{ limit?: number }} [opts]
		 * @returns {CodebaseHit[]}
		 */
		search(query, opts = {}) {
			const limit = opts.limit ?? 8;
			const qTerms = tokenize(query);
			if (qTerms.length === 0 || docs.length === 0) {
				return [];
			}
			const N = docs.length;
			const k1 = 1.2;
			const b = 0.75;
			const scored = [];
			for (const doc of docs) {
				const tokens = tokenize(`${doc.path}\n${doc.content}`);
				const tf = new Map();
				for (const t of tokens) {
					tf.set(t, (tf.get(t) ?? 0) + 1);
				}
				const dl = tokens.length || 1;
				let score = 0;
				for (const term of qTerms) {
					const f = tf.get(term) ?? 0;
					if (f === 0) {
						continue;
					}
					const n = df.get(term) ?? 0;
					const idf = Math.log(1 + (N - n + 0.5) / (n + 0.5));
					score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + b * (dl / (avgLen || dl)))));
					if (doc.path.toLowerCase().includes(term)) {
						score += 1.5;
					}
				}
				if (score > 0) {
					scored.push({
						path: doc.path,
						score,
						snippet: snippetAround(doc.content, qTerms),
					});
				}
			}
			scored.sort((a, b) => b.score - a.score);
			return scored.slice(0, limit);
		},
	};
}

/**
 * Format hits for a chat system / user context block (English, locale-agnostic).
 * @param {CodebaseHit[]} hits
 */
export function formatCodebaseContext(hits) {
	if (!hits || hits.length === 0) {
		return '';
	}
	const lines = ['Codebase search hits:'];
	for (const hit of hits) {
		lines.push(`- ${hit.path}`);
		if (hit.snippet) {
			lines.push(`  ${hit.snippet.replace(/\s+/g, ' ')}`);
		}
	}
	return lines.join('\n');
}
