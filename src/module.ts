/**
 * FAX-BANK - Banking module for Foundry VTT
 * Integrates with dnd5e/pf2e character sheet currency
 */

import "./styles/module.css";
import { MODULE_ID, MODULE_NAME, TEMPLATES } from "./constants";
import { registerSettings, getSetting } from "./settings";
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

type TokenObjectType = {
  id?: string;
  actor?: ActorType;
  document?: { actorId?: string };
};

type NotificationsType = {
  info: (msg: string) => void;
  warn: (msg: string) => void;
  error: (msg: string) => void;
};

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

  // Check if dialog already open
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

  // Get all player characters
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

  // Also add any other characters
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
      <p style="margin-bottom: 10px;">Select a character to open bank for:</p>
      <select id="fax-bank-character-select" style="width: 100%; padding: 8px; margin-bottom: 15px;">
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
          if (actor) {
            openBankForActor(actor);
          }
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
 * Handle Bank NPC click - this is called when left-clicking a Bank NPC token
 */
const handleBankNPCClick = (actor: ActorType, bankName: string): void => {
  const gameObj = game as GameType | undefined;
  const notifications = ui.notifications as NotificationsType | undefined;

  if (gameObj?.user?.isGM) {
    // GM gets selection dialog
    showGMBankDialog(bankName, actor);
  } else {
    // Player gets their bank opened directly
    const playerCharacter = gameObj?.user?.character;
    if (!playerCharacter?.id) {
      notifications?.warn("You don't have a character assigned. Ask your GM.");
      return;
    }
    notifications?.info(`Opening ${bankName}...`);
    openBankForActor(playerCharacter);
  }
};

/**
 * Module initialization
 */
Hooks.once("init", () => {
  log(`Initializing ${MODULE_NAME}`);
  registerSettings();
  registerEconomyStorage();

  const templates = Object.values(TEMPLATES);
  loadTemplates(templates).catch((err: unknown) => {
    log(`Failed to load templates: ${String(err)}`);
  });

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
    notifications?.warn(
      `FAX-BANK: System "${system}" has limited support. Currency may not sync with character sheets.`
    );
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

  // @ts-expect-error - Adding to window for console access
  window.FAXBANK = {
    openAdmin: openAdminPanel,
    openBank: (actorId: string): void => {
      const actor = (game as GameType | undefined)?.actors?.get(actorId);
      if (actor) {
        openBankForActor(actor);
      } else {
        // eslint-disable-next-line no-console
        console.log("Usage: FAXBANK.openBank('actorId')");
      }
    },
    listBanks: (): void => {
      const banks = getBanks();
      // eslint-disable-next-line no-console
      console.table(banks.map((b) => ({ name: b.name, id: b.id, npcId: b.npcActorId })));
    },
  };

  log("API: FAXBANK.openAdmin(), FAXBANK.openBank(actorId), FAXBANK.listBanks()");
});

/**
 * Intercept token left-click - if it's a Bank NPC, open bank instead of sheet
 */
Hooks.on("clickToken", (token: TokenObjectType, _event: unknown) => {
  const actor = token.actor;
  if (!actor?.id) return;

  // Check if this is a Bank NPC
  const bank = getBankByNPC(actor.id);
  if (!bank) return; // Not a bank NPC, let normal behavior happen

  // This is a Bank NPC - handle bank interaction
  log(`Bank NPC clicked: ${bank.name}`);
  handleBankNPCClick(actor, bank.name);
});

/**
 * Intercept double-click to prevent actor sheet from opening for Bank NPCs
 */
Hooks.on("clickToken2", (token: TokenObjectType, _event: unknown) => {
  const actor = token.actor;
  if (!actor?.id) return true; // Allow normal behavior

  // Check if this is a Bank NPC
  const bank = getBankByNPC(actor.id);
  if (!bank) return true; // Not a bank NPC, allow sheet to open

  // This is a Bank NPC - prevent default and handle bank interaction
  log(`Bank NPC double-clicked: ${bank.name}`);
  handleBankNPCClick(actor, bank.name);

  return false; // Prevent the actor sheet from opening
});

/**
 * Add Token HUD button (optional, for convenience)
 */
Hooks.on("renderTokenHUD", (_hud: Application, html: JQuery, data: { actorId?: string }) => {
  const showHudButton = getSetting<boolean>("enableFeature");
  if (!showHudButton) return;

  const actorId = data.actorId;
  if (!actorId) return;

  const gameObj = game as GameType | undefined;
  const actor = gameObj?.actors?.get(actorId);
  if (!actor) return;

  // Only show on player's own token or for GM
  const isGM = gameObj?.user?.isGM ?? false;
  const isOwnCharacter = gameObj?.user?.character?.id === actorId;
  const isBank = getBankByNPC(actorId);

  if (!isGM && !isOwnCharacter && !isBank) return;

  const title = isBank ? `Access ${isBank.name}` : "Open Bank";
  const icon = isBank ? "fa-landmark" : "fa-university";

  const button = $(`
    <div class="control-icon fax-bank-hud" title="${title}">
      <i class="fas ${icon}"></i>
    </div>
  `);

  button.on("click", (event) => {
    event.preventDefault();
    event.stopPropagation();

    if (isBank) {
      handleBankNPCClick(actor, isBank.name);
    } else {
      openBankForActor(actor);
    }
  });

  html.find(".col.right").append(button);
});

/**
 * Add scene controls (Admin button for GM)
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
    if (!tokenControls) return;

    if (!tokenControls.tools) tokenControls.tools = [];

    tokenControls.tools.push({
      name: "fax-bank-admin",
      title: "FAX-BANK Admin",
      icon: "fas fa-university",
      button: true,
      onClick: () => openAdminPanel(),
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
        <p><strong>Left-click</strong> Bank NPC token to access bank</p>
        ${gameObj?.user?.isGM ? "<p><strong>Admin:</strong> Token Controls → Bank icon</p>" : ""}
      </div>
    `;

      type ChatMessageImpl = { create: (data: object) => Promise<unknown> };
      const ChatMsg = ChatMessage as unknown as { implementation?: ChatMessageImpl };
      if (ChatMsg.implementation?.create) {
        void ChatMsg.implementation.create({
          content: helpText,
          whisper: gameObj?.user?.isGM ? [] : undefined,
        });
      }
      return false;
    }

    if (trimmed === "/bank open") {
      const gameObj = game as GameType | undefined;
      const playerCharacter = gameObj?.user?.character;

      if (playerCharacter?.id) {
        openBankForActor(playerCharacter);
      } else {
        const notifications = ui.notifications as NotificationsType | undefined;
        notifications?.warn("You don't have a character assigned");
      }
      return false;
    }
  }
);

log("Module loaded");
