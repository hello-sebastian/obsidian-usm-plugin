/**
 * Debug/dev metrics panel (T022, FR-020, SC-001; research R-07).
 *
 * When `debugMode` is enabled and the map view is visible, this overlay
 * shows three live metrics:
 * - **fps** — measured via `requestAnimationFrame` frame deltas;
 * - **story count** — the number of rendered story cards;
 * - **last render duration** (ms) — reported by the view after each render.
 *
 * The measurement loop (a single `requestAnimationFrame` chain) runs ONLY
 * while the panel is active. {@link DebugPanel.stop} cancels the loop and
 * removes the overlay, so there is no overhead when debug mode is off
 * (research R-07, quickstart Q7).
 *
 * The panel is a pure-DOM component: it takes the container to attach to
 * and a callback that returns the current story-card count. It has no
 * dependency on the Obsidian runtime, so it is unit-testable under jsdom.
 * All labels come from the i18n dictionary (research R-09).
 */
import { t } from './en';

/** How often (ms) the fps + story count are recomputed and displayed. */
const METRIC_INTERVAL_MS = 500;

/**
 * A small overlay that reports live rendering metrics for the map view.
 * Attach it to a persistent container (the view container), then call
 * {@link start} / {@link stop} to run / halt the measurement loop.
 */
export class DebugPanel {
	private readonly panelEl: HTMLElement;
	private readonly fpsEl: HTMLElement;
	private readonly storiesEl: HTMLElement;
	private readonly renderEl: HTMLElement;
	private readonly getStoryCount: () => number;

	private rafId: number | null = null;
	private lastFrameTime = 0;
	private frameCount = 0;
	private elapsedMs = 0;

	/**
	 * @param containerEl A persistent container to attach the overlay to
	 *   (the board view's container element, which survives re-renders).
	 * @param getStoryCount Callback returning the current number of
	 *   rendered story cards (queried live by the measurement loop).
	 */
	constructor(containerEl: HTMLElement, getStoryCount: () => number) {
		this.getStoryCount = getStoryCount;

		this.panelEl = containerEl.createDiv({ cls: 'usm-debug-panel' });
		this.panelEl.setAttribute('aria-hidden', 'true');

		this.fpsEl = this.createRow(t('debug.fps'));
		this.storiesEl = this.createRow(t('debug.stories'));
		this.renderEl = this.createRow(t('debug.render'));

		this.fpsEl.setText('0');
		this.storiesEl.setText(String(this.getStoryCount()));
		this.renderEl.setText('0.0');
	}

	/** Build one label/value row and return the value element. */
	private createRow(label: string): HTMLElement {
		const row = this.panelEl.createDiv({ cls: 'usm-debug-row' });
		row.createSpan({ cls: 'usm-debug-label', text: label });
		return row.createSpan({ cls: 'usm-debug-value' });
	}

	/** Start the measurement loop (no-op if already running). */
	start(): void {
		if (this.rafId !== null) {
			return;
		}
		this.lastFrameTime = 0;
		this.frameCount = 0;
		this.elapsedMs = 0;
		this.rafId = window.requestAnimationFrame(this.onFrame);
	}

	/** Stop the loop and remove the overlay (no-op if already stopped). */
	stop(): void {
		if (this.rafId !== null) {
			window.cancelAnimationFrame(this.rafId);
			this.rafId = null;
		}
		this.panelEl.remove();
	}

	/** Report the last render duration (ms) measured by the view. */
	setRenderMs(ms: number): void {
		this.renderEl.setText(ms.toFixed(1));
	}

	/**
	 * The `requestAnimationFrame` tick. Accumulates frame deltas and, every
	 * {@link METRIC_INTERVAL_MS}, recomputes the fps and refreshes the
	 * story count. Schedules the next frame while active.
	 */
	private onFrame = (now: number): void => {
		if (this.lastFrameTime === 0) {
			this.lastFrameTime = now;
		}
		this.elapsedMs += now - this.lastFrameTime;
		this.lastFrameTime = now;
		this.frameCount += 1;

		if (this.elapsedMs >= METRIC_INTERVAL_MS) {
			const fps = Math.round((this.frameCount * 1000) / this.elapsedMs);
			this.fpsEl.setText(String(fps));
			this.storiesEl.setText(String(this.getStoryCount()));
			this.frameCount = 0;
			this.elapsedMs = 0;
		}

		this.rafId = window.requestAnimationFrame(this.onFrame);
	};
}
