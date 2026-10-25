import { Plugin } from 'obsidian';
import { DEFAULT_SETTINGS, UsmSettings, UsmSettingTab } from './settings';
import {
	BOARD_VIEW_TYPE,
	BoardView,
	registerBoardViewRouting,
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

		// Register the board view type (T045/T048). The view reads the
		// `debugMode` setting live so the metrics panel (T022) reacts to
		// setting changes without a restart.
		this.registerView(BOARD_VIEW_TYPE, (leaf) =>
			new BoardView(leaf, () => this.settings.debugMode),
		);

		// Restore and persist the last-selected view for board notes
		// (T047). No command-palette commands are registered (FR-002,
		// amended): view switching uses the dedicated pane-header
		// view-switch button (FR-027, amended).
		registerBoardViewRouting(this);

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
