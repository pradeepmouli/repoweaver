// Validate weaver.schema.json and category.schema.json using Zod
import fs from 'fs';
import path from 'path';
import { z } from 'zod';


// Zod schema for the canonical lists data (not the schema definition)
const categoryDataSchema = z.object({
	typescript: z.array(z.string()),
	'ci-workflows': z.array(z.string()),
	documentation: z.array(z.string()),
	'agent-instructions': z.array(z.string()),
	git: z.array(z.string()),
	'code-quality': z.array(z.string()),
	'package-management': z.array(z.string()),
	'vscode-settings': z.array(z.string()),
	testing: z.array(z.string()),
	building: z.array(z.string()),
}).strict();

// Zod schema for a subset of weaver.schema.json (for demo; extend as needed)
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

const weaverSchema = z.object({
	name: z.string().optional(),
	description: z.string().optional(),
	templates: z.array(z.any()),
	mergeStrategy: z.any().optional(),
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


function extractCanonicalDefaults(schemaPath: string) {
	const abs = path.resolve(schemaPath);
	const schema = JSON.parse(fs.readFileSync(abs, 'utf-8'));
	const props = schema.properties;
	const result: Record<string, string[]> = {};
	for (const key of Object.keys(props)) {
		const def = props[key].default;
		if (!Array.isArray(def)) throw new Error(`No default array for category ${key}`);
		result[key] = def;
	}
	return result;
}

function validateCategoryData() {
	try {
		const data = extractCanonicalDefaults('schemas/category.schema.json');
		const result = categoryDataSchema.safeParse(data);
		if (result.success) {
			console.log('✅ category.schema.json canonical lists are valid.');
		} else {
			console.error('❌ category.schema.json canonical lists are invalid:');
			console.error(result.error.format());
			process.exitCode = 1;
		}
	} catch (e) {
		console.error('❌ Error extracting canonical lists:', e);
		process.exitCode = 1;
	}
}

function validateWeaverSchema() {
	const abs = path.resolve('schemas/weaver.schema.json');
	const data = JSON.parse(fs.readFileSync(abs, 'utf-8'));
	const result = weaverSchema.safeParse(data);
	if (result.success) {
		console.log('✅ weaver.schema.json is valid.');
	} else {
		console.error('❌ weaver.schema.json is invalid:');
		console.error(result.error.format());
		process.exitCode = 1;
	}
}

validateCategoryData();
validateWeaverSchema();
