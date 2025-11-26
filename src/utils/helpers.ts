/**
 * FAX-BANK Helper Utilities
 */

import { MODULE_ID } from "../constants";

// Type for game object with i18n
type GameWithI18n = {
  i18n?: {
    localize: (key: string) => string;
    format: (key: string, data?: Record<string, string | number>) => string;
  };
};

/**
 * Localize a string using Foundry's i18n
 */
export const localize = (key: string): string => {
  const gameObj = game as GameWithI18n | undefined;
  if (!gameObj?.i18n) return key;
  return gameObj.i18n.localize(key);
};

/**
 * Localize a string with data interpolation
 */
export const format = (key: string, data: Record<string, string | number>): string => {
  const gameObj = game as GameWithI18n | undefined;
  if (!gameObj?.i18n) return key;
  return gameObj.i18n.format(key, data);
};

/**
 * Format a number as currency
 */
export const formatCurrency = (
  amount: number,
  symbol = "",
  abbreviation = "",
  displayMode: "symbol" | "abbreviation" | "full" = "abbreviation"
): string => {
  const formattedAmount = amount.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });

  switch (displayMode) {
    case "symbol":
      return `${symbol} ${formattedAmount}`;
    case "abbreviation":
      return `${formattedAmount} ${abbreviation}`;
    case "full":
      return formattedAmount;
    default:
      return formattedAmount;
  }
};

/**
 * Format a timestamp to a readable date string
 */
export const formatDate = (timestamp: number, includeTime = true): string => {
  const date = new Date(timestamp);
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "short",
    day: "numeric",
  };

  if (includeTime) {
    options.hour = "2-digit";
    options.minute = "2-digit";
  }

  return date.toLocaleDateString(undefined, options);
};

/**
 * Generate a random color hex code
 */
export const randomColor = (): string => {
  return `#${Math.floor(Math.random() * 16777215)
    .toString(16)
    .padStart(6, "0")}`;
};

/**
 * Debounce a function
 */
export const debounce = <T extends (...args: Parameters<T>) => unknown>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeout) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Throttle a function
 */
export const throttle = <T extends (...args: Parameters<T>) => unknown>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let lastTime = 0;

  return (...args: Parameters<T>) => {
    const now = Date.now();
    if (now - lastTime >= wait) {
      lastTime = now;
      func(...args);
    }
  };
};

/**
 * Check if the current user is a GM
 */
export const isGM = (): boolean => {
  const gameObj = game as { user?: { isGM?: boolean } } | undefined;
  return gameObj?.user?.isGM ?? false;
};

/**
 * Get the module version
 */
export const getModuleVersion = (): string => {
  type GameWithModules = {
    modules?: { get: (id: string) => { version?: string } | undefined };
  };
  const gameObj = game as GameWithModules | undefined;
  return gameObj?.modules?.get(MODULE_ID)?.version ?? "unknown";
};
