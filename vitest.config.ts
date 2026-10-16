import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/**
 * Vitest configuration (T027, FR-022, R-13).
 *
 * The core logic modules (`board-parser`, `story-attributes`, `board-model`,
 * `sanitize`) are pure functions with no Obsidian runtime dependency, so the
 * default environment is `node`. The performance suite (T034) needs a DOM and
 * opts into `jsdom` per-file via a `// @vitest-environment jsdom` docblock —
 * jsdom is a dev-only dependency with zero runtime impact on the plugin.
 *
 * The `obsidian` package is types-only (no runtime JS), so it is aliased to a
 * test-only stub (`tests/helpers/obsidian-stub.ts`) that provides the minimal
 * runtime surface (`TextFileView`, `FileView`, `setIcon`) the view/renderer
 * integration tests (T019, T020) need. This is dev-only and has zero runtime
 * impact on the bundled plugin.
 */
export default defineConfig({
	resolve: {
		alias: {
			obsidian: fileURLToPath(
				new URL('./tests/helpers/obsidian-stub.ts', import.meta.url),
			),
		},
	},
	test: {
		include: ['tests/**/*.test.ts'],
		environment: 'node',
	},
});
