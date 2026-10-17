/**
 * Story card component (T015, US3).
 *
 * Renders a single {@link StoryEntry} as an interactive card:
 * - header: the card title (already resolved via the title cascade in
 *   `story-attributes.ts`, FR-009), clamped to a few lines via CSS
 *   `-webkit-line-clamp` (see `styles.css`);
 * - footer: a badge showing the Release value only (FR-010 — no status
 *   attribute in the MVP);
 * - click / Enter / Space opens the linked note in the standard view
 *   (FR-019);
 * - keyboard accessible: `tabindex="0"`, `role="button"` (Constitution
 *   Principle IV).
 *
 * Broken-link entries (`isBroken: true`, no `targetPath`) render as dimmed,
 * inert placeholder cards (T018, research R-11) — no click or keyboard
 * activation, since there is no note to open. The card shows the link text
 * as its title plus a "Missing note" hint in the footer (label from
 * `src/i18n/en.ts`). The dimmed styling (reduced opacity, dashed border,
 * no hover/focus affordances) is defined in `styles.css`.
 *
 * All note-derived strings (title, badge, hint) are inserted as text nodes
 * (FR-016) — never via `innerHTML` — so note content can never execute as
 * markup.
 *
 * Integration into the grid renderer is provided by T016.
 */
import type { StoryEntry } from '../types';
import { t } from '../i18n/en';

/**
 * Create a story card in `parent` for `entry`.
 *
 * @param parent The container element (a grid cell) to append the card to.
 * @param entry The story entry to render.
 * @param openNote Callback that opens a note by its resolved path (FR-019).
 *   Provided by the view/renderer. Never invoked for broken entries.
 * @returns The created card element.
 */
export function createStoryCard(
	parent: HTMLElement,
	entry: StoryEntry,
	openNote: (path: string) => void,
): HTMLElement {
	const card = parent.createDiv({ cls: 'usm-story-card' });

	// Header: the resolved title (FR-009). Text-node insertion keeps the
	// note-derived title inert (FR-016).
	const header = card.createDiv({ cls: 'usm-story-card-header' });
	header.setText(entry.title);

	// Footer: the Release badge (FR-010 — Release value only in the MVP).
	// The footer is always present for consistent card height; the badge is
	// added only when a Release value exists.
	const footer = card.createDiv({ cls: 'usm-story-card-footer' });
	const release = entry.attributes.release;
	if (release !== null) {
		const badge = footer.createSpan({ cls: 'usm-story-card-badge' });
		badge.setText(release.text);
	}

	// Broken links have no note to open → the card is a dimmed, inert
	// placeholder (T018, R-11): no click or keyboard activation. The title
	// already carries the link text (set by the parser); the footer shows a
	// "Missing note" hint so the user knows the target is absent.
	const targetPath = entry.targetPath;
	if (entry.isBroken || targetPath === null) {
		card.addClass('usm-story-card--broken');
		const hint = footer.createSpan({ cls: 'usm-story-card-broken-hint' });
		hint.setText(t('card.broken'));
		return card;
	}

	// Interactive card: click / Enter / Space opens the linked note (FR-019).
	card.setAttribute('role', 'button');
	card.setAttribute('tabindex', '0');
	card.addEventListener('click', () => {
		openNote(targetPath);
	});
	card.addEventListener('keydown', (evt) => {
		if (evt.key === 'Enter' || evt.key === ' ') {
			evt.preventDefault();
			openNote(targetPath);
		}
	});

	return card;
}
