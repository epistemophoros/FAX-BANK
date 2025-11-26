/**
 * DataStore - Persistent storage for FAX-BANK data
 * Uses Foundry's settings API to store data
 */

import { MODULE_ID } from "../constants";
import type { BankDataStore } from "../types";

const STORAGE_KEY = "bankData";

/**
 * Get the default empty data store
 */
const getDefaultStore = (): BankDataStore => ({
  version: "1.0.0",
  economies: {},
  currencies: {},
  exchangeRates: [],
  banks: {},
  accounts: {},
  transactions: [],
});

// Type for game settings
type GameSettings = {
  register: (module: string, key: string, data: object) => void;
  get: (module: string, key: string) => unknown;
  set: (module: string, key: string, value: unknown) => Promise<unknown>;
};

/**
 * Register the data store setting
 */
export const registerDataStore = (): void => {
  const gameObj = game as { settings?: GameSettings } | undefined;
  if (!gameObj?.settings) return;

  gameObj.settings.register(MODULE_ID, STORAGE_KEY, {
    name: "Bank Data Store",
    hint: "Stores all banking data. Do not modify manually.",
    scope: "world",
    config: false,
    type: Object,
    default: getDefaultStore(),
  });
};

/**
 * Get the current data store
 */
export const getDataStore = (): BankDataStore => {
  const gameObj = game as { settings?: GameSettings } | undefined;
  if (!gameObj?.settings) return getDefaultStore();

  const data = gameObj.settings.get(MODULE_ID, STORAGE_KEY) as BankDataStore | undefined;
  return data ?? getDefaultStore();
};

/**
 * Save the data store
 */
export const saveDataStore = async (store: BankDataStore): Promise<void> => {
  const gameObj = game as { settings?: GameSettings } | undefined;
  if (!gameObj?.settings) return;

  await gameObj.settings.set(MODULE_ID, STORAGE_KEY, store);
};

/**
 * Update the data store with a partial update
 */
export const updateDataStore = async (
  updater: (store: BankDataStore) => BankDataStore
): Promise<BankDataStore> => {
  const current = getDataStore();
  const updated = updater(current);
  await saveDataStore(updated);
  return updated;
};

/**
 * Generate a unique ID
 */
export const generateId = (): string => {
  return foundry.utils.randomID();
};

/**
 * Get current timestamp
 */
export const now = (): number => Date.now();

