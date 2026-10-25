/**
 * Shared jsdom helper: patches Obsidian's `HTMLElement` extensions onto the
 * native prototype (test-only).
 *
 * Obsidian augments `HTMLElement` with convenience methods the renderer and
 * story-card rely on (`createDiv`, `createSpan`, `setText`, `empty`,
 * `addClass`, `setCssProps`, …). jsdom's native `HTMLElement` lacks them, so
 * the prototype is patched once before any DOM is built. Guarded by a
 * `__usmPatched` flag so repeated calls are no-ops.
 *
 * Used by the integration tests (T019/T020) and the performance suite (T034).
 */
export function patchHTMLElement(): void {
	const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
	if (proto.__usmPatched) {
		return;
	}
	proto.__usmPatched = true;

	const applyOpts = (el: HTMLElement, opts: Record<string, unknown>): void => {
		if (!opts) {
			return;
		}
		if (typeof opts.cls === 'string') {
			el.classList.add(opts.cls);
		}
		if (typeof opts.text === 'string') {
			el.textContent = opts.text;
		}
		if (typeof opts.title === 'string') {
			el.title = opts.title;
		}
		if (opts.attr && typeof opts.attr === 'object') {
			for (const [k, v] of Object.entries(opts.attr as Record<string, string>)) {
				el.setAttribute(k, v);
			}
		}
	};

	proto.empty = function (this: HTMLElement): void {
		while (this.firstChild) {
			this.removeChild(this.firstChild);
		}
	};
	proto.createEl = function (
		this: HTMLElement,
		tag: string,
		opts: Record<string, unknown> = {},
	): HTMLElement {
		const el = document.createElement(tag);
		applyOpts(el, opts);
		this.appendChild(el);
		return el;
	};
	proto.createDiv = function (
		this: HTMLElement,
		opts: Record<string, unknown> = {},
	): HTMLElement {
		return this.createEl('div', opts);
	};
	proto.createSpan = function (
		this: HTMLElement,
		opts: Record<string, unknown> = {},
	): HTMLElement {
		return this.createEl('span', opts);
	};
	proto.setText = function (this: HTMLElement, text: string): void {
		this.empty();
		if (text) {
			this.appendChild(document.createTextNode(text));
		}
	};
	proto.addClass = function (this: HTMLElement, cls: string): void {
		this.classList.add(cls);
	};
	proto.removeClass = function (this: HTMLElement, cls: string): void {
		this.classList.remove(cls);
	};
	proto.toggleClass = function (
		this: HTMLElement,
		cls: string,
		force?: boolean,
	): void {
		this.classList.toggle(cls, force);
	};
	proto.setCssProps = function (
		this: HTMLElement,
		props: Record<string, string>,
	): void {
		for (const [k, v] of Object.entries(props)) {
			this.style.setProperty(k, v);
		}
	};
	// Obsidian augments HTMLElement with hide()/show(); jsdom lacks them.
	// This mirrors Obsidian's real implementation (which sets style.display),
	// so the direct assignment is intentional and confined to this test helper.
	// (tests/ is exempt from no-static-styles-assignment — see eslint.config.mts.)
	proto.hide = function (this: HTMLElement): void {
		this.style.display = 'none';
	};
	proto.show = function (this: HTMLElement): void {
		this.style.display = '';
	};
}
