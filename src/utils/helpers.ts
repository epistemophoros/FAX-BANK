import { MODULE_ID } from "../constants";

/**
 * Localize a string using Foundry's localization system
 */
export const localize = (key: string): string => {
  return game.i18n.localize(`${MODULE_ID}.${key}`);
};

/**
 * Format a localized string with substitutions
 */
export const format = (key: string, data: Record<string, string | number>): string => {
  return game.i18n.format(`${MODULE_ID}.${key}`, data);
};

/**
 * Deep clone an object safely
 */
export const deepClone = <T>(obj: T): T => {
  return foundry.utils.deepClone(obj);
};

/**
 * Merge objects with Foundry's mergeObject utility
 */
export const mergeObjects = <T extends object>(
  original: T,
  updates: Partial<T>,
  options?: { insertKeys?: boolean; insertValues?: boolean; overwrite?: boolean }
): T => {
  return foundry.utils.mergeObject(original, updates, options) as T;
};

/**
 * Check if the current user is a GM
 */
export const isGM = (): boolean => {
  return game instanceof Game && (game.user?.isGM ?? false);
};

/**
 * Get the current user
 */
export const getCurrentUser = (): User | null => {
  if (game instanceof Game) {
    return game.user ?? null;
  }
  return null;
};

/**
 * Generate a unique ID
 */
export const generateId = (): string => {
  return foundry.utils.randomID();
};

/**
 * Debounce a function
 */
export const debounce = <T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  delay: number
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout>;

  return (...args: Parameters<T>): void => {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => fn(...args), delay);
  };
};

/**
 * Throttle a function
 */
export const throttle = <T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle = false;

  return (...args: Parameters<T>): void => {
    if (!inThrottle) {
      fn(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

