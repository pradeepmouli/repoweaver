import { WeaverConfig } from '../src/types';

// Helper function to get environment-specific configuration
function getEnvironmentConfig() {
	const isDevelopment = process.env.NODE_ENV === 'development';
	const isProduction = process.env.NODE_ENV === 'production';

	return {
		autoUpdate: isDevelopment, // Only auto-update in development
		createRepository: isProduction, // Only create repo in production
		privateRepository: isProduction, // Private repos in production
	};
}

// Helper function to get user-specific variables
function getUserVariables() {
	const user = process.env.USER || 'developer';
	const email = process.env.EMAIL || `${user}@example.com`;

	return {
		PROJECT_NAME: process.cwd().split('/').pop() || 'react-fullstack-project',
		AUTHOR_NAME: user,
		AUTHOR_EMAIL: email,
		NODE_VERSION: process.version.replace('v', ''),
		REACT_VERSION: '19.1.0',
		API_PORT: process.env.API_PORT || '3001',
		CLIENT_PORT: process.env.CLIENT_PORT || '3000',
	};
}

const config: WeaverConfig = {
	name: 'react-fullstack-project',
	description: 'A full-stack React application with advanced merge strategies (TypeScript config)',

	templates: [
		{
			url: 'https://github.com/facebook/create-react-app.git',
			name: 'react-frontend',
			branch: 'main',
			subDirectory: 'packages/cra-template',
		},
		{
			url: 'https://github.com/expressjs/express.git',
			name: 'express-backend',
			branch: 'master',
			subDirectory: 'examples/auth',
		},
		'https://github.com/your-org/shared-config-template.git',
	],

	mergeStrategy: 'merge',

	mergeStrategies: [
		{
			category: 'testing',
			strategy: { type: 'skip' },
			priority: 210,
		},
		{
			category: 'building',
			strategy: { type: 'merge' },
			primarySource: 'shared-config-template',
			priority: 205,
		},
		{
			patterns: ['package.json'],
			strategy: {
				type: 'plugin',
				implementation: 'npm-merger',
				options: {
					preserveExisting: true,
				},
			},
			priority: 200,
		},
		{
			patterns: ['frontend/package.json', 'backend/package.json'],
			strategy: {
				type: 'merge',
			},
			priority: 190,
		},
		{
			patterns: ['*.config.js', '*.config.ts', '*.config.json'],
			strategy: {
				type: 'merge',
				options: {
					deepMerge: true,
				},
			},
			priority: 180,
		},
		{
			patterns: ['src/**/*.jsx', 'src/**/*.tsx', 'components/**/*.tsx'],
			strategy: {
				type: 'overwrite',
			},
			priority: 170,
		},
		{
			patterns: ['src/**/*.test.js', 'src/**/*.test.ts', '**/__tests__/**'],
			strategy: {
				type: 'skip',
			},
			priority: 160,
		},
		{
			patterns: ['README.md', 'CHANGELOG.md'],
			strategy: {
				type: 'merge',
				options: {
					separator: '\n\n---\n\n',
				},
			},
			priority: 150,
		},
		{
			patterns: ['docs/**/*.md'],
			strategy: {
				type: 'merge',
				options: {
					separator: '\n\n## Template Updates\n\n',
				},
			},
			priority: 140,
		},
		{
			patterns: ['*.yml', '*.yaml', '.github/workflows/*.yml'],
			strategy: {
				type: 'merge',
			},
			priority: 130,
		},
		{
			patterns: ['backend/src/**/*.js', 'backend/src/**/*.ts'],
			strategy: {
				type: 'merge',
				options: {
					addConflictMarkers: true,
				},
			},
			priority: 120,
		},
		{
			patterns: ['public/**/*', 'static/**/*'],
			strategy: {
				type: 'skip',
			},
			priority: 110,
		},
		{
			patterns: ['*.json'],
			strategy: {
				type: 'merge',
			},
			priority: 100,
		},
	],

	excludePatterns: ['node_modules/**', 'dist/**', 'build/**', 'coverage/**', '*.log', '.env', '.env.local', '.env.development.local', '.env.test.local', '.env.production.local', '*.tmp', '*.cache', '.DS_Store', 'Thumbs.db'],

	includePatterns: ['!.env.example', '!.gitignore', '!.github/**', '!docs/**'],

	// Use environment-specific configuration
	...getEnvironmentConfig(),

	initGit: true,
	addRemote: `https://github.com/\${USER}/react-fullstack-project.git`,

	hooks: {
		preBootstrap: ['echo "Starting React fullstack project setup..."', 'node --version', 'npm --version'],
		postBootstrap: ['npm install', 'npm run build', 'npm run test -- --passWithNoTests', 'echo "Setup complete! Run npm start to begin development."'],
		preTemplate: ['echo "Processing template: ${TEMPLATE_NAME}"'],
		postTemplate: ['echo "Completed processing template: ${TEMPLATE_NAME}"'],
	},

	// Use dynamic user variables
	variables: getUserVariables(),

	plugins: ['npm-merger', 'yaml-merger', 'react-merger'],
};

export default config;
