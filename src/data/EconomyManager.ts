/**
 * EconomyManager - Manages economies and currencies
 */

import type { Economy, Currency, ExchangeRate, ApiResponse, ID } from "../types";
import { DND5E_CURRENCIES, PATHFINDER_CURRENCIES } from "../types";
import { getDataStore, updateDataStore, generateId, now } from "./DataStore";

/**
 * Create a new economy
 */
export const createEconomy = async (
  name: string,
  description = "",
  interestRate = 0,
  growthRate = 0
): Promise<ApiResponse<Economy>> => {
  const id = generateId();
  const economy: Economy = {
    id,
    name,
    description,
    baseCurrencyId: null,
    interestRate,
    growthRate,
    createdAt: now(),
    updatedAt: now(),
  };

  await updateDataStore((store) => ({
    ...store,
    economies: { ...store.economies, [id]: economy },
  }));

  return { success: true, data: economy };
};

/**
 * Get all economies
 */
export const getEconomies = (): Economy[] => {
  const store = getDataStore();
  return Object.values(store.economies);
};

/**
 * Get economy by ID
 */
export const getEconomy = (id: ID): Economy | undefined => {
  const store = getDataStore();
  return store.economies[id];
};

/**
 * Update an economy
 */
export const updateEconomy = async (
  id: ID,
  updates: Partial<Omit<Economy, "id" | "createdAt">>
): Promise<ApiResponse<Economy>> => {
  const store = getDataStore();
  const economy = store.economies[id];
  if (!economy) {
    return { success: false, error: "Economy not found" };
  }

  const updated: Economy = {
    ...economy,
    ...updates,
    updatedAt: now(),
  };

  await updateDataStore((s) => ({
    ...s,
    economies: { ...s.economies, [id]: updated },
  }));

  return { success: true, data: updated };
};

/**
 * Delete an economy and all associated data
 */
export const deleteEconomy = async (id: ID): Promise<ApiResponse> => {
  const store = getDataStore();
  if (!store.economies[id]) {
    return { success: false, error: "Economy not found" };
  }

  await updateDataStore((s) => {
    // Remove economy
    const { [id]: _, ...economies } = s.economies;

    // Remove currencies in this economy
    const currencies = Object.fromEntries(
      Object.entries(s.currencies).filter(([, c]) => c.economyId !== id)
    );

    // Remove banks in this economy
    const bankIds = Object.values(s.banks)
      .filter((b) => b.economyId === id)
      .map((b) => b.id);
    const banks = Object.fromEntries(Object.entries(s.banks).filter(([, b]) => b.economyId !== id));

    // Remove accounts in deleted banks
    const accounts = Object.fromEntries(
      Object.entries(s.accounts).filter(([, a]) => !bankIds.includes(a.bankId))
    );

    // Remove transactions for deleted accounts
    const accountIds = Object.keys(accounts);
    const transactions = s.transactions.filter((t) => accountIds.includes(t.accountId));

    return { ...s, economies, currencies, banks, accounts, transactions };
  });

  return { success: true };
};

/**
 * Create a new currency
 */
export const createCurrency = async (
  economyId: ID,
  name: string,
  abbreviation: string,
  symbol: string,
  baseValue: number,
  color = "#FFD700"
): Promise<ApiResponse<Currency>> => {
  const store = getDataStore();
  if (!store.economies[economyId]) {
    return { success: false, error: "Economy not found" };
  }

  const id = generateId();
  const currency: Currency = {
    id,
    economyId,
    name,
    abbreviation,
    symbol,
    baseValue,
    color,
    createdAt: now(),
  };

  await updateDataStore((s) => ({
    ...s,
    currencies: { ...s.currencies, [id]: currency },
  }));

  // Set as base currency if this is the first currency or has baseValue of 1
  if (baseValue === 1) {
    await updateEconomy(economyId, { baseCurrencyId: id });
  }

  return { success: true, data: currency };
};

/**
 * Get currencies for an economy
 */
export const getCurrencies = (economyId?: ID): Currency[] => {
  const store = getDataStore();
  const currencies = Object.values(store.currencies);
  if (economyId) {
    return currencies.filter((c) => c.economyId === economyId);
  }
  return currencies;
};

/**
 * Get currency by ID
 */
export const getCurrency = (id: ID): Currency | undefined => {
  const store = getDataStore();
  return store.currencies[id];
};

/**
 * Delete a currency
 */
export const deleteCurrency = async (id: ID): Promise<ApiResponse> => {
  const store = getDataStore();
  if (!store.currencies[id]) {
    return { success: false, error: "Currency not found" };
  }

  // Check if any accounts use this currency
  const accountsUsing = Object.values(store.accounts).filter((a) => a.currencyId === id);
  if (accountsUsing.length > 0) {
    return { success: false, error: "Cannot delete currency: accounts exist using this currency" };
  }

  await updateDataStore((s) => {
    const { [id]: _, ...currencies } = s.currencies;
    return { ...s, currencies };
  });

  return { success: true };
};

/**
 * Add D&D 5e currencies to an economy
 */
export const addDnD5eCurrencies = async (economyId: ID): Promise<ApiResponse> => {
  for (const c of DND5E_CURRENCIES) {
    await createCurrency(economyId, c.name, c.abbreviation, c.symbol, c.baseValue, c.color);
  }
  return { success: true };
};

/**
 * Add Pathfinder currencies to an economy
 */
export const addPathfinderCurrencies = async (economyId: ID): Promise<ApiResponse> => {
  for (const c of PATHFINDER_CURRENCIES) {
    await createCurrency(economyId, c.name, c.abbreviation, c.symbol, c.baseValue, c.color);
  }
  return { success: true };
};

/**
 * Calculate exchange rate between two currencies
 */
export const getExchangeRate = (fromCurrencyId: ID, toCurrencyId: ID): number | null => {
  const store = getDataStore();
  const from = store.currencies[fromCurrencyId];
  const to = store.currencies[toCurrencyId];

  if (!from || !to) return null;

  // If same currency, rate is 1
  if (fromCurrencyId === toCurrencyId) return 1;

  // Check for custom exchange rate
  const customRate = store.exchangeRates.find(
    (r) => r.fromCurrencyId === fromCurrencyId && r.toCurrencyId === toCurrencyId
  );
  if (customRate) return customRate.rate;

  // Calculate based on base values (only works within same economy)
  if (from.economyId === to.economyId) {
    return from.baseValue / to.baseValue;
  }

  // Cross-economy exchange not supported without custom rate
  return null;
};

/**
 * Set custom exchange rate
 */
export const setExchangeRate = async (
  fromCurrencyId: ID,
  toCurrencyId: ID,
  rate: number
): Promise<ApiResponse<ExchangeRate>> => {
  const store = getDataStore();
  if (!store.currencies[fromCurrencyId] || !store.currencies[toCurrencyId]) {
    return { success: false, error: "Currency not found" };
  }

  const exchangeRate: ExchangeRate = {
    fromCurrencyId,
    toCurrencyId,
    rate,
    updatedAt: now(),
  };

  await updateDataStore((s) => {
    // Remove existing rate if any
    const rates = s.exchangeRates.filter(
      (r) => !(r.fromCurrencyId === fromCurrencyId && r.toCurrencyId === toCurrencyId)
    );
    return { ...s, exchangeRates: [...rates, exchangeRate] };
  });

  return { success: true, data: exchangeRate };
};

/**
 * Convert amount between currencies
 */
export const convertCurrency = (
  amount: number,
  fromCurrencyId: ID,
  toCurrencyId: ID
): number | null => {
  const rate = getExchangeRate(fromCurrencyId, toCurrencyId);
  if (rate === null) return null;
  return amount * rate;
};

