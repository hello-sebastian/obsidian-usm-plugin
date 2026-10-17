/**
 * Plugin settings (T021).
 *
 * The sample-plugin settings (`MyPluginSettings`, `SampleSettingTab`,
 * `mySetting`) were removed as part of the T012 boilerplate cleanup.
 *
 * T021 adds the `debugMode` setting (boolean, default `false`) and the
 * settings tab that exposes it. The debug/dev metrics panel (T022) is
 * gated on this flag; metrics are computed only while the panel is
 * active, so there is no overhead when disabled (FR-020, SC-001;
 * research R-07).
 */
import { Setting, SettingTab } from 'obsidian';
import type UsmPlugin from './main';
import { t } from '../ui/en';
import { refreshBoardDebugPanels } from './board-view';

export interface UsmSettings {
	/**
	 * Enables the debug/dev metrics panel on the map view (FR-020).
	 * Default `false` — the panel and its measurement loop only run
	 * while enabled (research R-07).
	 */
	debugMode: boolean;
}

export const DEFAULT_SETTINGS: UsmSettings = {
	debugMode: false,
};

/**
 * Settings tab (T021) — exposes the `debugMode` toggle.
 */
export class UsmSettingTab extends SettingTab {
	plugin: UsmPlugin;

	constructor(plugin: UsmPlugin) {
		super();
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName(t('settings.debug-mode'))
			.setDesc(t('settings.debug-mode.desc'))
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.debugMode)
					.onChange(async (value) => {
						this.plugin.settings.debugMode = value;
						await this.plugin.saveSettings();
						// Show/hide the metrics overlay immediately (T022,
						// quickstart Q7) without waiting for the next render.
						refreshBoardDebugPanels(this.plugin.app);
					}),
			);
	}
}
