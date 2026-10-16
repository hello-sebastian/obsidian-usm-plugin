/**
 * Grid model building (T009).
 *
 * Builds the in-memory {@link GridModel} from a {@link BoardConfig} and the
 * ordered {@link StoryEntry[]} parsed from a board file. The model has no
 * lifecycle of its own — it is rebuilt from scratch on every (debounced)
 * update event (data-model.md E-06).
 *
 * The column hierarchy (Activity → Task → Epic) is ordered by first
 * appearance across the board's story entries (FR-005). Rows (Release) are
 * ordered per `BoardConfig.releaseRowOrder` (FR-006). A missing attribute at
 * any level maps to the reserved {@link UNASSIGNED} key, which the renderer
 * draws as a dedicated "Unassigned" section (FR-011). Values are compared
 * case-insensitively so e.g. `Login` and `login` group together (spec edge
 * case).
 *
 * Note on alphabetical Release ordering: the model stores the internal
 * {@link UNASSIGNED} sentinel (not the i18n "Unassigned" label), so when
 * sorting alphabetically the Unassigned row is pinned to the end — a
 * predictable convention for a catch-all bucket.
 */
import type {
	AttributeValue,
	BoardConfig,
	ColumnGroup,
	GridModel,
	StoryEntry,
	TaskGroup,
} from '../types';
import { UNASSIGNED, cellKey, normalizeKey } from '../types';

/**
 * One hierarchy level as discovered while scanning the entries: the
 * normalized grouping `key` plus the display `label` (original casing) of the
 * first occurrence, and the resolved `linkPath` when the value is a wikilink
 * (FR-007).
 */
interface LevelEntry {
	key: string;
	label: string;
	/** Resolved note path when the value is a wikilink (FR-007). */
	linkPath?: string;
}

/**
 * Resolve the grouping key and display label for a single attribute value.
 * A missing (or empty) value maps to the reserved {@link UNASSIGNED}
 * key/label, which the renderer renders as an "Unassigned" section.
 */
function levelOf(value: AttributeValue | null): LevelEntry {
	if (value === null) {
		return { key: UNASSIGNED, label: UNASSIGNED };
	}
	const text = value.text.trim();
	if (text.length === 0) {
		return { key: UNASSIGNED, label: UNASSIGNED };
	}
	return { key: normalizeKey(text), label: text, linkPath: value.linkPath };
}

/**
 * Build the {@link GridModel} from a board config and its story entries.
 *
 * @param config  Board-level configuration (drives Release row ordering).
 * @param entries Ordered story entries (order of appearance in the board file).
 */
export function buildGridModel(
	config: BoardConfig,
	entries: readonly StoryEntry[],
): GridModel {
	const unassigned = {
		activity: false,
		task: false,
		epic: false,
		release: false,
	};

	const cells = new Map<string, StoryEntry[]>();
	const headerLinks = new Map<string, string>();

	// Column hierarchy bookkeeping (first-appearance order, key-based so that
	// values group case-insensitively).
	const activities: ColumnGroup[] = [];
	const activitiesByKey = new Map<string, ColumnGroup>();
	const tasksByActivity = new Map<string, Map<string, TaskGroup>>();
	const epicSeenByTaskGroup = new Map<TaskGroup, Set<string>>();

	// Release row bookkeeping (first-appearance order).
	const releaseEntries: LevelEntry[] = [];
	const releaseSeen = new Set<string>();

	for (const entry of entries) {
		const activity = levelOf(entry.attributes.activity);
		const task = levelOf(entry.attributes.task);
		const epic = levelOf(entry.attributes.epic);
		const release = levelOf(entry.attributes.release);

		// --- Activity (top-level column group) ---
		let group = activitiesByKey.get(activity.key);
		if (group === undefined) {
			group = { activity: activity.label, tasks: [] };
			activitiesByKey.set(activity.key, group);
			activities.push(group);
			if (activity.linkPath !== undefined) {
				headerLinks.set(`activity:${activity.key}`, activity.linkPath);
			}
		}

		// --- Task (nested under Activity) ---
		let taskMap = tasksByActivity.get(activity.key);
		if (taskMap === undefined) {
			taskMap = new Map();
			tasksByActivity.set(activity.key, taskMap);
		}
		let taskGroup = taskMap.get(task.key);
		if (taskGroup === undefined) {
			// First encounter: the current label is the first-appearance label.
			taskGroup = { task: task.label, epics: [] };
			taskMap.set(task.key, taskGroup);
			group.tasks.push(taskGroup);
			if (task.linkPath !== undefined) {
				headerLinks.set(`task:${task.key}`, task.linkPath);
			}
		}

		// --- Epic (nested under Task) ---
		let epicSeen = epicSeenByTaskGroup.get(taskGroup);
		if (epicSeen === undefined) {
			epicSeen = new Set();
			epicSeenByTaskGroup.set(taskGroup, epicSeen);
		}
		if (!epicSeen.has(epic.key)) {
			// First encounter: the current label is the first-appearance label.
			epicSeen.add(epic.key);
			taskGroup.epics.push(epic.label);
			if (epic.linkPath !== undefined) {
				headerLinks.set(`epic:${epic.key}`, epic.linkPath);
			}
		}

		// --- Release (rows) ---
		if (!releaseSeen.has(release.key)) {
			releaseSeen.add(release.key);
			releaseEntries.push(release);
			if (release.linkPath !== undefined) {
				headerLinks.set(`release:${release.key}`, release.linkPath);
			}
		}

		// --- Cell placement (order of appearance within the cell) ---
		const key = cellKey(activity.key, task.key, epic.key, release.key);
		const bucket = cells.get(key);
		if (bucket === undefined) {
			cells.set(key, [entry]);
		} else {
			bucket.push(entry);
		}

		// --- Unassigned flags (per level) ---
		if (activity.key === UNASSIGNED) {
			unassigned.activity = true;
		}
		if (task.key === UNASSIGNED) {
			unassigned.task = true;
		}
		if (epic.key === UNASSIGNED) {
			unassigned.epic = true;
		}
		if (release.key === UNASSIGNED) {
			unassigned.release = true;
		}
	}

	// Order the Release rows per the board config.
	const releases =
		config.releaseRowOrder === 'alphabetical'
			? [...releaseEntries]
					.sort((a, b) => {
						// Keep the "Unassigned" row last regardless of sort.
						if (a.key === UNASSIGNED) {
							return 1;
						}
						if (b.key === UNASSIGNED) {
							return -1;
						}
						return a.label.localeCompare(b.label, undefined, {
							sensitivity: 'base',
						});
					})
					.map((entry) => entry.label)
			: releaseEntries.map((entry) => entry.label);

	return {
		activities,
		releases,
		cells,
		headerLinks,
		unassigned,
	};
}
