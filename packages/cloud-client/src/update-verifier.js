/**
 * Client-side IDE update verification. The private signing key never lives here.
 * Algorithm: Ed25519 over SHA-256(bytes).
 *
 * @param {import('./contracts.js').UpdateArtifact} artifact
 * @returns {Promise<boolean>}
 */
export async function verifyUpdateArtifact(artifact) {
	if (!artifact?.bytes?.length || !artifact?.signature?.length || !artifact?.publicKey?.length) {
		return false;
	}
	try {
		const digest = await crypto.subtle.digest('SHA-256', artifact.bytes);
		const key = await crypto.subtle.importKey(
			'raw',
			artifact.publicKey,
			{ name: 'Ed25519' },
			false,
			['verify']
		);
		return crypto.subtle.verify('Ed25519', key, artifact.signature, digest);
	} catch {
		return false;
	}
}
