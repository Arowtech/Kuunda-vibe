/**
 * Sign an installer and publish it to updates.ide.kuunda-cloud.com.
 * The private key stays in KUUNDA_UPDATE_SIGNING_KEY. Nothing here is a secret log.
 *
 * Generate a key once, store the PEM in the GitHub secret, then:
 *   KUUNDA_UPDATE_SIGNING_KEY="$(cat key.pem)" node scripts/kuunda-builder/publish-update.mjs --print-public-key
 * Commit only the printed public key as product.json kuundaUpdatePublicKey.
 */
import { createHash, createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { createReadStream, readdirSync, readFileSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { basename, join } from 'node:path';

const HOST = 'https://updates.ide.kuunda-cloud.com';
const BUCKET = process.env.KUUNDA_UPDATES_BUCKET || 'kuunda-vibe-updates';

function warn(message) {
	console.log(`::warning::${message}`);
}

function fail(message) {
	console.error(message);
	process.exit(1);
}

function publicKeyRawB64(privateKey) {
	const spki = createPublicKey(privateKey).export({ type: 'spki', format: 'der' });
	return Buffer.from(spki).subarray(spki.length - 32).toString('base64');
}

function sha256File(file) {
	return new Promise((resolve, reject) => {
		const hash = createHash('sha256');
		const input = createReadStream(file);
		input.on('error', reject);
		input.on('data', (chunk) => hash.update(chunk));
		input.on('end', () => resolve(hash.digest()));
	});
}

function platformFor(name) {
	const file = name.toLowerCase();
	if (file.endsWith('.exe') && file.includes('arm64')) {
		return 'win32-arm64';
	}
	if (file.endsWith('.exe')) {
		return 'win32-x64';
	}
	if (file.endsWith('.dmg') && file.includes('arm64')) {
		return 'darwin-arm64';
	}
	if (file.endsWith('.dmg')) {
		return 'darwin-x64';
	}
	return '';
}

function installers(dir) {
	return readdirSync(dir)
		.filter((name) => name.endsWith('.exe') || name.endsWith('.dmg'))
		.map((name) => join(dir, name))
		.filter((file) => statSync(file).isFile());
}

async function publishOne(file, signingKey, token, quality, commit, productVersion) {
	const platform = platformFor(basename(file));
	if (!platform) {
		fail(`Unrecognised installer name: ${basename(file)}`);
	}
	const digest = await sha256File(file);
	const signature = sign(null, digest, signingKey).toString('base64');
	if (signature.length < 80) {
		fail('Ed25519 signature is too short to publish.');
	}
	const sha256hash = digest.toString('hex');
	const target = `${BUCKET}/files/${sha256hash}`;
	const uploaded = spawnSync('npx', ['--yes', 'wrangler@4.143.1', 'r2', 'object', 'put', target, '--file', file, '--remote'], {
		stdio: 'inherit',
		env: process.env,
		shell: process.platform === 'win32',
	});
	if (uploaded.status !== 0) {
		fail(`R2 upload failed for ${basename(file)}.`);
	}
	const response = await fetch(`${HOST}/api/artifacts`, {
		method: 'POST',
		headers: {
			authorization: `Bearer ${token}`,
			'content-type': 'application/json',
		},
		body: JSON.stringify({
			platform,
			quality,
			commit,
			url: `${HOST}/artifacts/${sha256hash}`,
			version: productVersion,
			productVersion,
			sha256hash,
			signature,
			releasedAt: Date.now(),
		}),
	});
	if (!response.ok) {
		fail(`Update feed rejected ${basename(file)} (${response.status}).`);
	}
	console.log(`Published ${platform} ${sha256hash.slice(0, 12)} to ${quality}.`);
}

async function main() {
	const signingPem = process.env.KUUNDA_UPDATE_SIGNING_KEY || '';
	if (process.argv.includes('--print-public-key')) {
		if (!signingPem) {
			fail('KUUNDA_UPDATE_SIGNING_KEY is empty.');
		}
		console.log(publicKeyRawB64(createPrivateKey(signingPem)));
		return;
	}
	const token = process.env.UPDATE_PUBLISH_TOKEN || '';
	const cfToken = process.env.CLOUDFLARE_API_TOKEN || '';
	const account = process.env.CLOUDFLARE_ACCOUNT_ID || '';
	if (!signingPem && !token && !cfToken && !account) {
		warn('Update feed skipped. Set KUUNDA_UPDATE_SIGNING_KEY, UPDATE_PUBLISH_TOKEN, CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID, and create the R2 bucket kuunda-vibe-updates.');
		return;
	}
	if (!signingPem || !token || !cfToken || !account) {
		fail('Update publish is partial. Set KUUNDA_UPDATE_SIGNING_KEY, UPDATE_PUBLISH_TOKEN, CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID together.');
	}
	const quality = process.env.CHANNEL || 'internal';
	if (quality !== 'internal' && quality !== 'staging') {
		fail(`Channel ${quality} cannot be published.`);
	}
	const commit = process.env.KUUNDA_UPDATE_COMMIT || '';
	if (!/^[0-9a-f]{7,64}$/i.test(commit)) {
		fail('KUUNDA_UPDATE_COMMIT must be the git commit of this build.');
	}
	const product = JSON.parse(readFileSync(new URL('../../product.json', import.meta.url), 'utf8'));
	const signingKey = createPrivateKey(signingPem);
	const derived = publicKeyRawB64(signingKey);
	if (product.kuundaUpdatePublicKey !== derived) {
		console.error('product.json kuundaUpdatePublicKey does not match KUUNDA_UPDATE_SIGNING_KEY.');
		console.error(`Public key to commit: ${derived}`);
		process.exit(1);
	}
	const productVersion = String(product.voidVersion || '').trim();
	if (!productVersion) {
		fail('product.json voidVersion is empty.');
	}
	const dir = process.argv.find((arg) => !arg.startsWith('-') && arg !== process.argv[0] && arg !== process.argv[1]);
	const files = dir ? installers(dir) : [];
	if (!files.length) {
		fail('No .exe or .dmg found to publish.');
	}
	for (const file of files) {
		await publishOne(file, signingKey, token, quality, commit, productVersion);
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : 'publish failed');
	process.exit(1);
});
