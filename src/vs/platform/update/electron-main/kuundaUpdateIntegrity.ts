/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import { readFile } from 'fs/promises';
import { formatUpdateIntegrityError } from '../common/packagingPolicy.js';

function toBytes(input: Uint8Array | ArrayBuffer): Uint8Array {
	return input instanceof Uint8Array ? input : new Uint8Array(input);
}

export async function verifyKuundaUpdateBytes(artifact: { bytes: Uint8Array; signature: Uint8Array; publicKey: Uint8Array }): Promise<boolean> {
	if (!artifact?.bytes?.length || !artifact?.signature?.length || !artifact?.publicKey?.length) {
		return false;
	}
	try {
		const digest = await crypto.subtle.digest('SHA-256', artifact.bytes as BufferSource);
		const key = await crypto.subtle.importKey(
			'raw',
			artifact.publicKey as BufferSource,
			{ name: 'Ed25519' },
			false,
			['verify'],
		);
		return crypto.subtle.verify('Ed25519', key, artifact.signature as BufferSource, digest);
	} catch {
		return false;
	}
}

export async function assertKuundaSignedFile(input: {
	filePath: string;
	sha256hash?: string;
	signature?: string;
	publicKey?: string;
	locale?: string;
}): Promise<void> {
	const message = formatUpdateIntegrityError(input.locale);
	if (!input.sha256hash || !input.signature || !input.publicKey) {
		throw new Error(message);
	}
	const bytes = toBytes(await readFile(input.filePath));
	const publicKey = rawEd25519PublicKey(toBytes(Buffer.from(input.publicKey, 'base64')));
	const signature = toBytes(Buffer.from(input.signature, 'base64'));
	if (!publicKey || signature.length !== 64) {
		throw new Error(message);
	}
	const digestHex = Buffer.from(await crypto.subtle.digest('SHA-256', bytes as BufferSource)).toString('hex').toLowerCase();
	if (digestHex !== String(input.sha256hash).trim().toLowerCase()) {
		throw new Error(message);
	}
	const ok = await verifyKuundaUpdateBytes({ bytes, signature, publicKey });
	if (!ok) {
		throw new Error(message);
	}
}

function rawEd25519PublicKey(buf: Uint8Array): Uint8Array | null {
	if (buf.length === 32) {
		return buf;
	}
	if (buf.length >= 44) {
		return buf.subarray(buf.length - 32);
	}
	return null;
}
