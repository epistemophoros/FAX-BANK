/**
 * AdminPanel - Central control panel for GMs to manage the banking system
 */

import { MODULE_ID, MODULE_NAME } from "../constants";
import { log } from "../utils/logger";
import * as EconomyManager from "../data/EconomyManager";
import * as BankManager from "../data/BankManager";
import { getDataStore } from "../data/DataStore";
import type { Economy, Currency, Bank, Account } from "../types";

interface AdminPanelData {
  economies: Economy[];
  currencies: Record<string, Currency[]>;
  banks: Record<string, Bank[]>;
  accounts: Account[];
  recentTransactions: ReturnType<typeof BankManager.getAllTransactions>;
  stats: {
    totalEconomies: number;
    totalBanks: number;
    totalAccounts: number;
    totalTransactions: number;
  };
}

export class AdminPanel extends Application {

  static override get defaultOptions(): ApplicationOptions {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: `${MODULE_ID}-admin`,
      title: `${MODULE_NAME} - Admin Panel`,
      template: `modules/${MODULE_ID}/templates/admin-panel.hbs`,
      classes: [MODULE_ID, "admin-panel"],
      width: 800,
      height: 600,
      resizable: true,
      tabs: [{ navSelector: ".tabs", contentSelector: ".content", initial: "economies" }],
    }) as ApplicationOptions;
  }

  override getData(): AdminPanelData {
    const store = getDataStore();
    const economies = EconomyManager.getEconomies();

    // Group currencies by economy
    const currencies: Record<string, Currency[]> = {};
    for (const economy of economies) {
      currencies[economy.id] = EconomyManager.getCurrencies(economy.id);
    }

    // Group banks by economy
    const banks: Record<string, Bank[]> = {};
    for (const economy of economies) {
      banks[economy.id] = BankManager.getBanks(economy.id);
    }

    return {
      economies,
      currencies,
      banks,
      accounts: BankManager.getAccounts(),
      recentTransactions: BankManager.getAllTransactions(20),
      stats: {
        totalEconomies: economies.length,
        totalBanks: Object.keys(store.banks).length,
        totalAccounts: Object.keys(store.accounts).length,
        totalTransactions: store.transactions.length,
      },
    };
  }

  override activateListeners(html: JQuery): void {
    super.activateListeners(html);

    // Economy actions
    html.find('[data-action="create-economy"]').on("click", () => this.handleCreateEconomy());
    html.find('[data-action="edit-economy"]').on("click", (e) => this.handleEditEconomy(e));
    html.find('[data-action="delete-economy"]').on("click", (e) => this.handleDeleteEconomy(e));
    html.find('[data-action="add-dnd5e"]').on("click", (e) => this.handleAddPresetCurrencies(e, "dnd5e"));
    html.find('[data-action="add-pathfinder"]').on("click", (e) => this.handleAddPresetCurrencies(e, "pathfinder"));

    // Currency actions
    html.find('[data-action="create-currency"]').on("click", (e) => this.handleCreateCurrency(e));
    html.find('[data-action="delete-currency"]').on("click", (e) => this.handleDeleteCurrency(e));

    // Bank actions
    html.find('[data-action="create-bank"]').on("click", (e) => this.handleCreateBank(e));
    html.find('[data-action="edit-bank"]').on("click", (e) => this.handleEditBank(e));
    html.find('[data-action="delete-bank"]').on("click", (e) => this.handleDeleteBank(e));

    // Account actions
    html.find('[data-action="view-account"]').on("click", (e) => this.handleViewAccount(e));
    html.find('[data-action="admin-deposit"]').on("click", (e) => this.handleAdminDeposit(e));
    html.find('[data-action="admin-withdraw"]').on("click", (e) => this.handleAdminWithdraw(e));

    log("Admin panel listeners activated");
  }

  private async handleCreateEconomy(): Promise<void> {
    const content = `
      <form>
        <div class="form-group">
          <label>Economy Name</label>
          <input type="text" name="name" placeholder="e.g., Kingdom of Eldoria" required />
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea name="description" placeholder="Description of this economy..."></textarea>
        </div>
        <div class="form-group">
          <label>Interest Rate (%)</label>
          <input type="number" name="interestRate" value="0" min="0" max="100" step="0.1" />
        </div>
        <div class="form-group">
          <label>Growth Rate (%)</label>
          <input type="number" name="growthRate" value="0" min="-100" max="100" step="0.1" />
        </div>
      </form>
    `;

    const result = await Dialog.prompt({
      title: "Create New Economy",
      content,
      label: "Create",
      callback: (html: JQuery) => ({
        name: html.find('[name="name"]').val() as string,
        description: html.find('[name="description"]').val() as string,
        interestRate: parseFloat(html.find('[name="interestRate"]').val() as string) || 0,
        growthRate: parseFloat(html.find('[name="growthRate"]').val() as string) || 0,
      }),
      rejectClose: false,
    });

    if (result && result.name) {
      const response = await EconomyManager.createEconomy(
        result.name,
        result.description,
        result.interestRate,
        result.growthRate
      );

      if (response.success) {
        ui.notifications?.info(`Economy "${result.name}" created!`);
        this.render();
      } else {
        ui.notifications?.error(response.error ?? "Failed to create economy");
      }
    }
  }

  private async handleEditEconomy(event: JQuery.ClickEvent): Promise<void> {
    const economyId = $(event.currentTarget).closest("[data-economy-id]").data("economy-id") as string;
    const economy = EconomyManager.getEconomy(economyId);
    if (!economy) return;

    const content = `
      <form>
        <div class="form-group">
          <label>Economy Name</label>
          <input type="text" name="name" value="${economy.name}" required />
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea name="description">${economy.description}</textarea>
        </div>
        <div class="form-group">
          <label>Interest Rate (%)</label>
          <input type="number" name="interestRate" value="${economy.interestRate}" min="0" max="100" step="0.1" />
        </div>
        <div class="form-group">
          <label>Growth Rate (%)</label>
          <input type="number" name="growthRate" value="${economy.growthRate}" min="-100" max="100" step="0.1" />
        </div>
      </form>
    `;

    const result = await Dialog.prompt({
      title: `Edit Economy: ${economy.name}`,
      content,
      label: "Save",
      callback: (html: JQuery) => ({
        name: html.find('[name="name"]').val() as string,
        description: html.find('[name="description"]').val() as string,
        interestRate: parseFloat(html.find('[name="interestRate"]').val() as string) || 0,
        growthRate: parseFloat(html.find('[name="growthRate"]').val() as string) || 0,
      }),
      rejectClose: false,
    });

    if (result) {
      await EconomyManager.updateEconomy(economyId, result);
      ui.notifications?.info("Economy updated!");
      this.render();
    }
  }

  private async handleDeleteEconomy(event: JQuery.ClickEvent): Promise<void> {
    const economyId = $(event.currentTarget).closest("[data-economy-id]").data("economy-id") as string;
    const economy = EconomyManager.getEconomy(economyId);
    if (!economy) return;

    const confirmed = await Dialog.confirm({
      title: "Delete Economy",
      content: `<p>Are you sure you want to delete "${economy.name}"?</p><p><strong>This will delete all banks, accounts, and transactions in this economy!</strong></p>`,
    });

    if (confirmed) {
      const response = await EconomyManager.deleteEconomy(economyId);
      if (response.success) {
        ui.notifications?.info("Economy deleted!");
        this.render();
      } else {
        ui.notifications?.error(response.error ?? "Failed to delete economy");
      }
    }
  }

  private async handleAddPresetCurrencies(event: JQuery.ClickEvent, preset: "dnd5e" | "pathfinder"): Promise<void> {
    const economyId = $(event.currentTarget).closest("[data-economy-id]").data("economy-id") as string;

    if (preset === "dnd5e") {
      await EconomyManager.addDnD5eCurrencies(economyId);
    } else {
      await EconomyManager.addPathfinderCurrencies(economyId);
    }

    ui.notifications?.info(`${preset === "dnd5e" ? "D&D 5e" : "Pathfinder"} currencies added!`);
    this.render();
  }

  private async handleCreateCurrency(event: JQuery.ClickEvent): Promise<void> {
    const economyId = $(event.currentTarget).closest("[data-economy-id]").data("economy-id") as string;

    const content = `
      <form>
        <div class="form-group">
          <label>Currency Name</label>
          <input type="text" name="name" placeholder="e.g., Gold" required />
        </div>
        <div class="form-group">
          <label>Abbreviation</label>
          <input type="text" name="abbreviation" placeholder="e.g., gp" maxlength="4" required />
        </div>
        <div class="form-group">
          <label>Symbol</label>
          <input type="text" name="symbol" placeholder="e.g., 🪙" maxlength="4" />
        </div>
        <div class="form-group">
          <label>Base Value (1 = base currency)</label>
          <input type="number" name="baseValue" value="1" min="0.001" step="0.001" />
        </div>
        <div class="form-group">
          <label>Color</label>
          <input type="color" name="color" value="#FFD700" />
        </div>
      </form>
    `;

    const result = await Dialog.prompt({
      title: "Create Currency",
      content,
      label: "Create",
      callback: (html: JQuery) => ({
        name: html.find('[name="name"]').val() as string,
        abbreviation: html.find('[name="abbreviation"]').val() as string,
        symbol: html.find('[name="symbol"]').val() as string || "🪙",
        baseValue: parseFloat(html.find('[name="baseValue"]').val() as string) || 1,
        color: html.find('[name="color"]').val() as string,
      }),
      rejectClose: false,
    });

    if (result && result.name) {
      await EconomyManager.createCurrency(
        economyId,
        result.name,
        result.abbreviation,
        result.symbol,
        result.baseValue,
        result.color
      );
      ui.notifications?.info(`Currency "${result.name}" created!`);
      this.render();
    }
  }

  private async handleDeleteCurrency(event: JQuery.ClickEvent): Promise<void> {
    const currencyId = $(event.currentTarget).data("currency-id") as string;
    const currency = EconomyManager.getCurrency(currencyId);
    if (!currency) return;

    const confirmed = await Dialog.confirm({
      title: "Delete Currency",
      content: `<p>Are you sure you want to delete "${currency.name}"?</p>`,
    });

    if (confirmed) {
      const response = await EconomyManager.deleteCurrency(currencyId);
      if (response.success) {
        ui.notifications?.info("Currency deleted!");
        this.render();
      } else {
        ui.notifications?.error(response.error ?? "Failed to delete currency");
      }
    }
  }

  private async handleCreateBank(event: JQuery.ClickEvent): Promise<void> {
    const economyId = $(event.currentTarget).closest("[data-economy-id]").data("economy-id") as string;

    const content = `
      <form>
        <div class="form-group">
          <label>Bank Name</label>
          <input type="text" name="name" placeholder="e.g., Royal Bank of Eldoria" required />
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea name="description" placeholder="Bank description..."></textarea>
        </div>
        <div class="form-group">
          <label>Interest Rate (%)</label>
          <input type="number" name="interestRate" value="0" min="0" max="100" step="0.1" />
        </div>
      </form>
    `;

    const result = await Dialog.prompt({
      title: "Create Bank",
      content,
      label: "Create",
      callback: (html: JQuery) => ({
        name: html.find('[name="name"]').val() as string,
        description: html.find('[name="description"]').val() as string,
        interestRate: parseFloat(html.find('[name="interestRate"]').val() as string) || 0,
      }),
      rejectClose: false,
    });

    if (result && result.name) {
      await BankManager.createBank(economyId, result.name, result.description, result.interestRate);
      ui.notifications?.info(`Bank "${result.name}" created!`);
      this.render();
    }
  }

  private async handleEditBank(event: JQuery.ClickEvent): Promise<void> {
    const bankId = $(event.currentTarget).closest("[data-bank-id]").data("bank-id") as string;
    const bank = BankManager.getBank(bankId);
    if (!bank) return;

    const content = `
      <form>
        <div class="form-group">
          <label>Bank Name</label>
          <input type="text" name="name" value="${bank.name}" required />
        </div>
        <div class="form-group">
          <label>Description</label>
          <textarea name="description">${bank.description}</textarea>
        </div>
        <div class="form-group">
          <label>Interest Rate (%)</label>
          <input type="number" name="interestRate" value="${bank.interestRate}" min="0" max="100" step="0.1" />
        </div>
      </form>
    `;

    const result = await Dialog.prompt({
      title: `Edit Bank: ${bank.name}`,
      content,
      label: "Save",
      callback: (html: JQuery) => ({
        name: html.find('[name="name"]').val() as string,
        description: html.find('[name="description"]').val() as string,
        interestRate: parseFloat(html.find('[name="interestRate"]').val() as string) || 0,
      }),
      rejectClose: false,
    });

    if (result) {
      await BankManager.updateBank(bankId, result);
      ui.notifications?.info("Bank updated!");
      this.render();
    }
  }

  private async handleDeleteBank(event: JQuery.ClickEvent): Promise<void> {
    const bankId = $(event.currentTarget).closest("[data-bank-id]").data("bank-id") as string;
    const bank = BankManager.getBank(bankId);
    if (!bank) return;

    const confirmed = await Dialog.confirm({
      title: "Delete Bank",
      content: `<p>Are you sure you want to delete "${bank.name}"?</p>`,
    });

    if (confirmed) {
      const response = await BankManager.deleteBank(bankId);
      if (response.success) {
        ui.notifications?.info("Bank deleted!");
        this.render();
      } else {
        ui.notifications?.error(response.error ?? "Failed to delete bank");
      }
    }
  }

  private handleViewAccount(event: JQuery.ClickEvent): void {
    const accountId = $(event.currentTarget).data("account-id") as string;
    // Open BankDialog for this account
    log(`View account: ${accountId}`);
    // TODO: Open BankDialog
  }

  private async handleAdminDeposit(event: JQuery.ClickEvent): Promise<void> {
    const accountId = $(event.currentTarget).data("account-id") as string;
    const account = BankManager.getAccount(accountId);
    if (!account) return;

    const currency = EconomyManager.getCurrency(account.currencyId);

    const content = `
      <form>
        <div class="form-group">
          <label>Amount (${currency?.abbreviation ?? ""})</label>
          <input type="number" name="amount" min="0.01" step="0.01" required />
        </div>
        <div class="form-group">
          <label>Description</label>
          <input type="text" name="description" value="Admin deposit" />
        </div>
      </form>
    `;

    const result = await Dialog.prompt({
      title: `Deposit to ${account.ownerName}'s ${account.name}`,
      content,
      label: "Deposit",
      callback: (html: JQuery) => ({
        amount: parseFloat(html.find('[name="amount"]').val() as string),
        description: html.find('[name="description"]').val() as string,
      }),
      rejectClose: false,
    });

    if (result && result.amount > 0) {
      const response = await BankManager.deposit(accountId, result.amount, result.description, "admin");
      if (response.success) {
        ui.notifications?.info(`Deposited ${result.amount} ${currency?.abbreviation ?? ""}`);
        this.render();
      } else {
        ui.notifications?.error(response.error ?? "Deposit failed");
      }
    }
  }

  private async handleAdminWithdraw(event: JQuery.ClickEvent): Promise<void> {
    const accountId = $(event.currentTarget).data("account-id") as string;
    const account = BankManager.getAccount(accountId);
    if (!account) return;

    const currency = EconomyManager.getCurrency(account.currencyId);

    const content = `
      <form>
        <p>Current balance: ${account.balance} ${currency?.abbreviation ?? ""}</p>
        <div class="form-group">
          <label>Amount (${currency?.abbreviation ?? ""})</label>
          <input type="number" name="amount" min="0.01" max="${account.balance}" step="0.01" required />
        </div>
        <div class="form-group">
          <label>Description</label>
          <input type="text" name="description" value="Admin withdrawal" />
        </div>
      </form>
    `;

    const result = await Dialog.prompt({
      title: `Withdraw from ${account.ownerName}'s ${account.name}`,
      content,
      label: "Withdraw",
      callback: (html: JQuery) => ({
        amount: parseFloat(html.find('[name="amount"]').val() as string),
        description: html.find('[name="description"]').val() as string,
      }),
      rejectClose: false,
    });

    if (result && result.amount > 0) {
      const response = await BankManager.withdraw(accountId, result.amount, result.description, "admin");
      if (response.success) {
        ui.notifications?.info(`Withdrew ${result.amount} ${currency?.abbreviation ?? ""}`);
        this.render();
      } else {
        ui.notifications?.error(response.error ?? "Withdrawal failed");
      }
    }
  }
}

