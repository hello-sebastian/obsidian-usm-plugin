// Shared helpers for build/deploy terminal reports.

import { execFileSync } from 'node:child_process';

const useColor = Boolean(process.stdout.isTTY) && !process.env.NO_COLOR;

const paint = (code) => (text) => (useColor ? `\u001b[${code}m${text}\u001b[0m` : String(text));

export const green = paint('32');
export const red = paint('31');
export const yellow = paint('33');
export const dim = paint('2');

export function humanSize(bytes) {
	if (bytes < 1024) return `${bytes} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function fmtDelta(bytes) {
	if (bytes === 0) return 'bez zmian';
	const sign = bytes > 0 ? '+' : '−';
	return `${sign}${humanSize(Math.abs(bytes))}`;
}

export function fmtTime(date) {
	const p = (n) => String(n).padStart(2, '0');
	return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())} ${p(date.getHours())}:${p(date.getMinutes())}`;
}

export function fmtDuration(ms) {
	if (ms < 1000) return `${Math.round(ms)} ms`;
	return `${(ms / 1000).toFixed(1)} s`;
}

export function fmtAgo(date) {
	const min = Math.floor((Date.now() - date.getTime()) / 60000);
	if (min < 1) return 'przed chwilą';
	if (min < 60) return `${min} min temu`;
	const h = Math.floor(min / 60);
	if (h < 24) return `${h} godz. temu`;
	return `${Math.floor(h / 24)} dni temu`;
}

// Polish plural: plural(3, 'plik', 'pliki', 'plików') → 'pliki'
export function plural(n, one, few, many) {
	if (n === 1) return one;
	const d = n % 10;
	const h = n % 100;
	if (d >= 2 && d <= 4 && (h < 12 || h > 14)) return few;
	return many;
}

// Compare semver-like strings: -1 if a < b, 0 if equal, 1 if a > b.
export function compareVersions(a, b) {
	const pa = a.split('.').map(Number);
	const pb = b.split('.').map(Number);
	for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
		const da = pa[i] ?? 0;
		const db = pb[i] ?? 0;
		if (da !== db) return da > db ? 1 : -1;
	}
	return 0;
}

export function shortCommit() {
	try {
		return execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
	} catch {
		return null;
	}
}
