import { defineConfig } from 'vitest/config';
import { compileModule } from 'svelte/compiler';
import svelteConfig from './svelte.config.js';

const RUNES_FN = svelteConfig.default?.compilerOptions?.runes;

function isRunesMode(filename) {
	if (typeof RUNES_FN === 'function') {
		const result = RUNES_FN({ filename });
		return result !== false;
	}
	return false;
}

const SVELTE_MODULE_RE = /\.svelte\.(ts|js)$/;

export default defineConfig({
	plugins: [
		{
			name: 'vitest-svelte-module-transform',
			transform(code, id) {
				if (!SVELTE_MODULE_RE.test(id)) {
					return;
				}

				const runes = isRunesMode(id);
				if (!runes) {
					return;
				}

				try {
					const result = compileModule(code, {
						filename: id,
						generate: 'client',
						dev: true
					});
					return result.js.code;
				} catch (e) {
					console.error(`Failed to compile Svelte module: ${id}`, e);
					throw e;
				}
			}
		}
	],
	test: {
		globals: true,
		environment: 'jsdom',
		setupFiles: ['src/lib/test-setup.ts'],
		include: ['src/**/*.{test,spec}.{js,ts}', '!src/**/*.svelte.{test,spec}.{js,ts}']
	}
});
