/**
 * BankDialog - Player-facing interface for bank transactions
 */

import { MODULE_ID, MODULE_NAME } from "../constants";
import { log } from "../utils/logger";
import * as EconomyManager from "../data/EconomyManager";
import * as BankManager from "../data/BankManager";
import type { Account, Bank, Currency, Transaction } from "../types";

interface BankDialogData {
  actorId: string;
  actorName: string;
  accounts: Array<Account & { currency: Currency | undefined; bank: Bank | undefined }>;
  availableBanks: Array<Bank & { currencies: Currency[] }>;
  selectedAccount: (Account & { currency: Currency | undefined; bank: Bank | undefined }) | null;
  transactions: Transaction[];
}

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
      id: `${MODULE_ID}-bank-dialog`,
      title: `${MODULE_NAME} - Bank`,
      template: `modules/${MODULE_ID}/templates/bank-dialog.hbs`,
      classes: [MODULE_ID, "bank-dialog"],
      width: 500,
      height: 550,
      resizable: true,
    }) as ApplicationOptions;
  }

  override get title(): string {
    return `🏦 ${this.actorName}'s Bank`;
  }

  override getData(): BankDialogData {
    // Get accounts for this actor
    const rawAccounts = BankManager.getAccounts({ ownerId: this.actorId });
    const accounts = rawAccounts.map((account) => ({
      ...account,
      currency: EconomyManager.getCurrency(account.currencyId),
      bank: BankManager.getBank(account.bankId),
    }));

    // Get available banks for creating new accounts
    const banks = BankManager.getBanks();
    const availableBanks = banks.map((bank) => ({
      ...bank,
      currencies: EconomyManager.getCurrencies(bank.economyId),
    }));

    // Get selected account details
    let selectedAccount = null;
    let transactions: Transaction[] = [];
    if (this.selectedAccountId) {
      const account = accounts.find((a) => a.id === this.selectedAccountId);
      if (account) {
        selectedAccount = account;
        transactions = BankManager.getTransactions(this.selectedAccountId, 20);
      }
    }

    return {
      actorId: this.actorId,
      actorName: this.actorName,
      accounts,
      availableBanks,
      selectedAccount,
      transactions,
    };
  }

  override activateListeners(html: JQuery): void {
    super.activateListeners(html);

    // Account selection
    html.find('[data-action="select-account"]').on("click", (e) => {
      this.selectedAccountId = $(e.currentTarget).data("account-id") as string;
      this.render();
    });

    // Create account
    html.find('[data-action="create-account"]').on("click", () => this.handleCreateAccount());

    // Transactions
    html.find('[data-action="deposit"]').on("click", () => this.handleDeposit());
    html.find('[data-action="withdraw"]').on("click", () => this.handleWithdraw());
    html.find('[data-action="transfer"]').on("click", () => this.handleTransfer());

    log("Bank dialog listeners activated");
  }

  private async handleCreateAccount(): Promise<void> {
    const banks = BankManager.getBanks();
    if (banks.length === 0) {
      ui.notifications?.warn("No banks available. Ask your GM to create one.");
      return;
    }

    // Build bank options with currencies
    const bankOptions = banks
      .map((bank) => {
        const currencies = EconomyManager.getCurrencies(bank.economyId);
        return currencies.map((c) => `<option value="${bank.id}|${c.id}">${bank.name} - ${c.name} (${c.abbreviation})</option>`).join("");
      })
      .join("");

    const content = `
      <form>
        <div class="form-group">
          <label>Account Name</label>
          <input type="text" name="name" value="Main Account" required />
        </div>
        <div class="form-group">
          <label>Bank & Currency</label>
          <select name="bankCurrency" required>
            ${bankOptions}
          </select>
        </div>
      </form>
    `;

    const result = await Dialog.prompt({
      title: "Create Bank Account",
      content,
      label: "Create",
      callback: (html: JQuery) => ({
        name: html.find('[name="name"]').val() as string,
        bankCurrency: html.find('[name="bankCurrency"]').val() as string,
      }),
      rejectClose: false,
    });

    if (result && result.bankCurrency) {
      const [bankId, currencyId] = result.bankCurrency.split("|");
      const response = await BankManager.createAccount(
        bankId,
        currencyId,
        this.actorId,
        this.actorName,
        result.name
      );

      if (response.success) {
        ui.notifications?.info("Account created!");
        this.selectedAccountId = response.data?.id ?? null;
        this.render();
      } else {
        ui.notifications?.error(response.error ?? "Failed to create account");
      }
    }
  }

  private async handleDeposit(): Promise<void> {
    if (!this.selectedAccountId) return;

    const account = BankManager.getAccount(this.selectedAccountId);
    if (!account) return;

    const currency = EconomyManager.getCurrency(account.currencyId);

    const content = `
      <form>
        <div class="form-group">
          <label>Amount (${currency?.abbreviation ?? ""})</label>
          <input type="number" name="amount" min="0.01" step="0.01" required />
        </div>
        <div class="form-group">
          <label>Description (optional)</label>
          <input type="text" name="description" placeholder="Deposit" />
        </div>
      </form>
    `;

    const result = await Dialog.prompt({
      title: "Deposit Funds",
      content,
      label: "Deposit",
      callback: (html: JQuery) => ({
        amount: parseFloat(html.find('[name="amount"]').val() as string),
        description: (html.find('[name="description"]').val() as string) || "Deposit",
      }),
      rejectClose: false,
    });

    if (result && result.amount > 0) {
      const response = await BankManager.deposit(
        this.selectedAccountId,
        result.amount,
        result.description,
        this.actorId
      );

      if (response.success) {
        ui.notifications?.info(`Deposited ${result.amount} ${currency?.abbreviation ?? ""}`);
        this.render();
      } else {
        ui.notifications?.error(response.error ?? "Deposit failed");
      }
    }
  }

  private async handleWithdraw(): Promise<void> {
    if (!this.selectedAccountId) return;

    const account = BankManager.getAccount(this.selectedAccountId);
    if (!account) return;

    const currency = EconomyManager.getCurrency(account.currencyId);

    const content = `
      <form>
        <p>Available: <strong>${account.balance} ${currency?.abbreviation ?? ""}</strong></p>
        <div class="form-group">
          <label>Amount (${currency?.abbreviation ?? ""})</label>
          <input type="number" name="amount" min="0.01" max="${account.balance}" step="0.01" required />
        </div>
        <div class="form-group">
          <label>Description (optional)</label>
          <input type="text" name="description" placeholder="Withdrawal" />
        </div>
      </form>
    `;

    const result = await Dialog.prompt({
      title: "Withdraw Funds",
      content,
      label: "Withdraw",
      callback: (html: JQuery) => ({
        amount: parseFloat(html.find('[name="amount"]').val() as string),
        description: (html.find('[name="description"]').val() as string) || "Withdrawal",
      }),
      rejectClose: false,
    });

    if (result && result.amount > 0) {
      const response = await BankManager.withdraw(
        this.selectedAccountId,
        result.amount,
        result.description,
        this.actorId
      );

      if (response.success) {
        ui.notifications?.info(`Withdrew ${result.amount} ${currency?.abbreviation ?? ""}`);
        this.render();
      } else {
        ui.notifications?.error(response.error ?? "Withdrawal failed");
      }
    }
  }

  private async handleTransfer(): Promise<void> {
    if (!this.selectedAccountId) return;

    const account = BankManager.getAccount(this.selectedAccountId);
    if (!account) return;

    const currency = EconomyManager.getCurrency(account.currencyId);

    // Get all other accounts as transfer targets
    const allAccounts = BankManager.getAccounts();
    const otherAccounts = allAccounts.filter((a) => a.id !== this.selectedAccountId && a.isActive);

    if (otherAccounts.length === 0) {
      ui.notifications?.warn("No other accounts available for transfer.");
      return;
    }

    const accountOptions = otherAccounts
      .map((a) => {
        const c = EconomyManager.getCurrency(a.currencyId);
        return `<option value="${a.id}">${a.ownerName} - ${a.name} (${c?.abbreviation ?? ""})</option>`;
      })
      .join("");

    const content = `
      <form>
        <p>From: <strong>${account.name}</strong> (${account.balance} ${currency?.abbreviation ?? ""})</p>
        <div class="form-group">
          <label>To Account</label>
          <select name="toAccountId" required>
            ${accountOptions}
          </select>
        </div>
        <div class="form-group">
          <label>Amount (${currency?.abbreviation ?? ""})</label>
          <input type="number" name="amount" min="0.01" max="${account.balance}" step="0.01" required />
        </div>
        <div class="form-group">
          <label>Description (optional)</label>
          <input type="text" name="description" placeholder="Transfer" />
        </div>
      </form>
    `;

    const result = await Dialog.prompt({
      title: "Transfer Funds",
      content,
      label: "Transfer",
      callback: (html: JQuery) => ({
        toAccountId: html.find('[name="toAccountId"]').val() as string,
        amount: parseFloat(html.find('[name="amount"]').val() as string),
        description: (html.find('[name="description"]').val() as string) || "Transfer",
      }),
      rejectClose: false,
    });

    if (result && result.amount > 0 && result.toAccountId) {
      const response = await BankManager.transfer(
        this.selectedAccountId,
        result.toAccountId,
        result.amount,
        result.description,
        this.actorId
      );

      if (response.success) {
        ui.notifications?.info(`Transferred ${result.amount} ${currency?.abbreviation ?? ""}`);
        this.render();
      } else {
        ui.notifications?.error(response.error ?? "Transfer failed");
      }
    }
  }
}

/**
 * Open bank dialog for an actor
 */
export const openBankDialog = (actorId: string, actorName: string): BankDialog => {
  const dialog = new BankDialog(actorId, actorName);
  dialog.render(true);
  return dialog;
};

