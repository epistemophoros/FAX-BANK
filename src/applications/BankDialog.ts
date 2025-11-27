/**
 * BankDialog - Player interface for banking with REAL character sheet currency
 */

import { MODULE_ID } from "../constants";
import { log } from "../utils/logger";
import {
  getActorCurrency,
  formatAllCurrency,
  getAvailableCurrencies,
  actorHasCurrency,
  addCurrencyToActor,
  removeCurrencyFromActor,
  formatCurrency,
  getGameSystem,
  isSystemSupported,
  CURRENCY_NAMES,
} from "../systems/SystemCurrency";
import { requestTransfer } from "../systems/SocketManager";

type ActorType = {
  id?: string;
  name?: string;
  img?: string;
  isOwner?: boolean;
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

interface BankDialogData {
  actorId: string;
  actorName: string;
  actorImg: string;
  currency: Record<string, number>;
  currencyDisplay: string;
  currencies: Array<{ key: string; name: string; amount: number }>;
  gameSystem: string;
  isSupported: boolean;
  isGM: boolean;
  otherActors: Array<{ id: string; name: string }>;
}

/**
 * Bank Dialog for players to manage their character's money
 */
export class BankDialog extends Application {
  private actorId: string;
  private actorName: string;

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
      width: 450,
      height: "auto" as const,
      classes: ["fax-bank", "bank-dialog"],
      resizable: true,
    }) as ApplicationOptions;
  }

  override get title(): string {
    return `🏦 ${this.actorName}'s Wallet`;
  }

  override getData(): BankDialogData {
    const gameObj = game as GameWithActors | undefined;
    const actor = gameObj?.actors?.get(this.actorId);

    const currency = actor ? getActorCurrency(actor) : {};
    const currencies = getAvailableCurrencies().map((key) => ({
      key,
      name: CURRENCY_NAMES[key] ?? key,
      amount: (currency[key as keyof typeof currency] as number) ?? 0,
    }));

    // Get other actors for transfer (excluding self)
    const otherActors: Array<{ id: string; name: string }> = [];
    if (gameObj?.actors?.contents) {
      for (const a of gameObj.actors.contents) {
        if (a.id && a.id !== this.actorId && a.name) {
          otherActors.push({ id: a.id, name: a.name });
        }
      }
    }

    return {
      actorId: this.actorId,
      actorName: this.actorName,
      actorImg: actor?.img ?? "icons/svg/mystery-man.svg",
      currency: currency as Record<string, number>,
      currencyDisplay: formatAllCurrency(currency),
      currencies,
      gameSystem: getGameSystem(),
      isSupported: isSystemSupported(),
      isGM: gameObj?.user?.isGM ?? false,
      otherActors,
    };
  }

  override activateListeners(html: JQuery): void {
    super.activateListeners(html);

    const notifications = ui.notifications as NotificationsType | undefined;
    const gameObj = game as GameWithActors | undefined;

    // Add currency button
    html.find(".add-currency-btn").on("click", (event) => {
      event.preventDefault();
      const currency = html.find("#add-currency-type").val() as string;
      const amountStr = html.find("#add-currency-amount").val() as string;
      const amount = parseInt(amountStr, 10);

      if (!currency || isNaN(amount) || amount <= 0) {
        notifications?.warn("Enter a valid currency and amount");
        return;
      }

      // Only GM can add currency (prevents cheating)
      if (!gameObj?.user?.isGM) {
        notifications?.error("Only the GM can add currency");
        return;
      }

      const actor = gameObj.actors?.get(this.actorId);
      if (!actor) {
        notifications?.error("Actor not found");
        return;
      }

      void addCurrencyToActor(actor, currency, amount).then((success) => {
        if (success) {
          notifications?.info(`Added ${formatCurrency(amount, currency)}`);
          this.render();
        } else {
          notifications?.error("Failed to add currency");
        }
      });
    });

    // Remove currency button
    html.find(".remove-currency-btn").on("click", (event) => {
      event.preventDefault();
      const currency = html.find("#remove-currency-type").val() as string;
      const amountStr = html.find("#remove-currency-amount").val() as string;
      const amount = parseInt(amountStr, 10);

      if (!currency || isNaN(amount) || amount <= 0) {
        notifications?.warn("Enter a valid currency and amount");
        return;
      }

      const actor = gameObj?.actors?.get(this.actorId);
      if (!actor) {
        notifications?.error("Actor not found");
        return;
      }

      // Check if actor has enough
      if (!actorHasCurrency(actor, currency, amount)) {
        notifications?.error(`Not enough ${currency}!`);
        return;
      }

      void removeCurrencyFromActor(actor, currency, amount).then((success) => {
        if (success) {
          notifications?.info(`Removed ${formatCurrency(amount, currency)}`);
          this.render();
        } else {
          notifications?.error("Failed to remove currency");
        }
      });
    });

    // Transfer button
    html.find(".transfer-btn").on("click", (event) => {
      event.preventDefault();
      const targetActorId = html.find("#transfer-target").val() as string;
      const currency = html.find("#transfer-currency-type").val() as string;
      const amountStr = html.find("#transfer-amount").val() as string;
      const amount = parseInt(amountStr, 10);

      if (!targetActorId) {
        notifications?.warn("Select a recipient");
        return;
      }

      if (!currency || isNaN(amount) || amount <= 0) {
        notifications?.warn("Enter a valid currency and amount");
        return;
      }

      const actor = gameObj?.actors?.get(this.actorId);
      if (!actor) {
        notifications?.error("Actor not found");
        return;
      }

      // Check if actor has enough
      if (!actorHasCurrency(actor, currency, amount)) {
        notifications?.error(`Not enough ${currency}!`);
        return;
      }

      // Request transfer via socket (GM will process)
      requestTransfer(this.actorId, targetActorId, currency, amount);
      notifications?.info(`Transfer requested: ${formatCurrency(amount, currency)}`);

      // Clear form
      html.find("#transfer-amount").val("");
    });

    // Refresh button
    html.find(".refresh-btn").on("click", () => {
      this.render();
    });

    log("BankDialog listeners activated");
  }
}
