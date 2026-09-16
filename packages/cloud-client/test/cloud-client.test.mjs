import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createPlatformClient } from '../src/http-client.js';
import { DEFAULT_API_BASE_URL } from '../src/contracts.js';
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
