import { MODULE_ID, MODULE_NAME } from "../constants";

/**
 * Log levels for the module
 */
type LogLevel = "log" | "warn" | "error" | "debug";

// Type for game object with settings
type GameWithSettings = {
  settings?: {
    get: (module: string, key: string) => unknown;
  };
};

/**
 * Format a log message with module prefix
 */
const formatMessage = (message: string): string => {
  return `${MODULE_NAME} | ${message}`;
};

/**
 * Check if debug mode is enabled
 * Note: This uses a direct check to avoid circular dependencies with settings.ts
 */
const isDebugEnabled = (): boolean => {
  try {
    const gameObj = game as GameWithSettings | undefined;
    if (!gameObj?.settings) {
      return false;
    }
    return Boolean(gameObj.settings.get(MODULE_ID, "debugMode"));
  } catch {
    return false;
  }
};

/**
 * Internal logging function
 */
const logInternal = (level: LogLevel, message: string, ...args: unknown[]): void => {
  const formattedMessage = formatMessage(message);

  switch (level) {
    case "log":
      console.log(formattedMessage, ...args); // eslint-disable-line no-console
      break;
    case "warn":
      console.warn(formattedMessage, ...args);
      break;
    case "error":
      console.error(formattedMessage, ...args);
      break;
    case "debug":
      if (isDebugEnabled()) {
        console.log(`[DEBUG] ${formattedMessage}`, ...args); // eslint-disable-line no-console
      }
      break;
  }
};

/**
 * Log a standard message
 */
export const log = (message: string, ...args: unknown[]): void => {
  logInternal("log", message, ...args);
};

/**
 * Log a warning message
 */
export const warn = (message: string, ...args: unknown[]): void => {
  logInternal("warn", message, ...args);
};

/**
 * Log an error message
 */
export const error = (message: string, ...args: unknown[]): void => {
  logInternal("error", message, ...args);
};

/**
 * Log a debug message (only when debug mode is enabled)
 */
export const debug = (message: string, ...args: unknown[]): void => {
  logInternal("debug", message, ...args);
};
