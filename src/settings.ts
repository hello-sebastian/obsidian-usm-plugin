/**
 * Plugin settings (T012).
 *
 * The sample-plugin settings (`MyPluginSettings`, `SampleSettingTab`,
 * `mySetting`) were removed as part of the T012 boilerplate cleanup.
 * This interface is the forward-looking home for plugin settings;
 * T021 adds the `debugMode` setting and a settings tab.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type -- intentionally empty until T021 adds `debugMode`
export interface UsmSettings {}

export const DEFAULT_SETTINGS: UsmSettings = {};
