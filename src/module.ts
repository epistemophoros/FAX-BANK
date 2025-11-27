/**
 * FAX-BANK - Banking module for Foundry VTT
 */

import "./styles/module.css";
import { MODULE_ID, MODULE_NAME, TEMPLATES } from "./constants";
import { registerSettings } from "./settings";
import { log } from "./utils/logger";
import { AdminPanel } from "./applications/AdminPanel";
import { BankDialog } from "./applications/BankDialog";
import { initializeSocket } from "./systems/SocketManager";
import { isSystemSupported, getGameSystem } from "./systems/SystemCurrency";
import { registerEconomyStorage, getBankByNPC, getBanks } from "./data/EconomyManager";

// Types
type GameType = {
  modules?: Map<string, { api?: Record<string, unknown> }>;
  user?: {
    isGM?: boolean;
    character?: ActorType;
  };
  users?: {
    contents?: Array<{ character?: ActorType; name?: string }>;
  };
  actors?: {
    get: (id: string) => ActorType | undefined;
    contents?: ActorType[];
  };
};

type ActorType = {
  id?: string;
  name?: string;
  img?: string;
  type?: string;
  sheet?: { render: (force: boolean) => void };
};

type NotificationsType = {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
};

// Store original method
let originalOnClickLeft2: ((event: unknown) => unknown) | null = null;

// Track open dialogs
const bankDialogs: Map<string, BankDialog> = new Map();
let adminPanel: AdminPanel | null = null;

/**
 * Open Bank Dialog for an actor
 */
const openBankForActor = (actor: ActorType): void => {
  if (!actor.id || !actor.name) {
    log("Cannot open bank - invalid actor");
    return;
  }

  const existing = bankDialogs.get(actor.id);
  if (existing) {
    existing.render(true);
    return;
  }

  const dialog = new BankDialog(actor.id, actor.name);
  bankDialogs.set(actor.id, dialog);
  dialog.render(true);

  log(`Opened bank for ${actor.name}`);
};

/**
 * Open Admin Panel
 */
const openAdminPanel = (): void => {
  const gameObj = game as GameType | undefined;
  if (!gameObj?.user?.isGM) {
    const notifications = ui.notifications as NotificationsType | undefined;
    notifications?.warn("Only GMs can access the Admin Panel");
    return;
  }

  if (adminPanel) {
    adminPanel.render(true);
  } else {
    adminPanel = new AdminPanel();
    adminPanel.render(true);
  }
};

/**
 * Show GM bank dialog with player selection
 */
const showGMBankDialog = (bankName: string, npcActor: ActorType): void => {
  const gameObj = game as GameType | undefined;

  const playerCharacters: Array<{ id: string; name: string; playerName: string }> = [];

  if (gameObj?.users?.contents) {
    for (const user of gameObj.users.contents) {
      if (user.character?.id && user.character?.name) {
        playerCharacters.push({
          id: user.character.id,
          name: user.character.name,
          playerName: user.name ?? "Unknown",
        });
      }
    }
  }

  if (gameObj?.actors?.contents) {
    for (const actor of gameObj.actors.contents) {
      if (
        actor.id &&
        actor.name &&
        actor.type === "character" &&
        !playerCharacters.find((p) => p.id === actor.id)
      ) {
        playerCharacters.push({
          id: actor.id,
          name: actor.name,
          playerName: "(Unassigned)",
        });
      }
    }
  }

  const options = playerCharacters
    .map((p) => `<option value="${p.id}">${p.name} - ${p.playerName}</option>`)
    .join("");

  const content = `
    <div style="padding: 10px;">
      <p style="margin-bottom: 10px;">Open bank for which character?</p>
      <select id="fax-bank-character-select" style="width: 100%; padding: 8px;">
        <option value="">-- Select Character --</option>
        ${options}
      </select>
    </div>
  `;

  new Dialog({
    title: `🏦 ${bankName}`,
    content,
    buttons: {
      bank: {
        icon: '<i class="fas fa-university"></i>',
        label: "Open Bank",
        callback: (html: JQuery): void => {
          const actorId = html.find("#fax-bank-character-select").val() as string;
          if (!actorId) {
            const notifications = ui.notifications as NotificationsType | undefined;
            notifications?.warn("Select a character first");
            return;
          }
          const actor = gameObj?.actors?.get(actorId);
          if (actor) openBankForActor(actor);
        },
      },
      sheet: {
        icon: '<i class="fas fa-user"></i>',
        label: "Open NPC Sheet",
        callback: (): void => {
          npcActor.sheet?.render(true);
        },
      },
    },
    default: "bank",
  }).render(true);
};

/**
 * Handle Bank NPC interaction
 * Returns true if handled (is a bank NPC), false otherwise
 */
const handleBankNPC = (actorId: string): boolean => {
  const bank = getBankByNPC(actorId);
  if (!bank) return false;

  const gameObj = game as GameType | undefined;
  const notifications = ui.notifications as NotificationsType | undefined;
  const actor = gameObj?.actors?.get(actorId);

  if (!actor) return false;

  log(`Bank NPC interaction: ${bank.name}`);

  if (gameObj?.user?.isGM) {
    showGMBankDialog(bank.name, actor);
  } else {
    const playerCharacter = gameObj?.user?.character;
    if (!playerCharacter?.id) {
      notifications?.warn("You don't have a character assigned. Ask your GM.");
      return true;
    }
    notifications?.info(`Opening ${bank.name}...`);
    openBankForActor(playerCharacter);
  }

  return true;
};

/**
 * Module initialization - wrap Token click method
 */
Hooks.once("init", () => {
  log(`Initializing ${MODULE_NAME}`);
  registerSettings();
  registerEconomyStorage();

  loadTemplates(Object.values(TEMPLATES)).catch((err: unknown) => {
    log(`Failed to load templates: ${String(err)}`);
  });

  // Wrap Token._onClickLeft2 to intercept double-clicks on Bank NPCs
  // This runs before the actor sheet opens
  type TokenClass = {
    prototype: {
      _onClickLeft2: (event: unknown) => unknown;
      actor?: ActorType;
    };
  };

  const TokenCls = Token as unknown as TokenClass;

  if (TokenCls?.prototype?._onClickLeft2) {
    originalOnClickLeft2 = TokenCls.prototype._onClickLeft2;

    TokenCls.prototype._onClickLeft2 = function (event: unknown): unknown {
      // Check if this token's actor is a Bank NPC
      const actor = this.actor;
      if (actor?.id) {
        const handled = handleBankNPC(actor.id);
        if (handled) {
          log("Bank NPC click intercepted - preventing actor sheet");
          return; // Don't open actor sheet
        }
      }

      // Not a bank NPC - call original method
      if (originalOnClickLeft2) {
        return originalOnClickLeft2.call(this, event);
      }
    };

    log("Token._onClickLeft2 wrapped successfully");
  } else {
    log("WARNING: Could not wrap Token._onClickLeft2");
  }

  log("Init complete");
});

/**
 * Module ready
 */
Hooks.once("ready", () => {
  log(`${MODULE_NAME} ready`);

  const system = getGameSystem();
  const supported = isSystemSupported();
  log(`Game system: ${system}, Supported: ${supported}`);

  if (!supported) {
    const notifications = ui.notifications as NotificationsType | undefined;
    notifications?.warn(`FAX-BANK: System "${system}" has limited support.`);
  }

  initializeSocket();

  // Expose API
  const gameObj = game as GameType | undefined;
  const moduleData = gameObj?.modules?.get(MODULE_ID);
  if (moduleData) {
    moduleData.api = {
      openAdmin: openAdminPanel,
      openBank: (actorId: string): void => {
        const actor = gameObj?.actors?.get(actorId);
        if (actor) openBankForActor(actor);
      },
    };
  }

  // @ts-expect-error - Window access
  window.FAXBANK = {
    openAdmin: openAdminPanel,
    openBank: (actorId: string): void => {
      const actor = (game as GameType | undefined)?.actors?.get(actorId);
      if (actor) openBankForActor(actor);
      // eslint-disable-next-line no-console
      else console.log("Usage: FAXBANK.openBank('actorId')");
    },
    listBanks: (): void => {
      // eslint-disable-next-line no-console
      console.table(getBanks().map((b) => ({ name: b.name, id: b.id, npcId: b.npcActorId })));
    },
  };

  log("API ready");
});

/**
 * Scene controls - Admin button for GM
 */
Hooks.on(
  "getSceneControlButtons",
  (
    controls: Array<{
      name: string;
      tools?: Array<{
        name: string;
        title: string;
        icon: string;
        button: boolean;
        onClick: () => void;
      }>;
    }>
  ) => {
    const gameObj = game as GameType | undefined;
    if (!gameObj?.user?.isGM) return;

    const tokenControls = controls.find((c) => c.name === "token");
    if (!tokenControls?.tools) return;

    tokenControls.tools.push({
      name: "fax-bank-admin",
      title: "FAX-BANK Admin",
      icon: "fas fa-university",
      button: true,
      onClick: openAdminPanel,
    });
  }
);

/**
 * Chat commands
 */
Hooks.on(
  "chatMessage",
  (_chatLog: unknown, message: string, _chatData: unknown): boolean | void => {
    const trimmed = message.trim().toLowerCase();

    if (trimmed === "/bank" || trimmed === "/bank help") {
      const gameObj = game as GameType | undefined;

      const helpText = `
      <div class="fax-bank-help">
        <h3>🏦 FAX-BANK</h3>
        <p><strong>/bank open</strong> - Open your bank</p>
        <p><strong>Double-click</strong> a Bank NPC token to access bank</p>
        ${gameObj?.user?.isGM ? "<p><strong>GM:</strong> Token Controls → Bank icon</p>" : ""}
      </div>
    `;

      type ChatMessageImpl = { create: (data: object) => Promise<unknown> };
      const ChatMsg = ChatMessage as unknown as { implementation?: ChatMessageImpl };
      if (ChatMsg.implementation?.create) {
        void ChatMsg.implementation.create({ content: helpText });
      }
      return false;
    }

    if (trimmed === "/bank open") {
      const gameObj = game as GameType | undefined;
      const playerCharacter = gameObj?.user?.character;

      if (playerCharacter?.id) {
        openBankForActor(playerCharacter);
      } else {
        (ui.notifications as NotificationsType | undefined)?.warn("No character assigned");
      }
      return false;
    }
  }
);

log("Module loaded");
