import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createPlatformClient } from '../src/http-client.js';
import { DEFAULT_API_BASE_URL, classifyPaymentFailure, creditAlertLevel } from '../src/contracts.js';
import { verifyUpdateArtifact } from '../src/update-verifier.js';

describe('platform HTTP client', () => {
	it('n’embarque aucun secret et cible api.ide.kuunda-cloud.com', () => {
		const client = createPlatformClient({
			fetchImpl: async () => new Response(JSON.stringify({ remaining: 1 }), { status: 200 })
		});
		assert.equal(client.baseUrl, DEFAULT_API_BASE_URL);
		assert.doesNotMatch(JSON.stringify(client), /sk_|whsec_|BEGIN /);
	});

	it('envoie le bearer fourni à l’exécution, jamais une clé figée', async () => {
		/** @type {string | undefined} */
		let auth;
		const client = createPlatformClient({
			getAccessToken: async () => 'runtime-session',
			fetchImpl: async (_url, init) => {
				auth = new Headers(init.headers).get('Authorization');
				return new Response(JSON.stringify({ remaining: 12, includedQuota: 50, planId: 'free', userId: 'u1' }), {
					status: 200
				});
			}
		});
		const balance = await client.getBalance('u1');
		assert.equal(auth, 'Bearer runtime-session');
		assert.equal(balance.remaining, 12);
	});

	it('propage un statut HTTP comme erreur opaque', async () => {
		const client = createPlatformClient({
			fetchImpl: async () => new Response('nope', { status: 401 })
		});
		await assert.rejects(() => client.listPlans(), /platform_http_401/);
	});

	it('interrompt un appel trop lent', async () => {
		const client = createPlatformClient({
			timeoutMs: 20,
			fetchImpl: () => new Promise(() => {}),
		});
		await assert.rejects(() => client.listPlans(), /platform_timeout/);
	});

	it('appelle signup, consume et checkout sans secret figé', async () => {
		/** @type {string[]} */
		const paths = [];
		const client = createPlatformClient({
			fetchImpl: async (url, init) => {
				paths.push(`${init?.method || 'GET'} ${new URL(url).pathname}`);
				return new Response(JSON.stringify({ remaining: 49, includedQuota: 50, planId: 'free', userId: 'u1', checkoutUrl: 'https://api.ide.kuunda-cloud.com/v1/billing/hosted-checkout' }), { status: 200 });
			}
		});
		await client.signup('u1');
		await client.consume('u1', 1, 'agent_usage');
		await client.startCheckout('u1', 'plus');
		await client.provisionProject({ userId: 'u1', displayName: 'shop', projectType: 'webapp' });
		await client.listProjectTables('proj_ab');
		await client.enqueuePublishJob({
			userId: 'u1',
			targets: ['google_play'],
			version: '1.0.0',
			packageId: 'com.example.app',
			googlePlayConfigured: true,
			signatureReady: true,
		});
		await client.getPublishJob('job_ab', 'u1');
		await client.getPublishLogs('job_ab', 'u1');
		assert.deepEqual(paths, [
			'POST /v1/credits/signup',
			'POST /v1/credits/consume',
			'POST /v1/billing/checkout',
			'POST /v1/provisioning/projects',
			'GET /v1/provisioning/projects/proj_ab/tables',
			'POST /v1/publishing/jobs',
			'GET /v1/publishing/jobs/job_ab',
			'GET /v1/publishing/jobs/job_ab/logs',
		]);
	});
});

describe('credit alerts + payment failures (public UX)', () => {
	it('signale les 20 % restants puis le solde vide', () => {
		assert.equal(creditAlertLevel(40, 50), 'ok');
		assert.equal(creditAlertLevel(10, 50), 'low');
		assert.equal(creditAlertLevel(0, 50), 'empty');
	});

	it('classe les codes d’échec Genius Pay de façon opaque', () => {
		assert.equal(classifyPaymentFailure('insufficient_funds'), 'insufficient_funds');
		assert.equal(classifyPaymentFailure('timeout'), 'timeout');
		assert.equal(classifyPaymentFailure('declined'), 'declined');
		assert.equal(classifyPaymentFailure('wat'), 'unknown');
	});
});

describe('update integrity verifier', () => {
	it('accepte un artefact signé Ed25519 et refuse une altération', async () => {
		const pair = await crypto.subtle.generateKey('Ed25519', true, ['sign', 'verify']);
		const bytes = new TextEncoder().encode('kuunda-vibe-setup.exe');
		const digest = await crypto.subtle.digest('SHA-256', bytes);
		const signature = new Uint8Array(await crypto.subtle.sign('Ed25519', pair.privateKey, digest));
		const publicKey = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
		assert.equal(await verifyUpdateArtifact({ bytes, signature, publicKey }), true);
		const tampered = new Uint8Array(bytes);
		tampered[0] ^= 1;
		assert.equal(await verifyUpdateArtifact({ bytes: tampered, signature, publicKey }), false);
	});
});
