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
  i18n?: {
    localize: (key: string) => string;
  };
};

type ActorType = {
  id?: string;
  name?: string;
  img?: string;
  type?: string;
  sheet?: { render: (force: boolean) => void };
  getFlag?: (module: string, key: string) => unknown;
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

  // Also add any other characters from actors list that aren't assigned
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

  // Build dropdown options
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
      <hr style="margin: 15px 0; border-color: #404060;">
      <p style="font-size: 0.9em; color: #9ca3af;">Or manage the NPC directly:</p>
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
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: "Cancel",
      },
    },
    default: "bank",
  }).render(true);
};

/**
 * Handle Bank NPC interaction for players
 */
const handlePlayerBankInteraction = (bankName: string): void => {
  const gameObj = game as GameType | undefined;
  const notifications = ui.notifications as NotificationsType | undefined;

  // Get the player's assigned character
  const playerCharacter = gameObj?.user?.character;

  if (!playerCharacter?.id) {
    notifications?.warn(
      "You don't have a character assigned. Ask your GM to assign you a character."
    );
    return;
  }

  // Open bank for the player's character
  notifications?.info(`Opening ${bankName} for ${playerCharacter.name ?? "your character"}...`);
  openBankForActor(playerCharacter);
};

/**
 * Module initialization
 */
Hooks.once("init", () => {
  log(`Initializing ${MODULE_NAME}`);

  // Register settings
  registerSettings();

  // Register economy data storage
  registerEconomyStorage();

  // Load templates
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

  // Check system support
  const system = getGameSystem();
  const supported = isSystemSupported();
  log(`Game system: ${system}, Supported: ${supported}`);

  if (!supported) {
    const notifications = ui.notifications as NotificationsType | undefined;
    notifications?.warn(
      `FAX-BANK: System "${system}" has limited support. Currency tracking may not work correctly.`
    );
  }

  // Initialize socket for multiplayer
  initializeSocket();

  // Expose API for console/macros
  const gameObj = game as GameType | undefined;
  const moduleData = gameObj?.modules?.get(MODULE_ID);
  if (moduleData) {
    moduleData.api = {
      openAdmin: openAdminPanel,
      openBank: (actorId: string): void => {
        const actor = gameObj?.actors?.get(actorId);
        if (actor) {
          openBankForActor(actor);
        }
      },
    };
  }

  // Global console helper
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

  log("API exposed: FAXBANK.openAdmin(), FAXBANK.openBank(actorId), FAXBANK.listBanks()");
});

/**
 * Intercept actor sheet opening for Bank NPCs
 * Players: Block sheet, open bank instead
 * GMs: Show choice dialog
 */
Hooks.on(
  "preOpenActorSheet",
  (actor: ActorType, _options: unknown, _userId: string): boolean | void => {
    if (!actor?.id) return;

    // Check if this actor is a Bank NPC
    const bank = getBankByNPC(actor.id);
    if (!bank) return; // Not a bank NPC, allow normal behavior

    const gameObj = game as GameType | undefined;

    if (gameObj?.user?.isGM) {
      // GM: Show choice dialog
      showGMBankDialog(bank.name, actor);
      return false; // Prevent default sheet open
    } else {
      // Player: Open bank directly
      handlePlayerBankInteraction(bank.name);
      return false; // Prevent default sheet open
    }
  }
);

/**
 * Add Token HUD button for players to access their own bank
 */
Hooks.on("renderTokenHUD", (_hud: Application, html: JQuery, data: { actorId?: string }) => {
  const showHudButton = getSetting<boolean>("enableFeature");
  if (!showHudButton) return;

  const actorId = data.actorId;
  if (!actorId) return;

  const gameObj = game as GameType | undefined;
  const actor = gameObj?.actors?.get(actorId);
  if (!actor) return;

  // Only show on player's own tokens (not NPC tokens)
  // GMs see it on all tokens
  const isGM = gameObj?.user?.isGM ?? false;
  const isOwnCharacter = gameObj?.user?.character?.id === actorId;

  if (!isGM && !isOwnCharacter) return;

  // Create bank button
  const button = $(`
    <div class="control-icon fax-bank-hud" title="Open Bank">
      <i class="fas fa-university"></i>
    </div>
  `);

  button.on("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    openBankForActor(actor);
  });

  // Add to HUD (right column)
  html.find(".col.right").append(button);

  log("Added bank button to Token HUD");
});

/**
 * Add scene controls
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
    const isGM = gameObj?.user?.isGM ?? false;

    // Find token controls
    const tokenControls = controls.find((c) => c.name === "token");
    if (!tokenControls) return;

    if (!tokenControls.tools) {
      tokenControls.tools = [];
    }

    // Add Admin Panel button (GM only)
    if (isGM) {
      tokenControls.tools.push({
        name: "fax-bank-admin",
        title: "FAX-BANK Admin",
        icon: "fas fa-university",
        button: true,
        onClick: () => {
          openAdminPanel();
        },
      });
    }
  }
);

/**
 * Chat command handler
 */
Hooks.on(
  "chatMessage",
  (_chatLog: unknown, message: string, _chatData: unknown): boolean | void => {
    const trimmed = message.trim().toLowerCase();

    if (trimmed === "/bank" || trimmed === "/bank help") {
      const gameObj = game as GameType | undefined;
      const notifications = ui.notifications as NotificationsType | undefined;

      // Show help
      const helpText = `
      <div class="fax-bank-help">
        <h3>🏦 FAX-BANK Commands</h3>
        <p><strong>/bank</strong> - Show this help</p>
        <p><strong>Token HUD</strong> - Right-click your token, click bank icon</p>
        <p><strong>Bank NPCs</strong> - Double-click a Bank NPC token to access bank</p>
        <p><strong>Console</strong> - FAXBANK.openBank(actorId)</p>
        ${gameObj?.user?.isGM ? "<p><strong>Admin</strong> - Token Controls → Bank icon</p>" : ""}
      </div>
    `;

      notifications?.info("FAX-BANK: Check chat for commands");

      // Post to chat
      type ChatMessageImpl = {
        create: (data: object) => Promise<unknown>;
      };
      const ChatMsg = ChatMessage as unknown as { implementation?: ChatMessageImpl };
      if (ChatMsg.implementation?.create) {
        void ChatMsg.implementation.create({
          content: helpText,
          whisper: gameObj?.user?.isGM ? [] : undefined,
        });
      }

      return false; // Prevent default chat
    }

    // Quick bank open for players
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
