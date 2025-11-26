/**
 * FAX-BANK Logger Utility
 * Provides consistent logging with module prefix
 */

import { MODULE_ID, SETTINGS } from "../constants";

// Type for game object
type GameWithSettings = {
  settings?: {
    get: (module: string, key: string) => unknown;
  };
};

/**
 * Check if debug mode is enabled
 */
const isDebugEnabled = (): boolean => {
  const gameObj = game as GameWithSettings | undefined;
  if (!gameObj?.settings) return false;

  try {
    return gameObj.settings.get(MODULE_ID, SETTINGS.DEBUG_MODE) === true;
  } catch {
    return false;
  }
};

/**
 * Log a message to the console with module prefix
 */
export const log = (...args: unknown[]): void => {
  console.log(`%c[FAX-BANK]`, "color: #FFD700; font-weight: bold;", ...args);
};

/**
 * Log a debug message (only if debug mode is enabled)
 */
export const debug = (...args: unknown[]): void => {
  if (isDebugEnabled()) {
    console.debug(`%c[FAX-BANK DEBUG]`, "color: #87CEEB; font-weight: bold;", ...args);
  }
};

/**
 * Log a warning message
 */
export const warn = (...args: unknown[]): void => {
  console.warn(`%c[FAX-BANK WARN]`, "color: #FFA500; font-weight: bold;", ...args);
};

/**
 * Log an error message
 */
export const error = (...args: unknown[]): void => {
  console.error(`%c[FAX-BANK ERROR]`, "color: #FF6347; font-weight: bold;", ...args);
};

/**
 * Log an info message
 */
export const info = (...args: unknown[]): void => {
  console.info(`%c[FAX-BANK]`, "color: #32CD32; font-weight: bold;", ...args);
};
