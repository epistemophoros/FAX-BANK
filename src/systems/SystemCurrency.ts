/**
 * SystemCurrency - Integrates with game system currency (dnd5e, pf2e, etc.)
 * Actually reads/writes from character sheets
 */

import { MODULE_ID } from "../constants";
import { log } from "../utils/logger";

// Currency types for different systems
export interface CurrencyData {
  pp?: number; // Platinum
  gp?: number; // Gold
  ep?: number; // Electrum (dnd5e only)
  sp?: number; // Silver
  cp?: number; // Copper
}

// Conversion rates to copper (base unit)
export const CONVERSION_RATES: Record<string, Record<string, number>> = {
  dnd5e: {
    cp: 1,
    sp: 10,
    ep: 50,
    gp: 100,
    pp: 1000,
  },
  pf2e: {
    cp: 1,
    sp: 10,
    gp: 100,
    pp: 1000,
  },
  // Default fallback
  default: {
    cp: 1,
    sp: 10,
    gp: 100,
    pp: 1000,
  },
};

// Currency display names
export const CURRENCY_NAMES: Record<string, string> = {
  cp: "Copper",
  sp: "Silver",
  ep: "Electrum",
  gp: "Gold",
  pp: "Platinum",
};

// Currency symbols/abbreviations
export const CURRENCY_ABBREV: Record<string, string> = {
  cp: "cp",
  sp: "sp",
  ep: "ep",
  gp: "gp",
  pp: "pp",
};

type GameWithSystem = {
  system?: { id?: string };
};

type ActorWithCurrency = {
  id?: string;
  name?: string;
  system?: {
    currency?: CurrencyData;
  };
  update?: (data: object) => Promise<unknown>;
  getFlag?: (module: string, key: string) => unknown;
  setFlag?: (module: string, key: string, value: unknown) => Promise<unknown>;
  unsetFlag?: (module: string, key: string) => Promise<unknown>;
};

/**
 * Get the current game system ID
 */
export const getGameSystem = (): string => {
  const gameObj = game as GameWithSystem | undefined;
  return gameObj?.system?.id ?? "default";
};

/**
 * Check if current system is supported
 */
export const isSystemSupported = (): boolean => {
  const system = getGameSystem();
  return system === "dnd5e" || system === "pf2e";
};

/**
 * Get available currencies for current system
 */
export const getAvailableCurrencies = (): string[] => {
  const system = getGameSystem();
  if (system === "dnd5e") {
    return ["pp", "gp", "ep", "sp", "cp"];
  }
  if (system === "pf2e") {
    return ["pp", "gp", "sp", "cp"];
  }
  return ["pp", "gp", "sp", "cp"];
};

/**
 * Get conversion rate for a currency to copper
 */
export const getConversionRate = (currency: string): number => {
  const system = getGameSystem();
  const rates = CONVERSION_RATES[system] ?? CONVERSION_RATES.default;
  return rates[currency] ?? 1;
};

/**
 * Convert amount between currencies
 */
export const convertCurrency = (
  amount: number,
  fromCurrency: string,
  toCurrency: string
): number => {
  const fromRate = getConversionRate(fromCurrency);
  const toRate = getConversionRate(toCurrency);
  // Convert to copper, then to target
  const copperValue = amount * fromRate;
  return Math.floor(copperValue / toRate);
};

/**
 * Get actor's current currency from character sheet
 */
export const getActorCurrency = (actor: ActorWithCurrency): CurrencyData => {
  if (!actor?.system?.currency) {
    return { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };
  }
  return { ...actor.system.currency };
};

/**
 * Get specific currency amount from actor
 */
export const getActorCurrencyAmount = (
  actor: ActorWithCurrency,
  currency: string
): number => {
  const currencyData = getActorCurrency(actor);
  return (currencyData[currency as keyof CurrencyData] as number) ?? 0;
};

/**
 * Get actor's total wealth in copper
 */
export const getActorTotalWealth = (actor: ActorWithCurrency): number => {
  const currency = getActorCurrency(actor);
  let total = 0;

  for (const [key, value] of Object.entries(currency)) {
    if (typeof value === "number") {
      total += value * getConversionRate(key);
    }
  }

  return total;
};

/**
 * Check if actor has enough currency
 */
export const actorHasCurrency = (
  actor: ActorWithCurrency,
  currency: string,
  amount: number
): boolean => {
  const currentAmount = getActorCurrencyAmount(actor, currency);
  return currentAmount >= amount;
};

/**
 * Check if actor can afford amount (checking total wealth)
 */
export const actorCanAfford = (
  actor: ActorWithCurrency,
  currency: string,
  amount: number
): boolean => {
  const totalWealth = getActorTotalWealth(actor);
  const costInCopper = amount * getConversionRate(currency);
  return totalWealth >= costInCopper;
};

/**
 * Add currency to actor's character sheet
 */
export const addCurrencyToActor = async (
  actor: ActorWithCurrency,
  currency: string,
  amount: number
): Promise<boolean> => {
  if (!actor?.update) {
    log("Cannot update actor - no update method");
    return false;
  }

  const currentAmount = getActorCurrencyAmount(actor, currency);
  const newAmount = currentAmount + amount;

  try {
    await actor.update({
      [`system.currency.${currency}`]: newAmount,
    });
    log(`Added ${amount} ${currency} to ${actor.name ?? "Unknown"}`);
    return true;
  } catch (error) {
    log(`Failed to add currency: ${String(error)}`);
    return false;
  }
};

/**
 * Remove currency from actor's character sheet
 * Returns false if actor doesn't have enough
 */
export const removeCurrencyFromActor = async (
  actor: ActorWithCurrency,
  currency: string,
  amount: number
): Promise<boolean> => {
  if (!actor?.update) {
    log("Cannot update actor - no update method");
    return false;
  }

  const currentAmount = getActorCurrencyAmount(actor, currency);

  if (currentAmount < amount) {
    log(`Insufficient funds: has ${currentAmount} ${currency}, needs ${amount}`);
    return false;
  }

  const newAmount = currentAmount - amount;

  try {
    await actor.update({
      [`system.currency.${currency}`]: newAmount,
    });
    log(`Removed ${amount} ${currency} from ${actor.name ?? "Unknown"}`);
    return true;
  } catch (error) {
    log(`Failed to remove currency: ${String(error)}`);
    return false;
  }
};

/**
 * Transfer currency between two actors
 */
export const transferCurrencyBetweenActors = async (
  fromActor: ActorWithCurrency,
  toActor: ActorWithCurrency,
  currency: string,
  amount: number
): Promise<boolean> => {
  // Check if sender has enough
  if (!actorHasCurrency(fromActor, currency, amount)) {
    return false;
  }

  // Remove from sender first
  const removed = await removeCurrencyFromActor(fromActor, currency, amount);
  if (!removed) {
    return false;
  }

  // Add to recipient
  const added = await addCurrencyToActor(toActor, currency, amount);
  if (!added) {
    // Rollback - give money back to sender
    await addCurrencyToActor(fromActor, currency, amount);
    return false;
  }

  return true;
};

/**
 * Format currency for display
 */
export const formatCurrency = (amount: number, currency: string): string => {
  const abbrev = CURRENCY_ABBREV[currency] ?? currency;
  return `${amount} ${abbrev}`;
};

/**
 * Format all currencies for display
 */
export const formatAllCurrency = (currencyData: CurrencyData): string => {
  const parts: string[] = [];
  const order = ["pp", "gp", "ep", "sp", "cp"];

  for (const key of order) {
    const value = currencyData[key as keyof CurrencyData];
    if (typeof value === "number" && value > 0) {
      parts.push(formatCurrency(value, key));
    }
  }

  return parts.length > 0 ? parts.join(", ") : "0 gp";
};

/**
 * Check if an actor is flagged as a bank NPC
 */
export const isActorBank = (actor: ActorWithCurrency): boolean => {
  if (!actor?.getFlag) return false;
  return actor.getFlag(MODULE_ID, "isBank") === true;
};

/**
 * Get bank data from actor
 */
export const getActorBankData = (
  actor: ActorWithCurrency
): { bankId?: string; bankName?: string } | null => {
  if (!actor?.getFlag) return null;
  const bankId = actor.getFlag(MODULE_ID, "bankId") as string | undefined;
  const bankName = actor.getFlag(MODULE_ID, "bankName") as string | undefined;
  if (!bankId) return null;
  return { bankId, bankName };
};

/**
 * Set actor as a bank NPC
 */
export const setActorAsBank = async (
  actor: ActorWithCurrency,
  bankId: string,
  bankName: string
): Promise<boolean> => {
  if (!actor?.setFlag) return false;

  try {
    await actor.setFlag(MODULE_ID, "isBank", true);
    await actor.setFlag(MODULE_ID, "bankId", bankId);
    await actor.setFlag(MODULE_ID, "bankName", bankName);
    log(`Set ${actor.name ?? "Unknown"} as bank: ${bankName}`);
    return true;
  } catch (error) {
    log(`Failed to set actor as bank: ${String(error)}`);
    return false;
  }
};

/**
 * Remove bank status from actor
 */
export const removeActorBankStatus = async (actor: ActorWithCurrency): Promise<boolean> => {
  if (!actor?.unsetFlag) return false;

  try {
    await actor.unsetFlag(MODULE_ID, "isBank");
    await actor.unsetFlag(MODULE_ID, "bankId");
    await actor.unsetFlag(MODULE_ID, "bankName");
    log(`Removed bank status from ${actor.name ?? "Unknown"}`);
    return true;
  } catch (error) {
    log(`Failed to remove bank status: ${String(error)}`);
    return false;
  }
};

