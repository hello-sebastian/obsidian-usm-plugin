import obsidianmd from 'eslint-plugin-obsidianmd';
import globals from 'globals';
import { globalIgnores, defineConfig } from 'eslint/config';

export default defineConfig(
	globalIgnores([
		'node_modules',
		'dist',
		'esbuild.config.mjs',
		'version-bump.mjs',
		'package_scripts/build.mjs',
		'package_scripts/deploy.mjs',
		'package_scripts/report.mjs',
		'versions.json',
		'main.js',
		'package.json',
		'package-lock.json',
		'tsconfig.json',
	]),
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: ['eslint.config.mts', 'manifest.json'],
				},
				tsconfigRootDir: import.meta.dirname,
				extraFileExtensions: ['.json'],
			},
		},
	},
	...obsidianmd.configs.recommended,
	{
		// Test helpers legitimately mirror Obsidian's real DOM API (e.g.
		// HTMLElement.hide()/show(), which set style.display) so that
		// integration tests can exercise code paths that depend on them.
		// The no-static-styles-assignment rule is a production-code concern
		// (Constitution Principle VII) and does not apply to test doubles.
		files: ['tests/**/*.ts'],
		rules: {
			'obsidianmd/no-static-styles-assignment': 'off',
		},
	},
);
