/**
 * EconomyManager - Manages economies, currencies, and banks
 */

import { MODULE_ID } from "../constants";
import { log } from "../utils/logger";

// Types
export interface Currency {
  id: string;
  name: string;
  abbrev: string;
  symbol: string;
  baseValue: number; // Value relative to base currency (1 = base)
  isBase: boolean;
}

export interface Economy {
  id: string;
  name: string;
  description: string;
  currencies: Currency[];
  baseCurrencyId: string;
  interestRate: number; // Annual interest rate (0.05 = 5%)
  createdAt: number;
}

export interface Bank {
  id: string;
  name: string;
  economyId: string;
  npcActorId?: string; // Actor assigned as bank NPC
  interestRate: number; // Override economy rate, or -1 to use economy default
  fees: {
    withdrawal: number; // Percentage fee (0.01 = 1%)
    transfer: number;
    exchange: number;
  };
  createdAt: number;
}

export interface BankAccount {
  id: string;
  bankId: string;
  ownerActorId: string;
  ownerName: string;
  balances: Record<string, number>; // currencyId -> amount
  createdAt: number;
}

export interface Transaction {
  id: string;
  type: "deposit" | "withdrawal" | "transfer" | "exchange" | "interest";
  accountId: string;
  bankId: string;
  currencyId: string;
  amount: number;
  fee: number;
  targetAccountId?: string; // For transfers
  targetCurrencyId?: string; // For exchanges
  targetAmount?: number; // For exchanges
  description: string;
  timestamp: number;
}

// Data storage interface
interface EconomyData {
  economies: Economy[];
  banks: Bank[];
  accounts: BankAccount[];
  transactions: Transaction[];
}

type GameWithSettings = {
  settings?: {
    get: (module: string, key: string) => unknown;
    set: (module: string, key: string, value: unknown) => Promise<unknown>;
    register: (module: string, key: string, data: object) => void;
  };
};

const STORAGE_KEY = "economyData";

// Default data
const defaultData: EconomyData = {
  economies: [],
  banks: [],
  accounts: [],
  transactions: [],
};

/**
 * Load economy data from settings
 */
export const loadEconomyData = (): EconomyData => {
  const gameObj = game as GameWithSettings | undefined;
  if (!gameObj?.settings) return { ...defaultData };

  try {
    const data = gameObj.settings.get(MODULE_ID, STORAGE_KEY) as EconomyData | undefined;
    return data ?? { ...defaultData };
  } catch {
    return { ...defaultData };
  }
};

/**
 * Save economy data to settings
 */
export const saveEconomyData = async (data: EconomyData): Promise<void> => {
  const gameObj = game as GameWithSettings | undefined;
  if (!gameObj?.settings) return;

  try {
    await gameObj.settings.set(MODULE_ID, STORAGE_KEY, data);
    log("Economy data saved");
  } catch (error) {
    log(`Failed to save economy data: ${String(error)}`);
  }
};

/**
 * Register the storage setting
 */
export const registerEconomyStorage = (): void => {
  const gameObj = game as GameWithSettings | undefined;
  if (!gameObj?.settings) return;

  gameObj.settings.register(MODULE_ID, STORAGE_KEY, {
    name: "Economy Data",
    hint: "Internal storage for economy system",
    scope: "world",
    config: false,
    type: Object,
    default: defaultData,
  });
};

// ============ ECONOMY FUNCTIONS ============

/**
 * Create a new economy
 */
export const createEconomy = async (
  name: string,
  description: string,
  baseCurrency: { name: string; abbrev: string; symbol: string }
): Promise<Economy> => {
  const data = loadEconomyData();

  const economyId = `eco_${Date.now()}`;
  const currencyId = `cur_${Date.now()}`;

  const currency: Currency = {
    id: currencyId,
    name: baseCurrency.name,
    abbrev: baseCurrency.abbrev,
    symbol: baseCurrency.symbol,
    baseValue: 1,
    isBase: true,
  };

  const economy: Economy = {
    id: economyId,
    name,
    description,
    currencies: [currency],
    baseCurrencyId: currencyId,
    interestRate: 0,
    createdAt: Date.now(),
  };

  data.economies.push(economy);
  await saveEconomyData(data);

  log(`Created economy: ${name}`);
  return economy;
};

/**
 * Get all economies
 */
export const getEconomies = (): Economy[] => {
  return loadEconomyData().economies;
};

/**
 * Get economy by ID
 */
export const getEconomy = (economyId: string): Economy | undefined => {
  return loadEconomyData().economies.find((e) => e.id === economyId);
};

/**
 * Update an economy
 */
export const updateEconomy = async (
  economyId: string,
  updates: Partial<Omit<Economy, "id" | "createdAt">>
): Promise<boolean> => {
  const data = loadEconomyData();
  const index = data.economies.findIndex((e) => e.id === economyId);

  if (index === -1) return false;

  data.economies[index] = { ...data.economies[index], ...updates };
  await saveEconomyData(data);

  log(`Updated economy: ${economyId}`);
  return true;
};

/**
 * Delete an economy (and all associated banks/accounts)
 */
export const deleteEconomy = async (economyId: string): Promise<boolean> => {
  const data = loadEconomyData();

  // Remove economy
  data.economies = data.economies.filter((e) => e.id !== economyId);

  // Remove associated banks
  const bankIds = data.banks.filter((b) => b.economyId === economyId).map((b) => b.id);
  data.banks = data.banks.filter((b) => b.economyId !== economyId);

  // Remove associated accounts
  data.accounts = data.accounts.filter((a) => !bankIds.includes(a.bankId));

  // Remove associated transactions
  data.transactions = data.transactions.filter((t) => !bankIds.includes(t.bankId));

  await saveEconomyData(data);

  log(`Deleted economy: ${economyId}`);
  return true;
};

// ============ CURRENCY FUNCTIONS ============

/**
 * Add currency to an economy
 */
export const addCurrency = async (
  economyId: string,
  name: string,
  abbrev: string,
  symbol: string,
  baseValue: number
): Promise<Currency | null> => {
  const data = loadEconomyData();
  const economy = data.economies.find((e) => e.id === economyId);

  if (!economy) return null;

  const currency: Currency = {
    id: `cur_${Date.now()}`,
    name,
    abbrev,
    symbol,
    baseValue,
    isBase: false,
  };

  economy.currencies.push(currency);
  await saveEconomyData(data);

  log(`Added currency ${name} to economy ${economyId}`);
  return currency;
};

/**
 * Update currency exchange rate
 */
export const updateCurrency = async (
  economyId: string,
  currencyId: string,
  updates: Partial<Omit<Currency, "id" | "isBase">>
): Promise<boolean> => {
  const data = loadEconomyData();
  const economy = data.economies.find((e) => e.id === economyId);

  if (!economy) return false;

  const currency = economy.currencies.find((c) => c.id === currencyId);
  if (!currency) return false;

  Object.assign(currency, updates);
  await saveEconomyData(data);

  log(`Updated currency ${currencyId}`);
  return true;
};

/**
 * Remove currency from economy
 */
export const removeCurrency = async (economyId: string, currencyId: string): Promise<boolean> => {
  const data = loadEconomyData();
  const economy = data.economies.find((e) => e.id === economyId);

  if (!economy) return false;

  const currency = economy.currencies.find((c) => c.id === currencyId);
  if (!currency || currency.isBase) return false; // Can't remove base currency

  economy.currencies = economy.currencies.filter((c) => c.id !== currencyId);
  await saveEconomyData(data);

  log(`Removed currency ${currencyId} from economy ${economyId}`);
  return true;
};

// ============ BANK FUNCTIONS ============

/**
 * Create a new bank
 */
export const createBank = async (
  name: string,
  economyId: string,
  npcActorId?: string
): Promise<Bank | null> => {
  const data = loadEconomyData();

  // Verify economy exists
  if (!data.economies.find((e) => e.id === economyId)) return null;

  const bank: Bank = {
    id: `bank_${Date.now()}`,
    name,
    economyId,
    npcActorId,
    interestRate: -1, // Use economy default
    fees: {
      withdrawal: 0,
      transfer: 0,
      exchange: 0.02, // 2% exchange fee default
    },
    createdAt: Date.now(),
  };

  data.banks.push(bank);
  await saveEconomyData(data);

  log(`Created bank: ${name}`);
  return bank;
};

/**
 * Get all banks
 */
export const getBanks = (): Bank[] => {
  return loadEconomyData().banks;
};

/**
 * Get banks for an economy
 */
export const getBanksByEconomy = (economyId: string): Bank[] => {
  return loadEconomyData().banks.filter((b) => b.economyId === economyId);
};

/**
 * Get bank by ID
 */
export const getBank = (bankId: string): Bank | undefined => {
  return loadEconomyData().banks.find((b) => b.id === bankId);
};

/**
 * Get bank by NPC actor ID
 */
export const getBankByNPC = (actorId: string): Bank | undefined => {
  return loadEconomyData().banks.find((b) => b.npcActorId === actorId);
};

/**
 * Update a bank
 */
export const updateBank = async (
  bankId: string,
  updates: Partial<Omit<Bank, "id" | "createdAt">>
): Promise<boolean> => {
  const data = loadEconomyData();
  const index = data.banks.findIndex((b) => b.id === bankId);

  if (index === -1) return false;

  data.banks[index] = { ...data.banks[index], ...updates };
  await saveEconomyData(data);

  log(`Updated bank: ${bankId}`);
  return true;
};

/**
 * Delete a bank
 */
export const deleteBank = async (bankId: string): Promise<boolean> => {
  const data = loadEconomyData();

  data.banks = data.banks.filter((b) => b.id !== bankId);
  data.accounts = data.accounts.filter((a) => a.bankId !== bankId);
  data.transactions = data.transactions.filter((t) => t.bankId !== bankId);

  await saveEconomyData(data);

  log(`Deleted bank: ${bankId}`);
  return true;
};

// ============ ACCOUNT FUNCTIONS ============

/**
 * Create a bank account
 */
export const createAccount = async (
  bankId: string,
  ownerActorId: string,
  ownerName: string
): Promise<BankAccount | null> => {
  const data = loadEconomyData();

  const bank = data.banks.find((b) => b.id === bankId);
  if (!bank) return null;

  // Check if account already exists
  const existing = data.accounts.find(
    (a) => a.bankId === bankId && a.ownerActorId === ownerActorId
  );
  if (existing) return existing;

  const account: BankAccount = {
    id: `acc_${Date.now()}`,
    bankId,
    ownerActorId,
    ownerName,
    balances: {},
    createdAt: Date.now(),
  };

  data.accounts.push(account);
  await saveEconomyData(data);

  log(`Created account for ${ownerName} at bank ${bankId}`);
  return account;
};

/**
 * Get accounts for an actor
 */
export const getAccountsByOwner = (ownerActorId: string): BankAccount[] => {
  return loadEconomyData().accounts.filter((a) => a.ownerActorId === ownerActorId);
};

/**
 * Get accounts at a bank
 */
export const getAccountsByBank = (bankId: string): BankAccount[] => {
  return loadEconomyData().accounts.filter((a) => a.bankId === bankId);
};

/**
 * Get account by ID
 */
export const getAccount = (accountId: string): BankAccount | undefined => {
  return loadEconomyData().accounts.find((a) => a.id === accountId);
};

/**
 * Update account balance
 */
export const updateAccountBalance = async (
  accountId: string,
  currencyId: string,
  amount: number,
  type: Transaction["type"],
  description: string
): Promise<boolean> => {
  const data = loadEconomyData();
  const account = data.accounts.find((a) => a.id === accountId);

  if (!account) return false;

  const currentBalance = account.balances[currencyId] ?? 0;
  const newBalance = currentBalance + amount;

  if (newBalance < 0) return false; // Insufficient funds

  account.balances[currencyId] = newBalance;

  // Record transaction
  const transaction: Transaction = {
    id: `txn_${Date.now()}`,
    type,
    accountId,
    bankId: account.bankId,
    currencyId,
    amount,
    fee: 0,
    description,
    timestamp: Date.now(),
  };

  data.transactions.push(transaction);
  await saveEconomyData(data);

  log(`${type}: ${amount} ${currencyId} for account ${accountId}`);
  return true;
};

// ============ TRANSACTION FUNCTIONS ============

/**
 * Get transactions for an account
 */
export const getTransactions = (accountId: string): Transaction[] => {
  return loadEconomyData().transactions.filter((t) => t.accountId === accountId);
};

/**
 * Convert currency using economy exchange rates
 */
export const convertCurrency = (
  economyId: string,
  fromCurrencyId: string,
  toCurrencyId: string,
  amount: number
): number => {
  const economy = getEconomy(economyId);
  if (!economy) return 0;

  const fromCurrency = economy.currencies.find((c) => c.id === fromCurrencyId);
  const toCurrency = economy.currencies.find((c) => c.id === toCurrencyId);

  if (!fromCurrency || !toCurrency) return 0;

  // Convert to base value, then to target
  const baseAmount = amount * fromCurrency.baseValue;
  return baseAmount / toCurrency.baseValue;
};
