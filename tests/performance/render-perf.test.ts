/**
 * Automated performance tests (T034, FR-020, FR-024, SC-001, SC-010).
 *
 * Builds a `GridModel` from a defined board size (160 columns × 15 rows ×
 * 30000 stories — far above the task's ≥ 10 × ≥ 5 × ≥ 50 minimum) and
 * measures:
 * - **model build time** (ms) — `buildGridModel`;
 * - **DOM render time** (ms) — `BoardRenderer.render` under jsdom
 *   (dev-only dependency, plan.md Technical Context);
 * - **story card count** — every entry must render exactly one card.
 *
 * Baseline thresholds are recorded in `baseline.json` on the first passing
 * run and enforced on subsequent runs: a measurement that exceeds the
 * baseline by more than 20% fails the suite. Each measurement is the
 * **median** of 5 runs (after 2 warmup runs) — the median is robust to the
 * occasional GC/JIT spike that inflates single samples, which a min-based
 * baseline would record as an optimistic outlier and then flake against.
 * The whole suite completes in a fraction of the 2-minute budget (SC-010).
 */
// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGridModel } from '../../src/domain/board-model';
import { BoardRenderer } from '../../src/ui/board-renderer';
import { patchHTMLElement } from '../helpers/dom-patch';
import type { BoardConfig, GridModel, StoryEntry } from '../../src/domain/types';

// Defined board size (T034): the task requires ≥ 10 columns × ≥ 5 rows ×
// ≥ 50 stories. We scale well beyond that minimum so the measured timings
// land in the tens-of-ms range — large enough that the 20% regression
// budget is stable against JIT/GC noise (a 30µs model build is below the
// timing noise floor and would flake on every run).
const ACTIVITY_COUNT = 20;
const TASKS_PER_ACTIVITY = 4;
const EPICS_PER_TASK = 2; // 20 × 4 × 2 = 160 leaf (Epic) columns
const RELEASE_COUNT = 15;
const STORY_COUNT = 30000;

const COLUMN_COUNT = ACTIVITY_COUNT * TASKS_PER_ACTIVITY * EPICS_PER_TASK;

const CONFIG: BoardConfig = { isBoard: true, releaseRowOrder: 'appearance' };

const BASELINE_PATH = join(
	dirname(fileURLToPath(import.meta.url)),
	'baseline.json',
);

/** Fail if a measurement exceeds the baseline by more than 20%. */
const REGRESSION_TOLERANCE = 1.2;

interface Baseline {
	modelBuildMs: number;
	renderMs: number;
}

/** Build the story entries spread across the full grid. */
function buildEntries(): StoryEntry[] {
	const entries: StoryEntry[] = [];
	for (let i = 0; i < STORY_COUNT; i++) {
		const activity = i % ACTIVITY_COUNT;
		const task = Math.floor(i / ACTIVITY_COUNT) % TASKS_PER_ACTIVITY;
		const epic =
			Math.floor(i / (ACTIVITY_COUNT * TASKS_PER_ACTIVITY)) % EPICS_PER_TASK;
		const release = i % RELEASE_COUNT;
		entries.push({
			id: `board.md::${i}`,
			targetPath: `S${i}.md`,
			linkText: `S${i}`,
			attributes: {
				activity: { text: `Activity ${activity}` },
				task: { text: `Task ${activity}-${task}` },
				epic: { text: `Epic ${activity}-${task}-${epic}` },
				release: { text: `Release ${release}` },
			},
			title: `Story ${i}`,
			isBroken: false,
		});
	}
	return entries;
}

/**
 * Median of `runs` measurements, in ms, after `warmup` unmeasured runs.
 *
 * The warmup runs let the JIT compile the hot path and settle GC state.
 * The median (rather than the min) is the robust statistic here: a single
 * GC pause or JIT deopt inflates one sample by 2–3×, and a min-based
 * baseline would lock in that lucky low outlier, making every subsequent
 * normal run look like a >20% regression. The median ignores the spikes
 * while still tracking real performance changes. A median of 5 is enough to
 * discard one spike on either side while keeping the hook fast (the render
 * pass is the slow part and must not blow the 10s hook timeout).
 */
function measure(fn: () => void, runs = 5, warmup = 2): number {
	for (let i = 0; i < warmup; i++) {
		fn();
	}
	const samples: number[] = [];
	for (let i = 0; i < runs; i++) {
		const start = performance.now();
		fn();
		samples.push(performance.now() - start);
	}
	samples.sort((a, b) => a - b);
	return samples[Math.floor(samples.length / 2)] as number;
}

function loadBaseline(): Baseline | null {
	if (!existsSync(BASELINE_PATH)) {
		return null;
	}
	return JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as Baseline;
}

let model: GridModel;
let modelBuildMs = 0;
let renderMs = 0;
let cardCount = 0;

beforeAll(() => {
	patchHTMLElement();
	const entries = buildEntries();

	modelBuildMs = measure(() => {
		model = buildGridModel(CONFIG, entries);
	});

	renderMs = measure(() => {
		const container = document.createElement('div');
		new BoardRenderer(container).render(model);
		cardCount = container.querySelectorAll('.usm-story-card').length;
	});
});

describe('T034 — render performance (FR-020, FR-024, SC-001, SC-010)', () => {
	it('builds the defined board size (160 columns × 15 rows × 30000 stories)', () => {
		expect(model.activities).toHaveLength(ACTIVITY_COUNT);
		const columns = model.activities.reduce(
			(sum, activity) =>
				sum + activity.tasks.reduce((s, task) => s + task.epics.length, 0),
			0,
		);
		expect(columns).toBe(COLUMN_COUNT);
		expect(model.releases).toHaveLength(RELEASE_COUNT);
		let total = 0;
		for (const entries of model.cells.values()) {
			total += entries.length;
		}
		expect(total).toBe(STORY_COUNT);
	});

	it('renders one card per story entry', () => {
		expect(cardCount).toBe(STORY_COUNT);
	});

	it('keeps model build + DOM render within the 20% regression budget', () => {
		const baseline = loadBaseline();
		if (baseline === null) {
			// First passing run: record the baseline thresholds.
			writeFileSync(
				BASELINE_PATH,
				`${JSON.stringify({ modelBuildMs, renderMs }, null, 2)}\n`,
			);
			return;
		}
		expect(
			modelBuildMs,
			`model build ${modelBuildMs.toFixed(2)}ms exceeds baseline ${baseline.modelBuildMs.toFixed(2)}ms by >20%`,
		).toBeLessThanOrEqual(baseline.modelBuildMs * REGRESSION_TOLERANCE);
		expect(
			renderMs,
			`render ${renderMs.toFixed(2)}ms exceeds baseline ${baseline.renderMs.toFixed(2)}ms by >20%`,
		).toBeLessThanOrEqual(baseline.renderMs * REGRESSION_TOLERANCE);
	});

	it('completes well within the 2-minute suite budget (SC-010)', () => {
		expect(modelBuildMs + renderMs).toBeLessThan(120_000);
	});
});
