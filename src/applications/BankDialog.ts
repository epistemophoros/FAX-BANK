/**
 * BankDialog - Player interface for banking
 * Shows personal wallet AND bank account separately
 */

import { MODULE_ID } from "../constants";
import { log } from "../utils/logger";
import {
  getActorCurrency,
  formatAllCurrency,
  getAvailableCurrencies,
  addCurrencyToActor,
  removeCurrencyFromActor,
  CURRENCY_NAMES,
} from "../systems/SystemCurrency";
import {
  getBanks,
  getAccountsByOwner,
  createAccount,
  updateAccountBalance,
  getEconomy,
  type BankAccount,
} from "../data/EconomyManager";

type ActorType = {
  id?: string;
  name?: string;
  img?: string;
  system?: {
    currency?: Record<string, number>;
  };
  update?: (data: object) => Promise<unknown>;
};

type GameWithActors = {
  actors?: {
    get: (id: string) => ActorType | undefined;
    contents?: ActorType[];
  };
  user?: {
    isGM?: boolean;
  };
};

type NotificationsType = {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
};

interface BankAccountDisplay extends BankAccount {
  bankName: string;
  balanceDisplay: string;
}

interface BankDialogData {
  actorId: string;
  actorName: string;
  actorImg: string;
  // Personal wallet (from character sheet)
  walletCurrencies: Array<{ key: string; name: string; amount: number }>;
  walletDisplay: string;
  // Bank accounts
  accounts: BankAccountDisplay[];
  hasAccounts: boolean;
  // Available banks to open account
  availableBanks: Array<{ id: string; name: string; economyName: string }>;
  // Available currencies for current bank
  currencies: string[];
  isGM: boolean;
}

/**
 * Bank Dialog for managing bank accounts separate from personal wallet
 */
export class BankDialog extends Application {
  private actorId: string;
  private actorName: string;
  private selectedAccountId: string | null = null;

  constructor(actorId: string, actorName: string) {
    super();
    this.actorId = actorId;
    this.actorName = actorName;
  }

  static override get defaultOptions(): ApplicationOptions {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "fax-bank-dialog",
      title: "🏦 Bank",
      template: `modules/${MODULE_ID}/templates/bank-dialog.hbs`,
      width: 500,
      height: "auto" as const,
      classes: ["fax-bank", "bank-dialog"],
      resizable: true,
    }) as ApplicationOptions;
  }

  override get title(): string {
    return `🏦 ${this.actorName}'s Banking`;
  }

  override getData(): BankDialogData {
    const gameObj = game as GameWithActors | undefined;
    const actor = gameObj?.actors?.get(this.actorId);

    // Get personal wallet from character sheet
    const walletCurrency = actor ? getActorCurrency(actor) : {};
    const walletCurrencies = getAvailableCurrencies().map((key) => ({
      key,
      name: CURRENCY_NAMES[key] ?? key,
      amount: (walletCurrency[key as keyof typeof walletCurrency] as number) ?? 0,
    }));

    // Get bank accounts for this actor
    const allAccounts = getAccountsByOwner(this.actorId);
    const banks = getBanks();

    const accounts: BankAccountDisplay[] = allAccounts.map((account) => {
      const bank = banks.find((b) => b.id === account.bankId);
      const economy = bank ? getEconomy(bank.economyId) : null;

      // Format balance display
      const balanceParts: string[] = [];
      for (const [currencyId, amount] of Object.entries(account.balances)) {
        if (amount > 0) {
          const currency = economy?.currencies.find((c) => c.id === currencyId);
          balanceParts.push(`${amount} ${currency?.abbrev ?? currencyId}`);
        }
      }

      return {
        ...account,
        bankName: bank?.name ?? "Unknown Bank",
        balanceDisplay: balanceParts.length > 0 ? balanceParts.join(", ") : "Empty",
      };
    });

    // Get banks where actor doesn't have an account yet
    const accountBankIds = allAccounts.map((a) => a.bankId);
    const availableBanks = banks
      .filter((b) => !accountBankIds.includes(b.id))
      .map((b) => {
        const economy = getEconomy(b.economyId);
        return {
          id: b.id,
          name: b.name,
          economyName: economy?.name ?? "Unknown",
        };
      });

    return {
      actorId: this.actorId,
      actorName: this.actorName,
      actorImg: actor?.img ?? "icons/svg/mystery-man.svg",
      walletCurrencies,
      walletDisplay: formatAllCurrency(walletCurrency),
      accounts,
      hasAccounts: accounts.length > 0,
      availableBanks,
      currencies: getAvailableCurrencies(),
      isGM: gameObj?.user?.isGM ?? false,
    };
  }

  override activateListeners(html: JQuery): void {
    super.activateListeners(html);

    const notifications = ui.notifications as NotificationsType | undefined;
    const gameObj = game as GameWithActors | undefined;

    // Open new account
    html.find(".open-account-btn").on("click", (event) => {
      event.preventDefault();
      const bankId = html.find("#new-account-bank").val() as string;

      if (!bankId) {
        notifications?.warn("Select a bank");
        return;
      }

      void createAccount(bankId, this.actorId, this.actorName).then((account) => {
        if (account) {
          const bank = getBanks().find((b) => b.id === bankId);
          notifications?.info(`Opened account at ${bank?.name ?? "bank"}`);
          this.render();
        } else {
          notifications?.error("Failed to open account");
        }
      });
    });

    // Deposit money (wallet → bank)
    html.find(".deposit-btn").on("click", (event) => {
      event.preventDefault();
      const accountId = event.currentTarget.dataset.accountId;
      if (!accountId) return;

      const row = html.find(`.account-item[data-account-id="${accountId}"]`);
      const currency = row.find(".deposit-currency").val() as string;
      const amountStr = row.find(".deposit-amount").val() as string;
      const amount = parseInt(amountStr, 10);

      if (!currency || isNaN(amount) || amount <= 0) {
        notifications?.warn("Enter valid currency and amount");
        return;
      }

      const actor = gameObj?.actors?.get(this.actorId);
      if (!actor) {
        notifications?.error("Actor not found");
        return;
      }

      // Check wallet has enough
      const walletAmount = (actor.system?.currency?.[currency] as number) ?? 0;
      if (walletAmount < amount) {
        notifications?.error(`Not enough ${currency} in wallet! (Have: ${walletAmount})`);
        return;
      }

      // Get the account to find its bank's economy currency
      const accounts = getAccountsByOwner(this.actorId);
      const account = accounts.find((a) => a.id === accountId);
      if (!account) return;

      const bank = getBanks().find((b) => b.id === account.bankId);
      if (!bank) return;

      const economy = getEconomy(bank.economyId);
      if (!economy) return;

      // Find matching currency in economy (by abbrev)
      const economyCurrency = economy.currencies.find((c) => c.abbrev === currency);
      if (!economyCurrency) {
        notifications?.error(`This bank doesn't accept ${currency}`);
        return;
      }

      // Remove from wallet
      void removeCurrencyFromActor(actor, currency, amount).then((removed) => {
        if (!removed) {
          notifications?.error("Failed to remove from wallet");
          return;
        }

        // Add to bank account
        void updateAccountBalance(
          accountId,
          economyCurrency.id,
          amount,
          "deposit",
          `Deposited ${amount} ${currency}`
        ).then((success) => {
          if (success) {
            notifications?.info(`Deposited ${amount} ${currency}`);
            this.render();
          } else {
            // Rollback wallet
            void addCurrencyToActor(actor, currency, amount);
            notifications?.error("Failed to deposit");
          }
        });
      });
    });

    // Withdraw money (bank → wallet)
    html.find(".withdraw-btn").on("click", (event) => {
      event.preventDefault();
      const accountId = event.currentTarget.dataset.accountId;
      if (!accountId) return;

      const row = html.find(`.account-item[data-account-id="${accountId}"]`);
      const currency = row.find(".withdraw-currency").val() as string;
      const amountStr = row.find(".withdraw-amount").val() as string;
      const amount = parseInt(amountStr, 10);

      if (!currency || isNaN(amount) || amount <= 0) {
        notifications?.warn("Enter valid currency and amount");
        return;
      }

      const actor = gameObj?.actors?.get(this.actorId);
      if (!actor) {
        notifications?.error("Actor not found");
        return;
      }

      // Get account and check balance
      const accounts = getAccountsByOwner(this.actorId);
      const account = accounts.find((a) => a.id === accountId);
      if (!account) return;

      const bank = getBanks().find((b) => b.id === account.bankId);
      if (!bank) return;

      const economy = getEconomy(bank.economyId);
      if (!economy) return;

      // Find matching currency in economy
      const economyCurrency = economy.currencies.find((c) => c.abbrev === currency);
      if (!economyCurrency) {
        notifications?.error(`This bank doesn't have ${currency}`);
        return;
      }

      const bankBalance = account.balances[economyCurrency.id] ?? 0;
      if (bankBalance < amount) {
        notifications?.error(`Not enough in bank! (Have: ${bankBalance})`);
        return;
      }

      // Remove from bank account
      void updateAccountBalance(
        accountId,
        economyCurrency.id,
        -amount,
        "withdrawal",
        `Withdrew ${amount} ${currency}`
      ).then((success) => {
        if (!success) {
          notifications?.error("Failed to withdraw");
          return;
        }

        // Add to wallet
        void addCurrencyToActor(actor, currency, amount).then((added) => {
          if (added) {
            notifications?.info(`Withdrew ${amount} ${currency}`);
            this.render();
          } else {
            // Rollback bank
            void updateAccountBalance(accountId, economyCurrency.id, amount, "deposit", "Rollback");
            notifications?.error("Failed to add to wallet");
          }
        });
      });
    });

    // Refresh
    html.find(".refresh-btn").on("click", () => {
      this.render();
    });

    log("BankDialog listeners activated");
  }
}
