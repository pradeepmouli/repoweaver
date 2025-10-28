export interface TemplateRepository {
	url: string;
	name: string;
	branch?: string;
	subDirectory?: string;
}

export interface RepositoryConfig {
	name: string;
	path: string;
	templates: TemplateRepository[];
	gitRemote?: string;
	excludePatterns?: string[];
	mergeStrategy?: 'overwrite' | 'merge' | 'skip';
}

export interface BootstrapOptions {
	targetPath: string;
	templates: TemplateRepository[];
	repositoryName: string;
	initGit?: boolean;
	addRemote?: string;
	mergeStrategy?: 'overwrite' | 'merge' | 'skip';
	excludePatterns?: string[];
}

export interface TemplateProcessingResult {
	success: boolean;
	template: TemplateRepository;
	filesProcessed: number;
	errors: string[];
	pullRequestNumber?: number;
}

export interface BootstrapResult {
	success: boolean;
	repositoryPath: string;
	templateResults: TemplateProcessingResult[];
	totalFilesProcessed: number;
	errors: string[];
}

export interface MergeStrategyConfig {
	type: 'overwrite' | 'merge' | 'skip' | 'custom' | 'plugin';
	implementation?: string; // For custom: path to implementation, for plugin: plugin name
	options?: Record<string, any>; // Options passed to the merge strategy
}

export interface FilePatternMergeStrategy {
	/**
	 * Either a list of glob patterns to match files, or a built-in category name.
	 * If 'category' is set, 'patterns' should be omitted.
	 */
	patterns?: string[];
	/**
	 * Built-in file group category (e.g. 'typescript', 'ci-workflows', etc). Mutually exclusive with 'patterns'.
	 */
	category?:
	| 'typescript'
	| 'ci-workflows'
	| 'documentation'
	| 'agent-instructions'
	| 'git'
	| 'code-quality'
	| 'package-management'
	| 'vscode-settings'
	| 'testing'
	| 'building';
	/**
	 * Merge strategy configuration for matched files.
	 */
	strategy: MergeStrategyConfig;
	/**
	 * Optional: Higher priority rules override lower ones.
	 */
	priority?: number;
	/**
	 * Optional: Name of the template to use as the primary source for this rule.
	 */
	primarySource?: string;
}

export interface WeaverConfig {
	name?: string;
	description?: string;
	templates: (string | TemplateRepository)[];
	mergeStrategy?: 'overwrite' | 'merge' | 'skip' | MergeStrategyConfig;
	mergeStrategies?: FilePatternMergeStrategy[]; // File pattern-based strategies
	excludePatterns?: string[];
	includePatterns?: string[];
	autoUpdate?: boolean;
	createRepository?: boolean;
	privateRepository?: boolean;
	initGit?: boolean;
	addRemote?: string;
	hooks?: {
		preTemplate?: string[];
		postTemplate?: string[];
		preBootstrap?: string[];
		postBootstrap?: string[];
	};
	variables?: Record<string, string>;
	plugins?: string[]; // List of plugin names to load
}

export interface WeaverIgnoreConfig {
	patterns: string[];
	includePatterns?: string[];
}

export interface MergeContext {
	filePath: string;
	templateName: string;
	existingContent: string;
	newContent: string;
	options?: Record<string, any>;
}

export interface MergeResult {
	success: boolean;
	content: string;
	conflicts?: string[];
	warnings?: string[];
	metadata?: Record<string, any>;
}

export interface MergeStrategy {
	name: string;
	description: string;
	merge(context: MergeContext): Promise<MergeResult>;
}

export interface MergePlugin {
	name: string;
	version: string;
	description: string;
	strategies: MergeStrategy[];
	initialize?(options?: Record<string, any>): Promise<void>;
	cleanup?(): Promise<void>;
}

// ============================================================================
// GitHub App Types
// ============================================================================

export interface GitHubInstallation {
	id: number;
	account: {
		id: number;
		login: string;
		type: 'User' | 'Organization';
	};
	suspended_at: string | null;
	created_at: string;
	updated_at: string;
}

export interface GitHubRepository {
	id: number;
	name: string;
	full_name: string;
	owner: {
		login: string;
		id: number;
	};
	private: boolean;
	default_branch: string;
}

export interface ApplyTemplatesJobPayload {
	installation_id: number;
	repo_id: number;
	repo_full_name: string;
	templates: string[];
	config: WeaverConfig;
	manual: boolean;
}

export interface WebhookPushPayload {
	ref: string;
	repository: {
		id: number;
		name: string;
		full_name: string;
		owner: {
			login: string;
			id: number;
		};
	};
	installation?: {
		id: number;
	};
	commits: Array<{
		id: string;
		message: string;
		timestamp: string;
	}>;
}

export interface OAuthState {
	nonce: string;
	return_url?: string;
	created_at: number;
}
