import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, UsmSettings } from './settings';
import {
	BOARD_VIEW_TYPE,
	BoardView,
	registerBoardFileRouting,
	registerBoardViewCommands,
} from './board/board-view';

/**
 * User Story Map plugin entry point (T012).
 *
 * Kept minimal: plugin lifecycle + registration only. All feature logic
 * lives in dedicated modules (`board/`, `story/`, `i18n/`, `debug/`,
 * `utils/`) per the project conventions.
 */
export default class UsmPlugin extends Plugin {
	settings!: UsmSettings;

	async onload() {
		await this.loadSettings();

		// Register the board view type (T010/T012).
		this.registerView(BOARD_VIEW_TYPE, (leaf) => new BoardView(leaf));

		// Register the map/markdown toggle commands (T010).
		registerBoardViewCommands(this);

		// Route board notes (usm-board: true) to the board view (T012).
		registerBoardFileRouting(this);
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			(await this.loadData()) as Partial<UsmSettings>,
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}
