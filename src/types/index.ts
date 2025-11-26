/**
 * FAX-BANK Type Definitions
 * Core data structures for the banking system
 */

/** Unique identifier type */
export type ID = string;

/** Timestamp in milliseconds */
export type Timestamp = number;

/**
 * Economy - Represents a kingdom, faction, or region's economy
 */
export interface Economy {
  id: ID;
  name: string;
  description: string;
  baseCurrencyId: ID | null;
  interestRate: number; // Percentage (e.g., 5 = 5%)
  growthRate: number; // Economic growth percentage
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Currency - A type of money within an economy
 */
export interface Currency {
  id: ID;
  economyId: ID;
  name: string;
  abbreviation: string; // e.g., "gp", "sp", "cp"
  symbol: string; // e.g., "🪙", "$", "G"
  baseValue: number; // Value relative to economy's base currency (1 = base)
  color: string; // Hex color for UI
  createdAt: Timestamp;
}

/**
 * Exchange Rate between two currencies
 */
export interface ExchangeRate {
  fromCurrencyId: ID;
  toCurrencyId: ID;
  rate: number; // How many "to" units per 1 "from" unit
  updatedAt: Timestamp;
}

/**
 * Bank - A financial institution within an economy
 */
export interface Bank {
  id: ID;
  economyId: ID;
  name: string;
  description: string;
  interestRate: number; // Bank-specific interest rate override
  fees: {
    withdrawal: number; // Percentage fee
    transfer: number; // Percentage fee
    exchange: number; // Percentage fee for currency exchange
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Account - A bank account owned by an actor
 */
export interface Account {
  id: ID;
  bankId: ID;
  currencyId: ID;
  ownerId: string; // Actor ID in Foundry
  ownerName: string; // Cached actor name
  name: string; // Account name (e.g., "Main", "Savings")
  balance: number;
  isActive: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

/**
 * Transaction Types
 */
export type TransactionType = "deposit" | "withdrawal" | "transfer" | "exchange" | "interest" | "fee";

/**
 * Transaction - A record of money movement
 */
export interface Transaction {
  id: ID;
  accountId: ID;
  type: TransactionType;
  amount: number;
  currencyId: ID;
  balanceAfter: number;
  description: string;
  relatedAccountId?: ID; // For transfers
  relatedTransactionId?: ID; // For linked transactions
  createdBy: string; // User ID who initiated
  createdAt: Timestamp;
}

/**
 * Complete data store structure
 */
export interface BankDataStore {
  version: string;
  economies: Record<ID, Economy>;
  currencies: Record<ID, Currency>;
  exchangeRates: ExchangeRate[];
  banks: Record<ID, Bank>;
  accounts: Record<ID, Account>;
  transactions: Transaction[];
}

/**
 * Default D&D 5e currencies preset
 */
export const DND5E_CURRENCIES = [
  { name: "Platinum", abbreviation: "pp", symbol: "⬜", baseValue: 10, color: "#E5E4E2" },
  { name: "Gold", abbreviation: "gp", symbol: "🪙", baseValue: 1, color: "#FFD700" },
  { name: "Electrum", abbreviation: "ep", symbol: "⚪", baseValue: 0.5, color: "#C0C0C0" },
  { name: "Silver", abbreviation: "sp", symbol: "🔘", baseValue: 0.1, color: "#C0C0C0" },
  { name: "Copper", abbreviation: "cp", symbol: "🟤", baseValue: 0.01, color: "#B87333" },
] as const;

/**
 * Default Pathfinder currencies preset
 */
export const PATHFINDER_CURRENCIES = [
  { name: "Platinum", abbreviation: "pp", symbol: "⬜", baseValue: 10, color: "#E5E4E2" },
  { name: "Gold", abbreviation: "gp", symbol: "🪙", baseValue: 1, color: "#FFD700" },
  { name: "Silver", abbreviation: "sp", symbol: "🔘", baseValue: 0.1, color: "#C0C0C0" },
  { name: "Copper", abbreviation: "cp", symbol: "🟤", baseValue: 0.01, color: "#B87333" },
] as const;

/**
 * API Response types
 */
export interface ApiResponse<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}

