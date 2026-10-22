#!/usr/bin/env node
/**
 * Phase 10.3 — upstream sync plan. Prints policy. Does not rebase or force-push.
 */
import { planUpstreamSync } from '../../packages/kuunda-ai/src/post-launch-policy.js';

const daysSinceSync = Number(process.argv[2] || '0');
const plan = planUpstreamSync({
	daysSinceSync,
	autoRebase: process.env.KUUNDA_AUTO_REBASE === '1',
	forcePush: process.env.KUUNDA_FORCE_PUSH === '1',
});
process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
if (!plan.ok) {
	process.exitCode = 1;
}
