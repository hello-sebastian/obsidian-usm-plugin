import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, UsmSettings, UsmSettingTab } from './settings';
import {
	BOARD_VIEW_TYPE,
	BoardView,
	registerBoardFileRouting,
	registerBoardViewCommands,
} from './board-view';

/**
 * User Story Map plugin entry point (T012).
 *
 * Kept minimal: plugin lifecycle + registration only. All feature logic
 * lives in dedicated modules (`domain/`, `obsidian/`, `ui/`) per the
 * project conventions (Constitution Principle VII).
 */
export default class UsmPlugin extends Plugin {
	settings!: UsmSettings;

	async onload() {
		await this.loadSettings();

		// Register the board view type (T010/T012). The view reads the
		// `debugMode` setting live so the metrics panel (T022) reacts to
		// setting changes without a restart.
		this.registerView(BOARD_VIEW_TYPE, (leaf) =>
			new BoardView(leaf, () => this.settings.debugMode),
		);

		// Register the map/markdown toggle commands (T010).
		registerBoardViewCommands(this);

		// Route board notes (usm-board: true) to the board view (T012).
		registerBoardFileRouting(this);

		// Register the settings tab (T021).
		this.addSettingTab(new UsmSettingTab(this));
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
