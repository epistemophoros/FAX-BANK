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
import {
  isActorBank,
  getActorBankData,
  isSystemSupported,
  getGameSystem,
} from "./systems/SystemCurrency";
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

type TokenType = {
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
 * Handle actor sheet interactions for Bank NPCs
 * When a player double-clicks a Bank NPC token, open the bank
 */
Hooks.on("clickToken", (_token: TokenType, _controlled: boolean) => {
  // Placeholder for potential future double-click handling
});

/**
 * Double-click on token to interact with Bank NPC
 */
Hooks.on("canvasReady", () => {
  const canvasObj = canvas as
    | {
        stage?: {
          on: (
            event: string,
            callback: (event: { target?: { actor?: ActorType } }) => void
          ) => void;
        };
      }
    | undefined;

  if (!canvasObj?.stage) return;

  // This would be the ideal approach but Foundry doesn't have native dblclick
  // Instead we'll use the Actor Sheet interaction
  log("Canvas ready - Bank NPC interactions via actor sheet");
});

/**
 * When Actor Sheet renders, add bank button if it's a Bank NPC
 */
Hooks.on("renderActorSheet", (_sheet: Application, html: JQuery, data: { actor?: ActorType }) => {
  const actor = data.actor;
  if (!actor?.id) return;

  // Check if this actor is a Bank NPC (either via flags or EconomyManager)
  const bankFromFlags = isActorBank(actor) ? getActorBankData(actor) : null;
  const bankFromManager = getBankByNPC(actor.id);

  const bankName = bankFromManager?.name ?? bankFromFlags?.bankName ?? null;
  if (!bankName) return;

  // Add a prominent "Open Bank" button to the sheet
  const bankButton = $(`
    <div class="fax-bank-npc-banner">
      <button type="button" class="fax-bank-open-btn">
        <i class="fas fa-university"></i>
        Open ${bankName}
      </button>
    </div>
  `);

  bankButton.find(".fax-bank-open-btn").on("click", (event) => {
    event.preventDefault();

    // Get the currently controlled token's actor (the player's character)
    const canvasObj = canvas as
      | {
          tokens?: { controlled?: Array<{ actor?: ActorType }> };
        }
      | undefined;
    const playerToken = canvasObj?.tokens?.controlled?.[0];

    if (!playerToken?.actor?.id) {
      const notifications = ui.notifications as NotificationsType | undefined;
      notifications?.warn("Select your character token first, then click to open the bank");
      return;
    }

    openBankForActor(playerToken.actor);
  });

  // Prepend to sheet header
  html.find(".window-header").after(bankButton);

  log(`Added bank button to ${actor.name ?? "actor"} sheet`);
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
        <p><strong>Token HUD</strong> - Right-click token, click bank icon</p>
        <p><strong>Bank NPCs</strong> - Click "Open Bank" on NPC sheet</p>
        <p><strong>Console</strong> - FAXBANK.openAdmin() or FAXBANK.openBank(actorId)</p>
        ${gameObj?.user?.isGM ? "<p><strong>Admin</strong> - Token Controls sidebar</p>" : ""}
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
