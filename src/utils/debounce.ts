/**
 * Debounce utility (research R-03).
 *
 * Coalesces bursts of events (e.g. a series of `metadataCache`/`vault`
 * change events while the user is editing) into a single trailing call.
 * Supports `cancel()` so pending work can be discarded on view close.
 */
export interface DebouncedFn<A extends unknown[]> {
	/** Invoke with the original arguments; schedules the trailing call. */
	(...args: A): void;
	/** Cancel any pending (not yet executed) invocation. */
	cancel: () => void;
	/** True when a trailing call is currently scheduled. */
	pending: () => boolean;
}

/**
 * Create a debounced wrapper around `fn`.
 *
 * @param fn      The function to debounce.
 * @param delayMs Delay in milliseconds between the last call and execution.
 * @param options `leading` fires on the first call of a burst (default false).
 */
export function debounce<A extends unknown[]>(
	fn: (...args: A) => void,
	delayMs: number,
	options: { leading?: boolean } = {},
): DebouncedFn<A> {
	const { leading = false } = options;
	let timer: number | null = null;
	let lastArgs: A | null = null;

	const invoke = (): void => {
		timer = null;
		if (lastArgs !== null) {
			const args = lastArgs;
			lastArgs = null;
			fn(...args);
		}
	};

	const debounced = (...args: A): void => {
		lastArgs = args;
		if (timer !== null) {
			window.clearTimeout(timer);
		}
		if (leading && timer === null) {
			// Fire immediately on the first call of a burst, then reset.
			fn(...args);
			timer = window.setTimeout(() => {
				timer = null;
			}, delayMs);
		} else {
			timer = window.setTimeout(invoke, delayMs);
		}
	};

	debounced.cancel = (): void => {
		if (timer !== null) {
			window.clearTimeout(timer);
			timer = null;
		}
		lastArgs = null;
	};

	debounced.pending = (): boolean => timer !== null;

	return debounced;
}
