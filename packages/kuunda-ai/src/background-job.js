/**
 * Phase 3.6 — background agent jobs always end in a reviewable diff, never auto-accept.
 */

export const BACKGROUND_JOB_STATUSES = Object.freeze([
	'queued',
	'running',
	'needs_review',
	'reviewed',
	'failed',
	'cancelled',
]);

/**
 * @param {{ id: string, prompt: string, threadId?: string | null, now?: string }} input
 */
export function createBackgroundJob(input) {
	return {
		id: input.id,
		prompt: input.prompt,
		threadId: input.threadId ?? null,
		status: 'queued',
		changedPaths: [],
		error: null,
		createdAt: input.now ?? new Date(0).toISOString(),
	};
}

const ALLOWED = {
	queued: new Set(['running', 'cancelled']),
	running: new Set(['needs_review', 'failed', 'cancelled']),
	needs_review: new Set(['reviewed', 'cancelled']),
	reviewed: new Set(),
	failed: new Set(),
	cancelled: new Set(),
};

/**
 * @param {ReturnType<typeof createBackgroundJob>} job
 * @param {{ type: 'start' } | { type: 'complete', changedPaths?: string[] } | { type: 'fail', error: string } | { type: 'cancel' } | { type: 'review' }} event
 */
export function transitionBackgroundJob(job, event) {
	const next = { ...job, changedPaths: [...(job.changedPaths || [])] };
	let target = job.status;
	if (event.type === 'start') target = 'running';
	else if (event.type === 'complete') {
		target = 'needs_review';
		next.changedPaths = [...(event.changedPaths || [])];
	}
	else if (event.type === 'fail') {
		target = 'failed';
		next.error = event.error;
	}
	else if (event.type === 'cancel') target = 'cancelled';
	else if (event.type === 'review') target = 'reviewed';

	if (!ALLOWED[job.status]?.has(target)) {
		return job;
	}
	next.status = target;
	return next;
}

export function collectCheckpointPaths(messages) {
	const paths = new Set();
	for (const message of messages || []) {
		if (message?.role !== 'checkpoint') continue;
		const snaps = message.voidFileSnapshotOfURI || {};
		for (const path of Object.keys(snaps)) {
			if (path) paths.add(path);
		}
	}
	return [...paths].sort();
}
