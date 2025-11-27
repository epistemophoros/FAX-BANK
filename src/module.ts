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
import { registerEconomyStorage, getBankByNPC } from "./data/EconomyManager";

// Types
type GameType = {
  modules?: Map<string, { api?: Record<string, unknown> }>;
  user?: { isGM?: boolean };
  actors?: {
    get: (id: string) => ActorType | undefined;
  };
  i18n?: {
    localize: (key: string) => string;
  };
};

type ActorType = {
  id?: string;
  name?: string;
  img?: string;
  sheet?: { render: (force: boolean) => void };
  getFlag?: (module: string, key: string) => unknown;
};

type TokenDocType = {
  actor?: ActorType;
  actorId?: string;
};

type TokenType = {
  id?: string;
  document?: TokenDocType;
  actor?: ActorType;
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
 * Show GM choice dialog for bank NPC
 */
const showGMBankChoice = (bankName: string, npcActor: ActorType, playerActor: ActorType): void => {
  const content = `
    <div style="text-align: center; padding: 10px;">
      <p style="margin-bottom: 15px;">What would you like to do with <strong>${npcActor.name}</strong>?</p>
      <p style="color: #d4af37; font-size: 0.9em;">Bank: ${bankName}</p>
    </div>
  `;

  new Dialog({
    title: `🏦 ${bankName}`,
    content,
    buttons: {
      bank: {
        icon: '<i class="fas fa-university"></i>',
        label: "Open Bank",
        callback: (): void => {
          openBankForActor(playerActor);
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
 * Handle interaction with a Bank NPC token
 */
const handleBankNPCInteraction = (npcActor: ActorType): void => {
  if (!npcActor.id) return;

  const bank = getBankByNPC(npcActor.id);
  if (!bank) return; // Not a bank NPC

  const gameObj = game as GameType | undefined;
  const notifications = ui.notifications as NotificationsType | undefined;

  // Get the player's controlled token/actor
  const canvasObj = canvas as
    | {
        tokens?: { controlled?: Array<{ actor?: ActorType }> };
      }
    | undefined;

  // For players: need to have a token selected
  // For GM: can use any controlled token or just open for the NPC itself
  const playerToken = canvasObj?.tokens?.controlled?.find((t) => t.actor?.id !== npcActor.id);
  const playerActor = playerToken?.actor;

  if (gameObj?.user?.isGM) {
    // GM gets a choice dialog
    if (playerActor?.id) {
      showGMBankChoice(bank.name, npcActor, playerActor);
    } else {
      // No player token selected, just open NPC sheet or show message
      new Dialog({
        title: `🏦 ${bank.name}`,
        content: `
          <div style="text-align: center; padding: 10px;">
            <p>No player token selected.</p>
            <p style="font-size: 0.9em; color: #9ca3af;">Select a player token first to open the bank for them, or open the NPC sheet.</p>
          </div>
        `,
        buttons: {
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
        default: "sheet",
      }).render(true);
    }
  } else {
    // Player: open bank directly
    if (!playerActor?.id) {
      notifications?.warn("Select your character token first, then click on the bank NPC");
      return;
    }

    openBankForActor(playerActor);
  }
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
  };

  log("API exposed: FAXBANK.openAdmin(), FAXBANK.openBank(actorId)");
});

/**
 * Add Token HUD button
 */
Hooks.on("renderTokenHUD", (_hud: Application, html: JQuery, data: { actorId?: string }) => {
  const showHudButton = getSetting<boolean>("enableFeature");
  if (!showHudButton) return;

  const actorId = data.actorId;
  if (!actorId) return;

  const gameObj = game as GameType | undefined;
  const actor = gameObj?.actors?.get(actorId);
  if (!actor) return;

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
 * Handle double-click on tokens - Bank NPC interaction
 * Players double-click bank NPC to open bank
 * GMs get a choice dialog
 */
Hooks.on("controlToken", (token: TokenType, controlled: boolean) => {
  // Only trigger on gaining control (not releasing)
  if (!controlled) return;

  const actor = token.actor ?? token.document?.actor;
  if (!actor?.id) return;

  // Check if this is a bank NPC
  const bank = getBankByNPC(actor.id);
  if (!bank) return; // Not a bank NPC, normal behavior

  // This is a bank NPC - handle the interaction
  // Use a small delay to let the normal selection happen first
  setTimeout(() => {
    handleBankNPCInteraction(actor);
  }, 100);
});

/**
 * Alternative: Double-click handler for bank NPCs
 */
Hooks.on("canvasReady", () => {
  const canvasObj = canvas as
    | {
        stage?: {
          on: (
            event: string,
            callback: (event: { data?: { originalEvent?: MouseEvent } }) => void
          ) => void;
        };
        tokens?: {
          placeables?: TokenType[];
          controlled?: TokenType[];
        };
      }
    | undefined;

  if (!canvasObj?.stage) return;

  // Listen for double-clicks on canvas
  canvasObj.stage.on("dblclick", (event) => {
    // Get clicked position
    const originalEvent = event.data?.originalEvent;
    if (!originalEvent) return;

    // Find if we double-clicked a token
    const tokens = canvasObj.tokens?.placeables ?? [];
    for (const token of tokens) {
      const actor = token.actor ?? token.document?.actor;
      if (!actor?.id) continue;

      // Check if this actor is a bank NPC
      const bank = getBankByNPC(actor.id);
      if (bank) {
        handleBankNPCInteraction(actor);
        break;
      }
    }
  });

  log("Canvas ready - Bank NPC double-click handler active");
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
        <p><strong>Bank NPCs</strong> - Click on a Bank NPC token to open bank</p>
        <p><strong>Console</strong> - FAXBANK.openAdmin() or FAXBANK.openBank(actorId)</p>
        ${gameObj?.user?.isGM ? "<p><strong>Admin</strong> - Token Controls sidebar → Bank icon</p>" : ""}
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
  }
);

log("Module loaded");
