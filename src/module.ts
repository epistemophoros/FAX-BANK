/**
 * FAX-BANK - Foundry VTT Banking Module
 * Main entry point
 */

import "./styles/module.css";
import { MODULE_ID, MODULE_NAME, SETTINGS } from "./constants";
import { registerSettings, getSetting } from "./settings";
import { registerDataStore } from "./data/DataStore";
import { AdminPanel } from "./applications/AdminPanel";
import { BankDialog, openBankDialog } from "./applications/BankDialog";
import { log } from "./utils/logger";

// Module instances - persist across renders
let adminPanel: AdminPanel | null = null;
const bankDialogs: Map<string, BankDialog> = new Map();

// Type definitions
type GameType = {
  user?: { isGM?: boolean; id?: string };
  modules?: { get: (id: string) => { api?: unknown } | undefined };
  actors?: { get: (id: string) => { id?: string; name?: string } | undefined };
};

type Notifications = {
  info: (message: string) => void;
  warn: (message: string) => void;
  error: (message: string) => void;
};

type ChatMessage = {
  content: string;
  user?: { id?: string };
};

type SceneControlTool = {
  name: string;
  title: string;
  icon: string;
  button: boolean;
  onClick: () => void;
};

type SceneControl = {
  name: string;
  tools: SceneControlTool[];
};

type CanvasType = {
  tokens?: {
    controlled?: Array<{ actor?: { id?: string; name?: string } }>;
  };
};

/**
 * Initialize module - register settings and data store
 */
const handleInit = (): void => {
  log("Initializing FAX-BANK...");
  registerSettings();
  registerDataStore();

  // Register Handlebars helpers
  Handlebars.registerHelper("eq", (a: unknown, b: unknown) => a === b);
  Handlebars.registerHelper("gt", (a: number, b: number) => a > b);
  Handlebars.registerHelper("formatDate", (timestamp: number) => {
    return new Date(timestamp).toLocaleString();
  });
  Handlebars.registerHelper(
    "lookup",
    (obj: Record<string, unknown> | undefined, key: string) => obj?.[key]
  );

  log("FAX-BANK initialized");
};

/**
 * Module ready - set up hooks and UI
 */
const handleReady = (): void => {
  log("FAX-BANK ready!");

  const gameObj = game as GameType | undefined;
  const notifications = ui.notifications as Notifications | undefined;

  if (gameObj?.user?.isGM) {
    log("GM detected - Admin features enabled");
    notifications?.info("FAX-BANK: Admin Panel available in Scene Controls (bank icon)");
  } else {
    notifications?.info("FAX-BANK: Bank available via Token HUD or /bank command");
  }
};

/**
 * Register hooks
 */
Hooks.once("init", handleInit);
Hooks.once("ready", handleReady);

/**
 * Add scene control buttons (left sidebar)
 */
Hooks.on("getSceneControlButtons", (controls: SceneControl[]) => {
  const gameObj = game as GameType | undefined;

  // Find the token controls group
  const tokenControls = controls.find((c) => c.name === "token");
  if (!tokenControls) return;

  // Add Bank button for all users
  tokenControls.tools.push({
    name: "fax-bank",
    title: "FAX-BANK",
    icon: "fas fa-university",
    button: true,
    onClick: () => {
      if (gameObj?.user?.isGM) {
        // GM opens admin panel
        openAdminPanel();
      } else {
        // Players see instruction
        const notifications = ui.notifications as Notifications | undefined;
        notifications?.info(
          "Select a token and use the Token HUD bank button, or use /bank command"
        );
      }
    },
  });

  // Add Admin Panel button for GMs
  if (gameObj?.user?.isGM) {
    tokenControls.tools.push({
      name: "fax-bank-admin",
      title: "FAX-BANK Admin Panel",
      icon: "fas fa-cogs",
      button: true,
      onClick: () => {
        openAdminPanel();
      },
    });
  }
});

/**
 * Add button to Token HUD for opening bank dialog
 */
Hooks.on("renderTokenHUD", (_hud: TokenHUD, html: JQuery, data: { actorId?: string }) => {
  const showOnHUD = getSetting<boolean>(SETTINGS.ENABLE_FEATURE);
  if (!showOnHUD) return;

  const actorId = data.actorId;
  if (!actorId) return;

  const gameObj = game as GameType | undefined;
  const actor = gameObj?.actors?.get(actorId);
  const actorName = actor?.name ?? "Unknown";

  // Create bank button
  const button = $(`
    <div class="control-icon fax-bank-hud" title="Open Bank" data-action="open-bank">
      <i class="fas fa-university"></i>
    </div>
  `);

  button.on("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openBankDialogForActor(actorId, actorName);
  });

  // Add to right column of HUD
  html.find(".col.right").append(button);
});

/**
 * Handle Shift+Click on tokens to open bank dialog
 */
Hooks.on("clickToken", (token: { actor?: { id?: string; name?: string } }, event: MouseEvent) => {
  const enableShiftClick = getSetting<boolean>(SETTINGS.DEBUG_MODE);
  if (!enableShiftClick || !event.shiftKey) return;

  const actorId = token.actor?.id;
  const actorName = token.actor?.name ?? "Unknown";

  if (actorId) {
    openBankDialogForActor(actorId, actorName);
  }
});

/**
 * Chat command handler - /bank
 */
Hooks.on("chatMessage", (_chatLog: unknown, message: string, _chatData: ChatMessage) => {
  const command = message.trim().toLowerCase();

  if (command === "/bank" || command === "/bank help") {
    showBankHelp();
    return false; // Prevent message from being sent
  }

  if (command === "/bank admin") {
    const gameObj = game as GameType | undefined;
    if (gameObj?.user?.isGM) {
      openAdminPanel();
    } else {
      const notifications = ui.notifications as Notifications | undefined;
      notifications?.warn("Only GMs can access the Admin Panel");
    }
    return false;
  }

  if (command.startsWith("/bank open")) {
    // Try to open bank for controlled token
    const canvasObj = canvas as CanvasType | undefined;
    const controlled = canvasObj?.tokens?.controlled;
    if (controlled && controlled.length > 0) {
      const token = controlled[0];
      if (token?.actor?.id) {
        openBankDialogForActor(token.actor.id, token.actor.name ?? "Unknown");
      }
    } else {
      const notifications = ui.notifications as Notifications | undefined;
      notifications?.warn("Select a token first to open its bank");
    }
    return false;
  }

  return true; // Allow other messages
});

/**
 * Show bank help in chat
 */
const showBankHelp = (): void => {
  const gameObj = game as GameType | undefined;
  const isGM = gameObj?.user?.isGM ?? false;

  const helpText = `
    <div class="fax-bank-help">
      <h3>🏦 FAX-BANK Commands</h3>
      <ul>
        <li><code>/bank</code> - Show this help</li>
        <li><code>/bank open</code> - Open bank for selected token</li>
        ${isGM ? "<li><code>/bank admin</code> - Open Admin Panel (GM only)</li>" : ""}
      </ul>
      <h4>Other Ways to Access:</h4>
      <ul>
        <li>Click the bank icon on Token HUD</li>
        <li>Shift+Click on a token (if enabled)</li>
        <li>Click the bank icon in Scene Controls</li>
      </ul>
    </div>
  `;

  // @ts-expect-error - ChatMessage.create exists at runtime in Foundry VTT
  // eslint-disable-next-line @typescript-eslint/no-unsafe-call
  ChatMessage.create({
    content: helpText,
    whisper: [gameObj?.user?.id ?? ""],
  });
};

/**
 * Open Admin Panel (creates new instance if needed)
 */
const openAdminPanel = (): AdminPanel => {
  if (!adminPanel) {
    adminPanel = new AdminPanel();
  }
  adminPanel.render(true);
  return adminPanel;
};

/**
 * Open Bank Dialog for an actor (reuses existing if open)
 */
const openBankDialogForActor = (actorId: string, actorName: string): BankDialog => {
  let dialog = bankDialogs.get(actorId);
  if (!dialog) {
    dialog = new BankDialog(actorId, actorName);
    bankDialogs.set(actorId, dialog);
  }
  dialog.render(true);
  return dialog;
};

/**
 * Module API - exposed for macros and other modules
 */
const moduleApi = {
  // Open admin panel (GM only)
  openAdminPanel: (): AdminPanel | null => {
    const gameObj = game as GameType | undefined;
    if (!gameObj?.user?.isGM) {
      const notifications = ui.notifications as Notifications | undefined;
      notifications?.warn("Only GMs can access the Admin Panel");
      return null;
    }
    return openAdminPanel();
  },

  // Open bank dialog for an actor
  openBankDialog: openBankDialogForActor,

  // Get classes for extension
  BankDialog,
  AdminPanel,

  // Module info
  version: "1.0.0",
  id: MODULE_ID,
  name: MODULE_NAME,
};

// Register API on module
Hooks.once("ready", () => {
  const gameObj = game as GameType | undefined;
  if (gameObj?.modules) {
    const module = gameObj.modules.get(MODULE_ID);
    if (module) {
      module.api = moduleApi;
    }
  }
  log("FAX-BANK API registered");
});

// Export for external use
export { AdminPanel, BankDialog, openBankDialog, openAdminPanel };
export * from "./constants";
export * from "./utils/logger";
export * from "./data/EconomyManager";
export * from "./data/BankManager";
export * from "./types";
