/**
 * FAX-BANK Settings
 */

import { MODULE_ID, SETTINGS } from "./constants";
import { log } from "./utils/logger";

// Type for game object with settings
type GameWithSettings = {
  settings?: {
    register: (module: string, key: string, data: object) => void;
    get: (module: string, key: string) => unknown;
    set: (module: string, key: string, value: unknown) => Promise<unknown>;
  };
};

/**
 * Register module settings in Foundry
 */
export const registerSettings = (): void => {
  log("Registering settings...");

  const gameObj = game as GameWithSettings | undefined;
  if (!gameObj?.settings) {
    return;
  }

  // Show Bank Button on Token HUD
  gameObj.settings.register(MODULE_ID, SETTINGS.ENABLE_FEATURE, {
    name: "Show Bank on Token HUD",
    hint: "Display a bank button (🏦) on the Token HUD for quick access to character banking.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: false,
  });

  // Enable Shift+Click on Tokens
  gameObj.settings.register(MODULE_ID, SETTINGS.DEBUG_MODE, {
    name: "Shift+Click Opens Bank",
    hint: "Hold Shift and click on any token to instantly open their bank dialog.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: false,
  });

  // Default Currency Display
  gameObj.settings.register(MODULE_ID, SETTINGS.CUSTOM_MESSAGE, {
    name: "Currency Display Format",
    hint: "How currency amounts should be displayed throughout the module.",
    scope: "client",
    config: true,
    type: String,
    choices: {
      symbol: "Symbol (🪙 100)",
      abbreviation: "Abbreviation (100 gp)",
      full: "Full Name (100 Gold)",
    },
    default: "abbreviation",
    requiresReload: false,
  });

  log("Settings registered successfully");
};

/**
 * Get a setting value with type safety
 */
export const getSetting = <T>(key: string): T => {
  const gameObj = game as GameWithSettings | undefined;
  if (!gameObj?.settings) {
    // Return defaults if settings not available
    if (key === SETTINGS.ENABLE_FEATURE) return true as T;
    if (key === SETTINGS.DEBUG_MODE) return true as T;
    if (key === SETTINGS.CUSTOM_MESSAGE) return "abbreviation" as T;
    return "" as T;
  }

  try {
    return gameObj.settings.get(MODULE_ID, key) as T;
  } catch {
    // Return defaults if setting doesn't exist yet
    if (key === SETTINGS.ENABLE_FEATURE) return true as T;
    if (key === SETTINGS.DEBUG_MODE) return true as T;
    if (key === SETTINGS.CUSTOM_MESSAGE) return "abbreviation" as T;
    return "" as T;
  }
};

/**
 * Set a setting value
 */
export const setSetting = async <T>(key: string, value: T): Promise<T> => {
  const gameObj = game as GameWithSettings | undefined;
  if (!gameObj?.settings) {
    return value;
  }
  return (await gameObj.settings.set(MODULE_ID, key, value)) as T;
};

/**
 * Check if Token HUD button is enabled
 */
export const isTokenHUDEnabled = (): boolean => {
  return getSetting<boolean>(SETTINGS.ENABLE_FEATURE);
};

/**
 * Check if Shift+Click is enabled
 */
export const isShiftClickEnabled = (): boolean => {
  return getSetting<boolean>(SETTINGS.DEBUG_MODE);
};

/**
 * Get currency display format
 */
export const getCurrencyFormat = (): "symbol" | "abbreviation" | "full" => {
  return getSetting<"symbol" | "abbreviation" | "full">(SETTINGS.CUSTOM_MESSAGE);
};
