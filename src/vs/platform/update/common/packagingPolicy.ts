/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

export const SIGNATURE_ALGORITHM = 'Ed25519-SHA256';
export const UPDATE_VERIFY_ALWAYS = true;
export const UPDATE_DOWNLOAD_HOST = 'updates.ide.kuunda-cloud.com';
const SHA256_HEX = /^[0-9a-f]{64}$/i;

export type UpdateManifestFields = {
	url?: string;
	version?: string;
	productVersion?: string;
	sha256hash?: string;
	signature?: string;
};

export type UpdateSignatureResult =
	| { ok: true; algorithm: string; sha256hash: string; signature: string }
	| { ok: false; error: string; algorithm?: string };

export function isAllowedUpdateDownloadUrl(url: string | undefined): boolean {
	try {
		const parsed = new URL(String(url || ''));
		return parsed.protocol === 'https:' && parsed.hostname === UPDATE_DOWNLOAD_HOST;
	} catch {
		return false;
	}
}

export function requireUpdateSignature(manifest: UpdateManifestFields = {}): UpdateSignatureResult {
	if (!manifest.url || !manifest.version || !manifest.productVersion) {
		return { ok: false, error: 'invalid_manifest' };
	}
	if (!isAllowedUpdateDownloadUrl(manifest.url)) {
		return { ok: false, error: 'url_not_allowed' };
	}
	const sha256hash = String(manifest.sha256hash || '').trim().toLowerCase();
	const signature = String(manifest.signature || '').replace(/\s/g, '');
	if (!SHA256_HEX.test(sha256hash) || signature.length < 80) {
		return { ok: false, error: 'signature_required', algorithm: SIGNATURE_ALGORITHM };
	}
	if (UPDATE_VERIFY_ALWAYS !== true) {
		return { ok: false, error: 'verify_disabled_forbidden' };
	}
	return { ok: true, algorithm: SIGNATURE_ALGORITHM, sha256hash, signature };
}

export function inspectUpdateManifest(update: UpdateManifestFields | null | undefined): UpdateSignatureResult {
	if (!update) {
		return { ok: false, error: 'invalid_manifest' };
	}
	return requireUpdateSignature(update);
}

export function formatUpdateIntegrityError(locale = 'en'): string {
	const fr = locale === 'fr' || locale.startsWith('fr');
	return fr
		? 'Mise à jour refusée : signature Ed25519 absente ou invalide. La vérification ne peut pas être désactivée.'
		: 'Update rejected: missing or invalid Ed25519 signature. Verification cannot be turned off.';
}
