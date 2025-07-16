# RepoWeaver Merge Strategies

RepoWeaver provides a powerful and flexible merge strategy system that allows you to control how template files are merged with existing files on a per-file or per-pattern basis.

## Overview

The merge strategy system supports:

- **File Pattern-Based Strategies**: Different strategies for different file types
- **Custom Implementations**: Write your own merge logic
- **Plugin System**: Extensible through plugins
- **Priority System**: Control which strategy takes precedence

## Built-in Strategies

### Basic Strategies

#### `overwrite`

Completely replaces existing content with new content from the template.

```json
{
	"mergeStrategy": "overwrite"
}
```

#### `skip`

Skips files that already exist in the target repository.

```json
{
	"mergeStrategy": "skip"
}
```

#### `merge`

Simple merge that appends new content to existing content with a separator.

```json
{
	"mergeStrategy": "merge"
}
```

### Specialized Strategies

#### `json`

Deep merges JSON objects, combining properties from both existing and new content.

```json
{
	"patterns": ["*.json"],
	"strategy": { "type": "json" }
}
```

#### `package-json`

Specialized merge for `package.json` files with intelligent handling of dependencies and scripts.

```json
{
	"patterns": ["package.json"],
	"strategy": { "type": "package-json" }
}
```

#### `markdown`

Merges Markdown files by appending new content with a separator.

```json
{
	"patterns": ["*.md"],
	"strategy": {
		"type": "markdown",
		"options": { "separator": "\n\n---\n\n" }
	}
}
```

#### `yaml`

Merges YAML files by parsing and deep merging objects (requires `js-yaml` package).

```json
{
	"patterns": ["*.yml", "*.yaml"],
	"strategy": { "type": "yaml" }
}
```

#### `config`

Automatically detects configuration file types and applies appropriate merge strategy.

```json
{
	"patterns": ["*.json", "*.yml", "*.yaml", "*.toml"],
	"strategy": { "type": "config" }
}
```

#### `code`

Merges code files with conflict markers (similar to Git merge conflicts).

```json
{
	"patterns": ["*.js", "*.ts", "*.py"],
	"strategy": { "type": "code" }
}
```

## File Pattern-Based Configuration

Configure different merge strategies for different file patterns:

```json
{
	"mergeStrategy": "merge",
	"mergeStrategies": [
		{
			"patterns": ["package.json"],
			"strategy": { "type": "package-json" },
			"priority": 100
		},
		{
			"patterns": ["*.json"],
			"strategy": { "type": "json" },
			"priority": 90
		},
		{
			"patterns": ["*.md"],
			"strategy": {
				"type": "markdown",
				"options": { "separator": "\n\n---\n\n" }
			},
			"priority": 80
		},
		{
			"patterns": ["src/**/*.js", "src/**/*.ts"],
			"strategy": { "type": "overwrite" },
			"priority": 70
		}
	]
}
```

### Pattern Matching

- Use glob patterns to match files
- `*` matches any characters except `/`
- `**` matches any characters including `/`
- Higher priority numbers take precedence

## Custom Merge Strategies

Create your own merge implementation:

### 1. Create a Custom Merger

```javascript
// custom-json-merger.js
module.exports = {
	name: 'custom-json',
	description: 'Custom JSON merger with special handling',

	async merge(context) {
		const { existingContent, newContent, filePath, options } = context;

		try {
			const existing = JSON.parse(existingContent);
			const newData = JSON.parse(newContent);

			// Your custom merge logic here
			const merged = {
				...existing,
				...newData,
				// Custom logic for specific fields
				version: newData.version || existing.version,
				dependencies: {
					...existing.dependencies,
					...newData.dependencies,
				},
			};

			return {
				success: true,
				content: JSON.stringify(merged, null, 2),
				warnings: ['Custom JSON merge applied'],
			};
		} catch (error) {
			return {
				success: false,
				content: existingContent,
				warnings: [`Custom merge failed: ${error.message}`],
			};
		}
	},
};
```

### 2. Configure Custom Strategy

```json
{
	"mergeStrategies": [
		{
			"patterns": ["*.json"],
			"strategy": {
				"type": "custom",
				"implementation": "./custom-json-merger.js"
			}
		}
	]
}
```

## Plugin System

Create reusable merge strategies as plugins:

### 1. Create a Plugin

```javascript
// repoweaver-plugin-advanced-merger/index.js
module.exports = {
	name: 'advanced-merger',
	version: '1.0.0',
	description: 'Advanced merge strategies for various file types',

	strategies: [
		{
			name: 'smart-json',
			description: 'Smart JSON merger with conflict detection',
			async merge(context) {
				// Implementation here
			},
		},
		{
			name: 'code-formatter',
			description: 'Merge code files with formatting',
			async merge(context) {
				// Implementation here
			},
		},
	],

	async initialize(options) {
		console.log('Advanced merger plugin initialized');
	},

	async cleanup() {
		console.log('Advanced merger plugin cleaned up');
	},
};
```

### 2. Install and Use Plugin

```bash
npm install repoweaver-plugin-advanced-merger
```

```json
{
	"plugins": ["advanced-merger"],
	"mergeStrategies": [
		{
			"patterns": ["*.json"],
			"strategy": {
				"type": "plugin",
				"implementation": "advanced-merger:smart-json"
			}
		}
	]
}
```

## Advanced Configuration Examples

### React Project Configuration

```json
{
	"name": "react-app",
	"mergeStrategy": "merge",
	"mergeStrategies": [
		{
			"patterns": ["package.json"],
			"strategy": { "type": "package-json" },
			"priority": 100
		},
		{
			"patterns": ["src/**/*.jsx", "src/**/*.tsx"],
			"strategy": { "type": "overwrite" },
			"priority": 90
		},
		{
			"patterns": ["*.json"],
			"strategy": { "type": "json" },
			"priority": 80
		},
		{
			"patterns": ["*.md"],
			"strategy": {
				"type": "markdown",
				"options": { "separator": "\n\n---\n\n" }
			},
			"priority": 70
		},
		{
			"patterns": ["public/**/*"],
			"strategy": { "type": "skip" },
			"priority": 60
		}
	]
}
```

### Backend API Configuration

```json
{
	"name": "api-server",
	"mergeStrategies": [
		{
			"patterns": ["package.json"],
			"strategy": { "type": "package-json" },
			"priority": 100
		},
		{
			"patterns": ["*.yml", "*.yaml"],
			"strategy": { "type": "yaml" },
			"priority": 90
		},
		{
			"patterns": ["config/**/*.json"],
			"strategy": { "type": "config" },
			"priority": 85
		},
		{
			"patterns": ["src/**/*.js", "src/**/*.ts"],
			"strategy": { "type": "code" },
			"priority": 80
		},
		{
			"patterns": ["docs/**/*.md"],
			"strategy": { "type": "markdown" },
			"priority": 70
		}
	]
}
```

### Using Custom Strategies

```json
{
	"mergeStrategies": [
		{
			"patterns": ["database/migrations/*.sql"],
			"strategy": {
				"type": "custom",
				"implementation": "./mergers/sql-merger.js"
			},
			"priority": 100
		},
		{
			"patterns": ["terraform/**/*.tf"],
			"strategy": {
				"type": "plugin",
				"implementation": "terraform-merger:hcl"
			},
			"priority": 90
		}
	]
}
```

## Best Practices

1. **Use Specific Patterns**: Be as specific as possible with file patterns to avoid unintended matches
2. **Set Priorities**: Use priority numbers to control which strategy takes precedence
3. **Test Strategies**: Always test your merge strategies on sample files before deploying
4. **Handle Errors**: Implement proper error handling in custom merge strategies
5. **Document Custom Logic**: Document any custom merge logic for team members
6. **Version Control**: Include merge strategy configurations in version control

## Troubleshooting

### Common Issues

1. **Pattern Not Matching**: Check glob pattern syntax and file paths
2. **Strategy Not Found**: Ensure plugins are installed and custom files exist
3. **Merge Conflicts**: Use the `code` strategy for files that might have conflicts
4. **Performance Issues**: Optimize custom strategies for large files

### Debug Mode

Enable debug logging to see which strategies are being applied:

```json
{
	"mergeStrategy": {
		"type": "merge",
		"options": { "debug": true }
	}
}
```

This will log detailed information about strategy selection and merge results.
