import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
	CORPORATE_SENTENCE,
	INDIVIDUAL_SENTENCE,
	evaluateCla,
} from '../.github/scripts/cla-check.mjs';

describe('Phase 0 — CLA CI', () => {
	it('laisse passer le steward et les bots', () => {
		assert.equal(evaluateCla({ login: 'alice', authorAssociation: 'OWNER' }).ok, true);
		assert.equal(evaluateCla({ login: 'bob', authorAssociation: 'MEMBER' }).reason, 'steward_member');
		assert.equal(evaluateCla({ login: 'dependabot[bot]', authorAssociation: 'NONE' }).reason, 'allowlist');
	});

	it('exige la phrase CLA pour un contributeur externe', () => {
		assert.equal(evaluateCla({ login: 'ext-dev', authorAssociation: 'CONTRIBUTOR', body: 'please merge' }).ok, false);
		assert.equal(evaluateCla({ login: 'ext-dev', authorAssociation: 'CONTRIBUTOR', body: 'please merge' }).reason, 'cla_required');
		assert.equal(evaluateCla({
			login: 'ext-dev',
			authorAssociation: 'FIRST_TIME_CONTRIBUTOR',
			body: `Thanks.\n${INDIVIDUAL_SENTENCE}\n`,
		}).reason, 'individual_cla');
		assert.equal(evaluateCla({
			login: 'corp-bot',
			authorAssociation: 'CONTRIBUTOR',
			body: CORPORATE_SENTENCE,
		}).reason, 'corporate_cla');
	});

	it('refuse une phrase CLA partielle', () => {
		assert.equal(evaluateCla({
			login: 'ext-dev',
			authorAssociation: 'CONTRIBUTOR',
			body: 'I agree to the CLA',
		}).ok, false);
	});
});
