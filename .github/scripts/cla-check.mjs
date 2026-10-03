/**
 * Phase 0 — CLA gate for pull requests.
 * Steward / org members skip (GOVERNANCE.md). External contributors must
 * paste the Individual or Corporate CLA sentence in the PR body.
 * This is the CI enforcement; CLA Assistant GitHub App is optional extra.
 */

export const INDIVIDUAL_SENTENCE = 'I have read and agree to the Kuunda Vibe Individual CLA.';
export const CORPORATE_SENTENCE = 'We have read and agree to the Kuunda Vibe Corporate CLA.';
export const INDIVIDUAL_DOC = 'docs/legal/CLA-INDIVIDUAL.md';
export const CORPORATE_DOC = 'docs/legal/CLA-CORPORATE.md';

const DEFAULT_BOTS = Object.freeze([
	'dependabot[bot]',
	'github-actions[bot]',
	'renovate[bot]',
]);

const STEWARD_ASSOCIATIONS = Object.freeze(['OWNER', 'MEMBER']);

/**
 * @param {{ login?: string, authorAssociation?: string, body?: string, allowlist?: string[] }} input
 */
export function evaluateCla(input = {}) {
	const login = String(input.login || '').trim();
	const association = String(input.authorAssociation || '').trim().toUpperCase();
	const body = String(input.body || '');
	const allowlist = [...DEFAULT_BOTS, ...(input.allowlist || [])];

	if (!login) {
		return { ok: false, reason: 'missing_author' };
	}
	if (allowlist.includes(login)) {
		return { ok: true, reason: 'allowlist' };
	}
	if (STEWARD_ASSOCIATIONS.includes(association)) {
		return { ok: true, reason: 'steward_member' };
	}
	if (body.includes(INDIVIDUAL_SENTENCE)) {
		return { ok: true, reason: 'individual_cla' };
	}
	if (body.includes(CORPORATE_SENTENCE)) {
		return { ok: true, reason: 'corporate_cla' };
	}
	return {
		ok: false,
		reason: 'cla_required',
		message: `External contributor must paste this sentence in the pull request body: "${INDIVIDUAL_SENTENCE}" (or the corporate equivalent). See ${INDIVIDUAL_DOC} and ${CORPORATE_DOC}.`,
	};
}

const isMain = process.argv[1] && /cla-check\.mjs$/.test(process.argv[1].replace(/\\/g, '/'));
if (isMain) {
	const input = process.env.CLA_CHECK_JSON
		? JSON.parse(process.env.CLA_CHECK_JSON)
		: {
			login: process.env.PR_LOGIN,
			authorAssociation: process.env.PR_ASSOCIATION,
			body: process.env.PR_BODY,
		};
	const result = evaluateCla(input);
	process.stdout.write(`${JSON.stringify(result)}\n`);
	if (!result.ok) {
		process.stderr.write(`${result.message || result.reason}\n`);
		process.exitCode = 1;
	}
}
