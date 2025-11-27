/**
 * AdminPanel - Full GM interface for managing economies, currencies, banks, and accounts
 */

import { MODULE_ID } from "../constants";
import { log } from "../utils/logger";
import {
  getEconomies,
  createEconomy,
  deleteEconomy,
  getBanks,
  createBank,
  deleteBank,
  updateBank,
  addCurrency,
  removeCurrency,
  getAccountsByBank,
  getTransactions,
  type Economy,
  type Bank,
  type BankAccount,
} from "../data/EconomyManager";
import { getGameSystem, isSystemSupported } from "../systems/SystemCurrency";

type ActorType = {
  id?: string;
  name?: string;
  img?: string;
  type?: string;
};

type GameWithActors = {
  actors?: {
    contents?: ActorType[];
    get: (id: string) => ActorType | undefined;
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

interface AdminPanelData {
  gameSystem: string;
  isSupported: boolean;
  economies: Economy[];
  banks: BanksWithEconomy[];
  accounts: AccountsWithBank[];
  availableActors: Array<{ id: string; name: string; type: string }>;
  activeTab: string;
  showEconomies: boolean;
  showBanks: boolean;
  showAccounts: boolean;
  showHelp: boolean;
}

interface BanksWithEconomy extends Bank {
  economyName: string;
  npcName?: string;
}

interface AccountsWithBank extends BankAccount {
  bankName: string;
  economyName: string;
  balanceDisplay: string;
  transactionCount: number;
}

/**
 * Admin Panel for GMs to manage the full economy system
 */
export class AdminPanel extends Application {
  private activeTab = "economies";

  static override get defaultOptions(): ApplicationOptions {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "fax-bank-admin",
      title: "🏦 FAX-BANK Administration",
      template: `modules/${MODULE_ID}/templates/admin-panel.hbs`,
      width: 750,
      height: 650,
      classes: ["fax-bank", "admin-panel"],
      resizable: true,
    }) as ApplicationOptions;
  }

  override getData(): AdminPanelData {
    const gameObj = game as GameWithActors | undefined;
    const economies = getEconomies();
    const banks = getBanks();

    // Get all actors for NPC assignment
    const availableActors: Array<{ id: string; name: string; type: string }> = [];
    if (gameObj?.actors?.contents) {
      for (const actor of gameObj.actors.contents) {
        if (actor.id && actor.name) {
          availableActors.push({
            id: actor.id,
            name: actor.name,
            type: actor.type ?? "unknown",
          });
        }
      }
    }

    // Enrich banks with economy names and NPC names
    const banksWithEconomy: BanksWithEconomy[] = banks.map((bank) => {
      const economy = economies.find((e) => e.id === bank.economyId);
      const npc = bank.npcActorId
        ? availableActors.find((a) => a.id === bank.npcActorId)
        : undefined;
      return {
        ...bank,
        economyName: economy?.name ?? "Unknown",
        npcName: npc?.name,
      };
    });

    // Get all accounts with bank info
    const accountsWithBank: AccountsWithBank[] = [];
    for (const bank of banks) {
      const economy = economies.find((e) => e.id === bank.economyId);
      const accounts = getAccountsByBank(bank.id);
      for (const account of accounts) {
        const transactions = getTransactions(account.id);
        const balanceParts: string[] = [];
        for (const [currencyId, amount] of Object.entries(account.balances)) {
          if (amount > 0) {
            const currency = economy?.currencies.find((c) => c.id === currencyId);
            balanceParts.push(`${amount} ${currency?.abbrev ?? currencyId}`);
          }
        }
        accountsWithBank.push({
          ...account,
          bankName: bank.name,
          economyName: economy?.name ?? "Unknown",
          balanceDisplay: balanceParts.length > 0 ? balanceParts.join(", ") : "Empty",
          transactionCount: transactions.length,
        });
      }
    }

    return {
      gameSystem: getGameSystem(),
      isSupported: isSystemSupported(),
      economies,
      banks: banksWithEconomy,
      accounts: accountsWithBank,
      availableActors,
      activeTab: this.activeTab,
      showEconomies: this.activeTab === "economies",
      showBanks: this.activeTab === "banks",
      showAccounts: this.activeTab === "accounts",
      showHelp: this.activeTab === "help",
    };
  }

  override activateListeners(html: JQuery): void {
    super.activateListeners(html);

    const notifications = ui.notifications as NotificationsType | undefined;
    const gameObj = game as GameWithActors | undefined;

    // Set selected NPC in dropdowns based on data attribute
    html.find(".bank-item").each((_i, el) => {
      const npcActorId = el.dataset.npcActorId;
      if (npcActorId) {
        $(el).find(".bank-npc-select").val(npcActorId);
      }
    });

    // Tab switching
    html.find(".tab-btn").on("click", (event) => {
      const tab = event.currentTarget.dataset.tab;
      if (tab) {
        this.activeTab = tab;
        this.render();
      }
    });

    // ========== ECONOMY ACTIONS ==========

    // Create economy
    html.find("#create-economy-btn").on("click", () => {
      const name = html.find("#economy-name").val() as string;
      const description = html.find("#economy-description").val() as string;
      const baseCurrencyName = html.find("#base-currency-name").val() as string;
      const baseCurrencyAbbrev = html.find("#base-currency-abbrev").val() as string;
      const baseCurrencySymbol = html.find("#base-currency-symbol").val() as string;

      if (!name?.trim()) {
        notifications?.warn("Enter an economy name");
        return;
      }

      if (!baseCurrencyName?.trim() || !baseCurrencyAbbrev?.trim()) {
        notifications?.warn("Enter base currency details");
        return;
      }

      void createEconomy(name.trim(), description?.trim() ?? "", {
        name: baseCurrencyName.trim(),
        abbrev: baseCurrencyAbbrev.trim(),
        symbol: baseCurrencySymbol?.trim() ?? baseCurrencyAbbrev.trim(),
      }).then(() => {
        notifications?.info(`Created economy: ${name}`);
        this.render();
      });
    });

    // Delete economy
    html.find(".delete-economy-btn").on("click", (event) => {
      const economyId = event.currentTarget.dataset.economyId;
      if (!economyId) return;

      const economy = getEconomies().find((e) => e.id === economyId);
      if (!economy) return;

      if (
        confirm(`Delete economy "${economy.name}"? This will also delete all banks and accounts!`)
      ) {
        void deleteEconomy(economyId).then(() => {
          notifications?.info(`Deleted economy: ${economy.name}`);
          this.render();
        });
      }
    });

    // Add currency to economy
    html.find(".add-currency-btn").on("click", (event) => {
      const economyId = event.currentTarget.dataset.economyId;
      if (!economyId) return;

      const row = html.find(`.economy-item[data-economy-id="${economyId}"]`);
      const name = row.find(".new-currency-name").val() as string;
      const abbrev = row.find(".new-currency-abbrev").val() as string;
      const symbol = row.find(".new-currency-symbol").val() as string;
      const baseValue = parseFloat(row.find(".new-currency-value").val() as string);

      if (!name?.trim() || !abbrev?.trim() || isNaN(baseValue) || baseValue <= 0) {
        notifications?.warn("Enter valid currency details and exchange rate");
        return;
      }

      void addCurrency(
        economyId,
        name.trim(),
        abbrev.trim(),
        symbol?.trim() ?? abbrev.trim(),
        baseValue
      ).then((currency) => {
        if (currency) {
          notifications?.info(`Added currency: ${name}`);
          this.render();
        } else {
          notifications?.error("Failed to add currency");
        }
      });
    });

    // Remove currency
    html.find(".remove-currency-btn").on("click", (event) => {
      const btn = event.currentTarget;
      const economyId = btn.dataset.economyId;
      const currencyId = btn.dataset.currencyId;
      if (!economyId || !currencyId) return;

      void removeCurrency(economyId, currencyId).then((success) => {
        if (success) {
          notifications?.info("Currency removed");
          this.render();
        } else {
          notifications?.error("Cannot remove base currency");
        }
      });
    });

    // ========== BANK ACTIONS ==========

    // Create bank
    html.find("#create-bank-btn").on("click", () => {
      const name = html.find("#bank-name").val() as string;
      const economyId = html.find("#bank-economy").val() as string;
      const npcActorId = html.find("#bank-npc").val() as string;

      if (!name?.trim()) {
        notifications?.warn("Enter a bank name");
        return;
      }

      if (!economyId) {
        notifications?.warn("Select an economy for the bank");
        return;
      }

      void createBank(name.trim(), economyId, npcActorId || undefined).then((bank) => {
        if (bank) {
          notifications?.info(`Created bank: ${name}`);
          this.render();
        } else {
          notifications?.error("Failed to create bank");
        }
      });
    });

    // Delete bank
    html.find(".delete-bank-btn").on("click", (event) => {
      const bankId = event.currentTarget.dataset.bankId;
      if (!bankId) return;

      const bank = getBanks().find((b) => b.id === bankId);
      if (!bank) return;

      if (confirm(`Delete bank "${bank.name}"? This will delete all accounts!`)) {
        void deleteBank(bankId).then(() => {
          notifications?.info(`Deleted bank: ${bank.name}`);
          this.render();
        });
      }
    });

    // Assign NPC to bank
    html.find(".assign-npc-btn").on("click", (event) => {
      const bankId = event.currentTarget.dataset.bankId;
      if (!bankId) return;

      const row = html.find(`.bank-item[data-bank-id="${bankId}"]`);
      const npcActorId = row.find(".bank-npc-select").val() as string;

      void updateBank(bankId, { npcActorId: npcActorId || undefined }).then((success) => {
        if (success) {
          notifications?.info("Bank NPC updated");
          this.render();
        }
      });
    });

    // Open actor sheet for NPC
    html.find(".view-npc-btn").on("click", (event) => {
      const actorId = event.currentTarget.dataset.actorId;
      if (!actorId) return;

      const actor = gameObj?.actors?.get(actorId);
      if (actor) {
        // Open the actor sheet
        const actorDoc = actor as unknown as { sheet?: { render: (force: boolean) => void } };
        actorDoc.sheet?.render(true);
      }
    });

    // Refresh
    html.find(".refresh-btn").on("click", () => {
      this.render();
    });

    log("AdminPanel listeners activated");
  }
}
