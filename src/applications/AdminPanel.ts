/**
 * AdminPanel - GM interface for managing banks and Bank NPCs
 */

import { MODULE_ID } from "../constants";
import { log } from "../utils/logger";
import {
  getGameSystem,
  isSystemSupported,
  isActorBank,
  setActorAsBank,
  removeActorBankStatus,
  getActorBankData,
} from "../systems/SystemCurrency";

type ActorType = {
  id?: string;
  name?: string;
  img?: string;
  type?: string;
  getFlag?: (module: string, key: string) => unknown;
  setFlag?: (module: string, key: string, value: unknown) => Promise<unknown>;
  unsetFlag?: (module: string, key: string) => Promise<unknown>;
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

interface BankNPCData {
  actorId: string;
  actorName: string;
  actorImg: string;
  bankId: string;
  bankName: string;
}

interface AdminPanelData {
  gameSystem: string;
  isSupported: boolean;
  bankNPCs: BankNPCData[];
  availableActors: Array<{ id: string; name: string; img: string; type: string }>;
}

/**
 * Admin Panel for GMs to manage bank NPCs
 */
export class AdminPanel extends Application {
  static override get defaultOptions(): ApplicationOptions {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "fax-bank-admin",
      title: "🏦 FAX-BANK Admin",
      template: `modules/${MODULE_ID}/templates/admin-panel.hbs`,
      width: 550,
      height: 500,
      classes: ["fax-bank", "admin-panel"],
      resizable: true,
    }) as ApplicationOptions;
  }

  override getData(): AdminPanelData {
    const gameObj = game as GameWithActors | undefined;

    // Find all actors flagged as banks
    const bankNPCs: BankNPCData[] = [];
    const availableActors: Array<{ id: string; name: string; img: string; type: string }> = [];

    if (gameObj?.actors?.contents) {
      for (const actor of gameObj.actors.contents) {
        if (!actor.id || !actor.name) continue;

        if (isActorBank(actor)) {
          const bankData = getActorBankData(actor);
          bankNPCs.push({
            actorId: actor.id,
            actorName: actor.name,
            actorImg: actor.img ?? "icons/svg/mystery-man.svg",
            bankId: bankData?.bankId ?? actor.id,
            bankName: bankData?.bankName ?? actor.name,
          });
        } else {
          // Available to be set as bank (NPCs only typically)
          availableActors.push({
            id: actor.id,
            name: actor.name,
            img: actor.img ?? "icons/svg/mystery-man.svg",
            type: actor.type ?? "unknown",
          });
        }
      }
    }

    return {
      gameSystem: getGameSystem(),
      isSupported: isSystemSupported(),
      bankNPCs,
      availableActors,
    };
  }

  override activateListeners(html: JQuery): void {
    super.activateListeners(html);

    const notifications = ui.notifications as NotificationsType | undefined;
    const gameObj = game as GameWithActors | undefined;

    // Create Bank NPC button
    html.find(".create-bank-btn").on("click", (event) => {
      event.preventDefault();
      const actorId = html.find("#bank-actor-select").val() as string;
      const bankName = html.find("#bank-name-input").val() as string;

      if (!actorId) {
        notifications?.warn("Select an actor to make a bank");
        return;
      }

      if (!bankName || bankName.trim() === "") {
        notifications?.warn("Enter a bank name");
        return;
      }

      const actor = gameObj?.actors?.get(actorId);
      if (!actor) {
        notifications?.error("Actor not found");
        return;
      }

      void setActorAsBank(actor, actorId, bankName.trim()).then((success) => {
        if (success) {
          notifications?.info(`${actor.name ?? "Actor"} is now a bank: ${bankName}`);
          this.render();
        } else {
          notifications?.error("Failed to create bank");
        }
      });
    });

    // Remove Bank NPC buttons
    html.find(".remove-bank-btn").on("click", (event) => {
      event.preventDefault();
      const actorId = event.currentTarget.dataset.actorId;

      if (!actorId) return;

      const actor = gameObj?.actors?.get(actorId);
      if (!actor) {
        notifications?.error("Actor not found");
        return;
      }

      void removeActorBankStatus(actor).then((success) => {
        if (success) {
          notifications?.info(`Removed bank status from ${actor.name ?? "actor"}`);
          this.render();
        } else {
          notifications?.error("Failed to remove bank status");
        }
      });
    });

    // Refresh button
    html.find(".refresh-btn").on("click", () => {
      this.render();
    });

    log("AdminPanel listeners activated");
  }
}
