#!/usr/bin/env node
/**
 * Phase 9.1 — kuunda-builder plan (renamed from void-builder).
 * Prints the gulp task and signing policy. Does not compile Electron.
 */
import { planKuundaBuild } from '../../packages/kuunda-ai/src/packaging-policy.js';

const platform = process.argv[2] || 'win32-x64';
const channel = process.argv[3] || 'internal';
const commit = process.argv[4] || 'unbuilt';
const plan = planKuundaBuild({
	platform,
	channel,
	commit,
	hasWindowsCert: process.env.HAS_WINDOWS_CERT === 'true',
	hasAppleIdentity: process.env.HAS_APPLE_IDENTITY === 'true',
	publicRelease: process.env.KUUNDA_PUBLIC_RELEASE === '1',
});
process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
if (!plan.ok) {
	process.exitCode = 1;
}
