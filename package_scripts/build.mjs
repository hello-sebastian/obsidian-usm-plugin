// Orchestrates the production build (tsc + esbuild) and prints a summary report.

import { spawnSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { buildProduction } from '../esbuild.config.mjs';
import { dim, fmtDelta, fmtDuration, fmtTime, green, humanSize, red, shortCommit, yellow } from './report.mjs';

const totalStart = performance.now();

// Step 1: TypeScript type check
console.log(dim('→ Sprawdzanie typów (tsc)…'));
const tscStart = performance.now();
const tsc = spawnSync('npx', ['tsc', '-noEmit', '-skipLibCheck'], { stdio: 'inherit' });
const tscMs = performance.now() - tscStart;
if (tsc.status !== 0) {
	console.error(red(`✖ Build przerwany: tsc zakończony błędem po ${fmtDuration(tscMs)}`));
	process.exit(tsc.status ?? 1);
}

// Step 2: esbuild production bundle
console.log(dim('→ Budowanie main.js (esbuild)…'));
const prevSize = (() => {
	try {
		return statSync('main.js').size;
	} catch {
		return null;
	}
})();
const { durationMs: esbuildMs, warnings } = await buildProduction();
const newSize = statSync('main.js').size;

const totalMs = performance.now() - totalStart;
const version = JSON.parse(readFileSync('manifest.json', 'utf8')).version;
const commit = shortCommit();

console.log(green(`✔ Build zakończony w ${fmtDuration(totalMs)} (tsc ${fmtDuration(tscMs)} · esbuild ${fmtDuration(esbuildMs)})`));
const delta = prevSize === null ? null : newSize - prevSize;
console.log(`  main.js   ${humanSize(newSize)}${delta === null ? dim(' (pierwszy build)') : `  (${fmtDelta(delta)} vs poprzedni build)`}`);
const meta = [`wersja ${version}`];
if (commit) meta.push(`commit ${commit}`);
meta.push(fmtTime(new Date()));
console.log(dim(`  ${meta.join(' · ')}`));
if (warnings > 0) {
	console.log(yellow(`⚠ esbuild: ${warnings} ostrzeżenie(a) — szczegóły powyżej`));
}
