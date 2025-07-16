const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Add the additional `ts` and `tsx` file extensions used by TypeScript files
config.resolver.sourceExts.push('ts', 'tsx');

// Watch the parent directory for changes in the core TypeScript code
config.watchFolders = [
  path.resolve(__dirname, '..'),
];

// Resolve modules from the parent directory (for accessing core)
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
  path.resolve(__dirname, '..', 'node_modules'),
];

module.exports = config;