import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveKuundaAutoModel } from '../src/vs/workbench/contrib/void/common/kuundaAutoRouter.ts';

const user = (content) => ({ role: 'user', content });
const tool = (content) => ({ role: 'tool', content, tool_call_id: '1' });

describe('Auto choisit le modèle pour chaque requête', () => {
	it('une question courte reste sur le modèle inclus', () => {
		assert.equal(
			resolveKuundaAutoModel('agent', [user('Salut, que fait ce fichier ?')]),
			'anthropic/claude-haiku-5.5',
		);
	});

	it('une modification ordinaire part sur le modèle standard, même en Ask', () => {
		assert.equal(
			resolveKuundaAutoModel('ask', [user('Corrige la fonction parseConfig pour accepter un tableau vide.')]),
			'deepseek/deepseek-v4.1-flash',
		);
	});

	it('une interface longue part sur le modèle de contexte long', () => {
		assert.equal(
			resolveKuundaAutoModel('agent', [user('Refais le layout CSS de l’interface du panneau de chat.')]),
			'z-ai/glm-5.3-flash',
		);
	});

	it('une tâche dure, après plusieurs outils, part sur le modèle frontier', () => {
		const messages = [
			user('Refactor the whole codebase architecture and migrate every service.'),
			{ role: 'assistant', content: '', tool_calls: [{ id: '1' }] },
			tool('file list'),
			{ role: 'assistant', content: '', tool_calls: [{ id: '2' }] },
			tool('more files'),
		];
		assert.equal(resolveKuundaAutoModel('agent', messages), 'anthropic/claude-sonnet-5');
	});

	it('le même mode peut choisir deux modèles selon le texte', () => {
		const easy = resolveKuundaAutoModel('agent', [user('Bonjour')]);
		const hard = resolveKuundaAutoModel('agent', [user('Security audit and rewrite the authentication architecture from scratch across the whole repo.')]);
		assert.notEqual(easy, hard);
	});
});
