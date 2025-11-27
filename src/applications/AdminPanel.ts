/**
 * AdminPanel - Full GM interface for managing economies, currencies, banks, and NPCs
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
  type Economy,
  type Bank,
  type Currency,
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
  banks: Bank[];
  availableActors: Array<{ id: string; name: string; type: string }>;
  activeTab: string;
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
      width: 700,
      height: 600,
      classes: ["fax-bank", "admin-panel"],
      resizable: true,
      tabs: [{ navSelector: ".tabs", contentSelector: ".content", initial: "economies" }],
    }) as ApplicationOptions;
  }

  override getData(): AdminPanelData {
    const gameObj = game as GameWithActors | undefined;

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

    return {
      gameSystem: getGameSystem(),
      isSupported: isSystemSupported(),
      economies: getEconomies(),
      banks: getBanks(),
      availableActors,
      activeTab: this.activeTab,
    };
  }

  override activateListeners(html: JQuery): void {
    super.activateListeners(html);

    const notifications = ui.notifications as NotificationsType | undefined;

    // Tab switching
    html.find(".tab-btn").on("click", (event) => {
      const tab = (event.currentTarget as HTMLElement).dataset.tab;
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
      const economyId = (event.currentTarget as HTMLElement).dataset.economyId;
      if (!economyId) return;

      // Confirm deletion
      const economy = getEconomies().find((e) => e.id === economyId);
      if (!economy) return;

      if (confirm(`Delete economy "${economy.name}"? This will also delete all banks and accounts!`)) {
        void deleteEconomy(economyId).then(() => {
          notifications?.info(`Deleted economy: ${economy.name}`);
          this.render();
        });
      }
    });

    // Add currency to economy
    html.find(".add-currency-btn").on("click", (event) => {
      const economyId = (event.currentTarget as HTMLElement).dataset.economyId;
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

      void addCurrency(economyId, name.trim(), abbrev.trim(), symbol?.trim() ?? abbrev.trim(), baseValue).then(
        (currency) => {
          if (currency) {
            notifications?.info(`Added currency: ${name}`);
            this.render();
          } else {
            notifications?.error("Failed to add currency");
          }
        }
      );
    });

    // Remove currency
    html.find(".remove-currency-btn").on("click", (event) => {
      const btn = event.currentTarget as HTMLElement;
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
      const bankId = (event.currentTarget as HTMLElement).dataset.bankId;
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
      const bankId = (event.currentTarget as HTMLElement).dataset.bankId;
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

    // Refresh
    html.find(".refresh-btn").on("click", () => {
      this.render();
    });

    log("AdminPanel listeners activated");
  }
}
