/**
 * BankManager - Manages banks, accounts, and transactions
 */

import type { Bank, Account, Transaction, TransactionType, ApiResponse, ID } from "../types";
import { getDataStore, updateDataStore, generateId, now } from "./DataStore";
import { getCurrency, getExchangeRate } from "./EconomyManager";

/**
 * Create a new bank
 */
export const createBank = async (
  economyId: ID,
  name: string,
  description = "",
  interestRate = 0,
  fees = { withdrawal: 0, transfer: 0, exchange: 0 }
): Promise<ApiResponse<Bank>> => {
  const store = getDataStore();
  if (!store.economies[economyId]) {
    return { success: false, error: "Economy not found" };
  }

  const id = generateId();
  const bank: Bank = {
    id,
    economyId,
    name,
    description,
    interestRate,
    fees,
    createdAt: now(),
    updatedAt: now(),
  };

  await updateDataStore((s) => ({
    ...s,
    banks: { ...s.banks, [id]: bank },
  }));

  return { success: true, data: bank };
};

/**
 * Get all banks
 */
export const getBanks = (economyId?: ID): Bank[] => {
  const store = getDataStore();
  const banks = Object.values(store.banks);
  if (economyId) {
    return banks.filter((b) => b.economyId === economyId);
  }
  return banks;
};

/**
 * Get bank by ID
 */
export const getBank = (id: ID): Bank | undefined => {
  const store = getDataStore();
  return store.banks[id];
};

/**
 * Update a bank
 */
export const updateBank = async (
  id: ID,
  updates: Partial<Omit<Bank, "id" | "economyId" | "createdAt">>
): Promise<ApiResponse<Bank>> => {
  const store = getDataStore();
  const bank = store.banks[id];
  if (!bank) {
    return { success: false, error: "Bank not found" };
  }

  const updated: Bank = {
    ...bank,
    ...updates,
    updatedAt: now(),
  };

  await updateDataStore((s) => ({
    ...s,
    banks: { ...s.banks, [id]: updated },
  }));

  return { success: true, data: updated };
};

/**
 * Delete a bank
 */
export const deleteBank = async (id: ID): Promise<ApiResponse> => {
  const store = getDataStore();
  if (!store.banks[id]) {
    return { success: false, error: "Bank not found" };
  }

  // Check if any accounts exist
  const accountsExist = Object.values(store.accounts).some((a) => a.bankId === id);
  if (accountsExist) {
    return { success: false, error: "Cannot delete bank: accounts exist" };
  }

  await updateDataStore((s) => {
    const { [id]: _, ...banks } = s.banks;
    return { ...s, banks };
  });

  return { success: true };
};

/**
 * Create a new account
 */
export const createAccount = async (
  bankId: ID,
  currencyId: ID,
  ownerId: string,
  ownerName: string,
  name = "Main Account"
): Promise<ApiResponse<Account>> => {
  const store = getDataStore();
  const bank = store.banks[bankId];
  if (!bank) {
    return { success: false, error: "Bank not found" };
  }

  const currency = getCurrency(currencyId);
  if (!currency) {
    return { success: false, error: "Currency not found" };
  }

  // Check currency belongs to same economy as bank
  if (currency.economyId !== bank.economyId) {
    return { success: false, error: "Currency does not belong to bank's economy" };
  }

  const id = generateId();
  const account: Account = {
    id,
    bankId,
    currencyId,
    ownerId,
    ownerName,
    name,
    balance: 0,
    isActive: true,
    createdAt: now(),
    updatedAt: now(),
  };

  await updateDataStore((s) => ({
    ...s,
    accounts: { ...s.accounts, [id]: account },
  }));

  return { success: true, data: account };
};

/**
 * Get all accounts
 */
export const getAccounts = (filters?: { bankId?: ID; ownerId?: string }): Account[] => {
  const store = getDataStore();
  let accounts = Object.values(store.accounts);

  if (filters?.bankId) {
    accounts = accounts.filter((a) => a.bankId === filters.bankId);
  }
  if (filters?.ownerId) {
    accounts = accounts.filter((a) => a.ownerId === filters.ownerId);
  }

  return accounts;
};

/**
 * Get account by ID
 */
export const getAccount = (id: ID): Account | undefined => {
  const store = getDataStore();
  return store.accounts[id];
};

/**
 * Update an account
 */
export const updateAccount = async (
  id: ID,
  updates: Partial<Pick<Account, "name" | "isActive">>
): Promise<ApiResponse<Account>> => {
  const store = getDataStore();
  const account = store.accounts[id];
  if (!account) {
    return { success: false, error: "Account not found" };
  }

  const updated: Account = {
    ...account,
    ...updates,
    updatedAt: now(),
  };

  await updateDataStore((s) => ({
    ...s,
    accounts: { ...s.accounts, [id]: updated },
  }));

  return { success: true, data: updated };
};

/**
 * Close an account (set inactive)
 */
export const closeAccount = async (id: ID): Promise<ApiResponse> => {
  const store = getDataStore();
  const account = store.accounts[id];
  if (!account) {
    return { success: false, error: "Account not found" };
  }

  if (account.balance !== 0) {
    return { success: false, error: "Cannot close account with non-zero balance" };
  }

  await updateAccount(id, { isActive: false });
  return { success: true };
};

/**
 * Record a transaction
 */
const recordTransaction = async (
  accountId: ID,
  type: TransactionType,
  amount: number,
  currencyId: ID,
  balanceAfter: number,
  description: string,
  createdBy: string,
  relatedAccountId?: ID,
  relatedTransactionId?: ID
): Promise<Transaction> => {
  const transaction: Transaction = {
    id: generateId(),
    accountId,
    type,
    amount,
    currencyId,
    balanceAfter,
    description,
    relatedAccountId,
    relatedTransactionId,
    createdBy,
    createdAt: now(),
  };

  await updateDataStore((s) => ({
    ...s,
    transactions: [...s.transactions, transaction],
  }));

  return transaction;
};

/**
 * Deposit funds into an account
 */
export const deposit = async (
  accountId: ID,
  amount: number,
  description = "Deposit",
  createdBy = "system"
): Promise<ApiResponse<Transaction>> => {
  if (amount <= 0) {
    return { success: false, error: "Amount must be positive" };
  }

  const store = getDataStore();
  const account = store.accounts[accountId];
  if (!account) {
    return { success: false, error: "Account not found" };
  }

  if (!account.isActive) {
    return { success: false, error: "Account is inactive" };
  }

  const newBalance = account.balance + amount;

  // Update account balance
  await updateDataStore((s) => ({
    ...s,
    accounts: {
      ...s.accounts,
      [accountId]: { ...account, balance: newBalance, updatedAt: now() },
    },
  }));

  // Record transaction
  const transaction = await recordTransaction(
    accountId,
    "deposit",
    amount,
    account.currencyId,
    newBalance,
    description,
    createdBy
  );

  return { success: true, data: transaction };
};

/**
 * Withdraw funds from an account
 */
export const withdraw = async (
  accountId: ID,
  amount: number,
  description = "Withdrawal",
  createdBy = "system"
): Promise<ApiResponse<Transaction>> => {
  if (amount <= 0) {
    return { success: false, error: "Amount must be positive" };
  }

  const store = getDataStore();
  const account = store.accounts[accountId];
  if (!account) {
    return { success: false, error: "Account not found" };
  }

  if (!account.isActive) {
    return { success: false, error: "Account is inactive" };
  }

  if (account.balance < amount) {
    return { success: false, error: "Insufficient funds" };
  }

  const newBalance = account.balance - amount;

  // Update account balance
  await updateDataStore((s) => ({
    ...s,
    accounts: {
      ...s.accounts,
      [accountId]: { ...account, balance: newBalance, updatedAt: now() },
    },
  }));

  // Record transaction
  const transaction = await recordTransaction(
    accountId,
    "withdrawal",
    -amount,
    account.currencyId,
    newBalance,
    description,
    createdBy
  );

  return { success: true, data: transaction };
};

/**
 * Transfer funds between accounts
 */
export const transfer = async (
  fromAccountId: ID,
  toAccountId: ID,
  amount: number,
  description = "Transfer",
  createdBy = "system"
): Promise<ApiResponse<{ from: Transaction; to: Transaction }>> => {
  if (amount <= 0) {
    return { success: false, error: "Amount must be positive" };
  }

  const store = getDataStore();
  const fromAccount = store.accounts[fromAccountId];
  const toAccount = store.accounts[toAccountId];

  if (!fromAccount) {
    return { success: false, error: "Source account not found" };
  }
  if (!toAccount) {
    return { success: false, error: "Destination account not found" };
  }
  if (!fromAccount.isActive || !toAccount.isActive) {
    return { success: false, error: "One or both accounts are inactive" };
  }
  if (fromAccount.balance < amount) {
    return { success: false, error: "Insufficient funds" };
  }

  // Handle currency conversion if needed
  let transferAmount = amount;
  if (fromAccount.currencyId !== toAccount.currencyId) {
    const rate = getExchangeRate(fromAccount.currencyId, toAccount.currencyId);
    if (rate === null) {
      return { success: false, error: "Cannot convert between these currencies" };
    }
    transferAmount = amount * rate;
  }

  const newFromBalance = fromAccount.balance - amount;
  const newToBalance = toAccount.balance + transferAmount;

  // Update both account balances
  await updateDataStore((s) => ({
    ...s,
    accounts: {
      ...s.accounts,
      [fromAccountId]: { ...fromAccount, balance: newFromBalance, updatedAt: now() },
      [toAccountId]: { ...toAccount, balance: newToBalance, updatedAt: now() },
    },
  }));

  // Record transactions
  const fromTransaction = await recordTransaction(
    fromAccountId,
    "transfer",
    -amount,
    fromAccount.currencyId,
    newFromBalance,
    `${description} to ${toAccount.ownerName}`,
    createdBy,
    toAccountId
  );

  const toTransaction = await recordTransaction(
    toAccountId,
    "transfer",
    transferAmount,
    toAccount.currencyId,
    newToBalance,
    `${description} from ${fromAccount.ownerName}`,
    createdBy,
    fromAccountId,
    fromTransaction.id
  );

  return { success: true, data: { from: fromTransaction, to: toTransaction } };
};

/**
 * Get transactions for an account
 */
export const getTransactions = (accountId: ID, limit = 50): Transaction[] => {
  const store = getDataStore();
  return store.transactions
    .filter((t) => t.accountId === accountId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, limit);
};

/**
 * Get all transactions (for admin)
 */
export const getAllTransactions = (limit = 100): Transaction[] => {
  const store = getDataStore();
  return store.transactions.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
};

/**
 * Get account balance with currency info
 */
export const getAccountBalance = (
  accountId: ID
): { balance: number; currency: ReturnType<typeof getCurrency> } | null => {
  const account = getAccount(accountId);
  if (!account) return null;

  const currency = getCurrency(account.currencyId);
  return { balance: account.balance, currency };
};
