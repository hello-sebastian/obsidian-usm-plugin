import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration (T027, FR-022, R-13).
 *
 * The core logic modules (`board-parser`, `story-attributes`, `board-model`,
 * `sanitize`) are pure functions with no Obsidian runtime dependency, so the
 * default environment is `node`. The performance suite (T034) needs a DOM and
 * opts into `jsdom` per-file via a `// @vitest-environment jsdom` docblock —
 * jsdom is a dev-only dependency with zero runtime impact on the plugin.
 */
export default defineConfig({
	test: {
		include: ['tests/**/*.test.ts'],
		environment: 'node',
	},
});
