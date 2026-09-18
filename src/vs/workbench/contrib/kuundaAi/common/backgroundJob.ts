/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

export type BackgroundJobStatus = 'queued' | 'running' | 'needs_review' | 'reviewed' | 'failed' | 'cancelled';

export type BackgroundJob = {
	id: string;
	prompt: string;
	threadId: string | null;
	status: BackgroundJobStatus;
	changedPaths: string[];
	error: string | null;
	createdAt: string;
};

export function createBackgroundJob(input: { id: string; prompt: string; threadId?: string | null; now?: string }): BackgroundJob {
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

const ALLOWED: Record<BackgroundJobStatus, Set<BackgroundJobStatus>> = {
	queued: new Set(['running', 'cancelled']),
	running: new Set(['needs_review', 'failed', 'cancelled']),
	needs_review: new Set(['reviewed', 'cancelled']),
	reviewed: new Set(),
	failed: new Set(),
	cancelled: new Set(),
};

export type BackgroundJobEvent =
	| { type: 'start' }
	| { type: 'complete'; changedPaths?: string[] }
	| { type: 'fail'; error: string }
	| { type: 'cancel' }
	| { type: 'review' };

export function transitionBackgroundJob(job: BackgroundJob, event: BackgroundJobEvent): BackgroundJob {
	const next: BackgroundJob = { ...job, changedPaths: [...(job.changedPaths || [])] };
	let target: BackgroundJobStatus = job.status;
	if (event.type === 'start') {
		target = 'running';
	} else if (event.type === 'complete') {
		target = 'needs_review';
		next.changedPaths = [...(event.changedPaths || [])];
	} else if (event.type === 'fail') {
		target = 'failed';
		next.error = event.error;
	} else if (event.type === 'cancel') {
		target = 'cancelled';
	} else if (event.type === 'review') {
		target = 'reviewed';
	}

	if (!ALLOWED[job.status].has(target)) {
		return job;
	}
	next.status = target;
	return next;
}

export function collectCheckpointPaths(messages: Array<{ role?: string; voidFileSnapshotOfURI?: { [path: string]: unknown } }>): string[] {
	const paths = new Set<string>();
	for (const message of messages || []) {
		if (message?.role !== 'checkpoint') {
			continue;
		}
		for (const path of Object.keys(message.voidFileSnapshotOfURI || {})) {
			if (path) {
				paths.add(path);
			}
		}
	}
	return [...paths].sort();
}
