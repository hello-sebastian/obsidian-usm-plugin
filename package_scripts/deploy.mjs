// Deploys the built plugin files to the Obsidian vault and prints a summary report.

import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { compareVersions, dim, fmtAgo, fmtDelta, fmtDuration, fmtTime, green, humanSize, plural, red, yellow } from './report.mjs';

const DEFAULT_PLUGIN_DIR = '/Users/sebastian/OneDrive/Aplikacje/Hermes/Hermes-sebastian/.obsidian/plugins/obsidian-usm-plugin';
const pluginDir = process.env.OBSIDIAN_PLUGIN_DIR ?? DEFAULT_PLUGIN_DIR;
const files = ['main.js', 'manifest.json', 'styles.css'];

const start = performance.now();

function sha256(path) {
	return createHash('sha256').update(readFileSync(path)).digest('hex');
}

function statOrNull(path) {
	try {
		return statSync(path);
	} catch {
		return null;
	}
}

// Snapshot of the files currently in the vault (before copying).
const oldState = {};
for (const name of files) {
	const target = `${pluginDir}/${name}`;
	const st = statOrNull(target);
	if (st) {
		oldState[name] = { size: st.size, mtime: st.mtimeMs, hash: sha256(target) };
	}
}

// Version consistency checks (before deploy, so warnings refer to what is about to land).
const manifestVersion = JSON.parse(readFileSync('manifest.json', 'utf8')).version;
const packageVersion = JSON.parse(readFileSync('package.json', 'utf8')).version;
const warnings = [];
if (manifestVersion !== packageVersion) {
	warnings.push(`wersja w manifest.json (${manifestVersion}) ≠ wersja w package.json (${packageVersion})`);
}
const oldManifest = oldState['manifest.json']
	? JSON.parse(readFileSync(`${pluginDir}/manifest.json`, 'utf8')).version
	: null;
if (oldManifest && compareVersions(oldManifest, manifestVersion) > 0) {
	warnings.push(`wersja w vault (${oldManifest}) jest nowsza niż deployowana (${manifestVersion}) — możliwy downgrade`);
}

console.log(dim(`→ Deploy do ${pluginDir}`));
mkdirSync(pluginDir, { recursive: true });

// Copy (always, even when content is unchanged) and verify integrity.
const newLines = [];
let totalSize = 0;
let lastOldMtime = null;
for (const name of files) {
	const source = `${process.cwd()}/${name}`;
	const target = `${pluginDir}/${name}`;
	const before = oldState[name];
	copyFileSync(source, target);
	const afterHash = sha256(target);
	if (afterHash !== sha256(source)) {
		console.error(red(`✖ Deploy przerwany: ${name} — rozbieżność hash po skopiowaniu`));
		process.exit(1);
	}
	const st = statSync(target);
	totalSize += st.size;
	if (before && before.mtime > (lastOldMtime ?? 0)) lastOldMtime = before.mtime;

	if (!before) {
		newLines.push(`  ${name.padEnd(15)} ${humanSize(st.size)}  ${dim('nowy plik')}  ${fmtTime(new Date(st.mtimeMs))}`);
	} else if (before.hash === afterHash) {
		newLines.push(`  ${name.padEnd(15)} ${humanSize(st.size)}  ${dim('bez zmian (identyczna zawartość)')}`);
	} else {
		const sizePart = before.size === st.size
			? humanSize(st.size)
			: `${humanSize(before.size)} → ${humanSize(st.size)} (${fmtDelta(st.size - before.size)})`;
		const versionPart = name === 'manifest.json' && oldManifest && oldManifest !== manifestVersion
			? `  ${dim(`${oldManifest} → ${manifestVersion}`)}`
			: '';
		newLines.push(`  ${name.padEnd(15)} ${sizePart}${versionPart}  ${fmtTime(new Date(before.mtime))} → ${fmtTime(new Date(st.mtimeMs))}`);
	}
}

const totalMs = performance.now() - start;
console.log(green(`✔ Deploy zakończony w ${fmtDuration(totalMs)} (${files.length} ${plural(files.length, 'plik', 'pliki', 'plików')}, ${humanSize(totalSize)} łącznie)`));
for (const line of newLines) console.log(line);
if (lastOldMtime) {
	console.log(dim(`  ostatni deploy: ${fmtAgo(new Date(lastOldMtime))}`));
}
for (const w of warnings) {
	console.log(yellow(`⚠ ${w}`));
}
