import { describe, expect, it } from 'vitest';
import { MergeStrategyRegistry } from '../src/merge-strategy-registry';
import { FilePatternMergeStrategy } from '../src/types';

// We'll test category-based matching by calling resolveStrategyForFile with a set of rules

describe('MergeStrategyRegistry category matching', () => {
	it('matches typescript category for tsconfig.json', async () => {
		const registry = new MergeStrategyRegistry();
		const rules: FilePatternMergeStrategy[] = [
			{
				category: 'typescript',
				strategy: { type: 'overwrite' },
				priority: 10,
			},
		];

		const strategy = await registry.resolveStrategyForFile('tsconfig.json', rules, { type: 'merge' });
		expect(strategy.name).toBe('overwrite');
	});

	it('matches ci-workflows category for .github/workflows/build.yml', async () => {
		const registry = new MergeStrategyRegistry();
		const rules: FilePatternMergeStrategy[] = [
			{
				category: 'ci-workflows',
				strategy: { type: 'skip' },
				priority: 5,
			},
		];

		const strategy = await registry.resolveStrategyForFile('.github/workflows/build.yml', rules, { type: 'merge' });
		expect(strategy.name).toBe('skip');
	});

	it('matches testing category for jest config and test files', async () => {
		const registry = new MergeStrategyRegistry();
		const rules: FilePatternMergeStrategy[] = [
			{
				category: 'testing',
				strategy: { type: 'overwrite' },
				priority: 5,
			},
		];

		const s1 = await registry.resolveStrategyForFile('jest.config.ts', rules, { type: 'merge' });
		expect(s1.name).toBe('overwrite');
		const s2 = await registry.resolveStrategyForFile('src/sum.test.ts', rules, { type: 'merge' });
		expect(s2.name).toBe('overwrite');
	});

	it('matches building category for common build configs', async () => {
		const registry = new MergeStrategyRegistry();
		const rules: FilePatternMergeStrategy[] = [
			{
				category: 'building',
				strategy: { type: 'skip' },
				priority: 5,
			},
		];

		const s1 = await registry.resolveStrategyForFile('webpack.config.js', rules, { type: 'merge' });
		expect(s1.name).toBe('skip');
		const s2 = await registry.resolveStrategyForFile('.github/workflows/build.yml', rules, { type: 'merge' });
		expect(s2.name).toBe('skip');
	});
});
