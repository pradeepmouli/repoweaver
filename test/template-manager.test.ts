import { describe, expect, it } from 'vitest';
import { applyMergeStrategies } from '../src/template-manager';
import { TemplateRepository, WeaverConfig } from '../src/types';

const templateA: TemplateRepository = {
	url: 'https://github.com/example/template-a',
	name: 'template-a',
};
const templateB: TemplateRepository = {
	url: 'https://github.com/example/template-b',
	name: 'template-b',
};

describe('Primary Source MergeStrategy', () => {
	it('should use only the designated primary source for a file', async () => {
		const config: WeaverConfig = {
			templates: [templateA, templateB],
			mergeStrategies: [
				{
					patterns: ['tsconfig.json'],
					strategy: { type: 'overwrite' },
					primarySource: 'template-a',
				},
			],
		};
		// Simulate both templates providing tsconfig.json
		const filesFromTemplates = {
			'template-a': { 'tsconfig.json': 'A' },
			'template-b': { 'tsconfig.json': 'B' },
		};
		const result = await applyMergeStrategies('tsconfig.json', config, filesFromTemplates);
		expect(result.content).toBe('A');
		expect(result.source).toBe('template-a');
	});

	it('should warn if primary source does not provide the file', async () => {
		const config: WeaverConfig = {
			templates: [templateA, templateB],
			mergeStrategies: [
				{
					patterns: ['tsconfig.json'],
					strategy: { type: 'overwrite' },
					primarySource: 'template-a',
				},
			],
		};
		// Only template-b provides tsconfig.json
		const filesFromTemplates = {
			'template-b': { 'tsconfig.json': 'B' },
		};
		const result = await applyMergeStrategies('tsconfig.json', config, filesFromTemplates);
		expect(result.content).toBe('B');
		expect(result.source).toBe('template-b');
		expect(result.warning).toMatch(/primary source/);
	});
});
