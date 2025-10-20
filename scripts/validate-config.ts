// Validate actual RepoWeaver config files using Zod
import fs from 'fs';
import path from 'path';
import { z } from 'zod';

const filePatternMergeStrategy = z.object({
	patterns: z.array(z.string()).optional(),
	category: z.enum([
		'typescript',
		'ci-workflows',
		'documentation',
		'agent-instructions',
		'git',
		'code-quality',
		'package-management',
		'vscode-settings',
		'testing',
		'building',
	]).optional(),
	strategy: z.object({ type: z.string() }),
	priority: z.number().optional(),
	primarySource: z.string().optional(),
});

const configSchema = z.object({
	name: z.string().optional(),
	description: z.string().optional(),
	templates: z.array(z.union([
		z.string(),
		z.object({
			url: z.string(),
			name: z.string(),
			branch: z.string().optional(),
			subDirectory: z.string().optional(),
		})
	])),
	mergeStrategy: z.union([
		z.string(),
		z.object({ type: z.string() })
	]).optional(),
	mergeStrategies: z.array(filePatternMergeStrategy).optional(),
	excludePatterns: z.array(z.string()).optional(),
	includePatterns: z.array(z.string()).optional(),
	autoUpdate: z.boolean().optional(),
	createRepository: z.boolean().optional(),
	privateRepository: z.boolean().optional(),
	initGit: z.boolean().optional(),
	addRemote: z.string().optional(),
	hooks: z.any().optional(),
	variables: z.any().optional(),
	plugins: z.array(z.string()).optional(),
});

function validateConfig(filePath: string) {
	const abs = path.resolve(filePath);
	const data = JSON.parse(fs.readFileSync(abs, 'utf-8'));
	const result = configSchema.safeParse(data);
	if (result.success) {
		console.log(`✅ ${filePath} is a valid RepoWeaver config.`);
	} else {
		console.error(`❌ ${filePath} is invalid:`);
		console.error(result.error.format());
		process.exitCode = 1;
	}
}

// Validate all .json config files in examples/
const exampleDir = path.resolve('examples');
for (const file of fs.readdirSync(exampleDir)) {
	if (file.endsWith('.json')) {
		validateConfig(path.join(exampleDir, file));
	}
}
