import { MODULE_ID, MODULE_NAME, SETTINGS } from "./constants";
import { log } from "./utils/logger";

// Type for settings API
interface SettingsAPI {
  register: (module: string, key: string, data: object) => void;
  get: (module: string, key: string) => unknown;
  set: (module: string, key: string, value: unknown) => Promise<unknown>;
}

/**
 * Register module settings in Foundry
 */
export const registerSettings = (): void => {
  log("Registering settings...");

  if (!(game instanceof Game) || !game.settings) {
    return;
  }

  const settings = game.settings as unknown as SettingsAPI;

  // Enable Feature Toggle
  settings.register(MODULE_ID, SETTINGS.ENABLE_FEATURE, {
    name: `${MODULE_NAME}: Enable Feature`,
    hint: "Toggle the main feature of this module on or off.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: false,
  });

  // Debug Mode Toggle
  settings.register(MODULE_ID, SETTINGS.DEBUG_MODE, {
    name: `${MODULE_NAME}: Debug Mode`,
    hint: "Enable debug logging for troubleshooting.",
    scope: "client",
    config: true,
    type: Boolean,
    default: false,
    requiresReload: false,
  });

  // Custom Message Setting
  settings.register(MODULE_ID, SETTINGS.CUSTOM_MESSAGE, {
    name: `${MODULE_NAME}: Custom Message`,
    hint: "Set a custom message to display.",
    scope: "world",
    config: true,
    type: String,
    default: "Hello from FAX-BANK!",
    requiresReload: false,
  });

  log("Settings registered successfully");
};

/**
 * Get a setting value with type safety
 */
export const getSetting = <T>(key: string): T => {
  if (!(game instanceof Game) || !game.settings) {
    return "" as T;
  }
  const settings = game.settings as unknown as SettingsAPI;
  return settings.get(MODULE_ID, key) as T;
};

/**
 * Set a setting value
 */
export const setSetting = async <T>(key: string, value: T): Promise<T> => {
  if (!(game instanceof Game) || !game.settings) {
    return value;
  }
  const settings = game.settings as unknown as SettingsAPI;
  return (await settings.set(MODULE_ID, key, value)) as T;
};

/**
 * Check if debug mode is enabled
 */
export const isDebugMode = (): boolean => {
  return getSetting<boolean>(SETTINGS.DEBUG_MODE);
};

/**
 * Check if main feature is enabled
 */
export const isFeatureEnabled = (): boolean => {
  return getSetting<boolean>(SETTINGS.ENABLE_FEATURE);
};
