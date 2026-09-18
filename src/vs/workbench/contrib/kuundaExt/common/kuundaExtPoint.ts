/*---------------------------------------------------------------------------------------------
 *  Copyright 2026 Arowtech
 *  SPDX-License-Identifier: Apache-2.0
 *--------------------------------------------------------------------------------------------*/

import { ExtensionsRegistry } from '../../../services/extensions/common/extensionsRegistry.js';
import { KUUNDA_API_PERMISSIONS, KUUNDA_API_VERSION } from './extensionApi.js';

export const kuundaApiExtensionPoint = ExtensionsRegistry.registerExtensionPoint<{
	apiVersion?: string;
	permissions?: string[];
}>({
	extensionPoint: 'kuunda',
	jsonSchema: {
		description: 'Kuunda Vibe API (agent, credits, cloud). User grant required; no credentials are returned.',
		type: 'object',
		additionalProperties: false,
		properties: {
			apiVersion: {
				type: 'string',
				description: `Kuunda API version (current ${KUUNDA_API_VERSION}).`,
				default: KUUNDA_API_VERSION,
			},
			permissions: {
				type: 'array',
				items: { type: 'string', enum: [...KUUNDA_API_PERMISSIONS] },
				description: 'Kuunda capabilities this extension may request.',
			},
		},
	},
});
