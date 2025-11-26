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

// Module instances
let adminPanel: AdminPanel | null = null;

// Type for game object
type GameType = {
  user?: { isGM?: boolean };
  modules?: { get: (id: string) => { api?: unknown } | undefined };
};

// Type for notifications
type Notifications = {
  warn: (message: string) => void;
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
};

/**
 * Module ready - set up hooks and UI
 */
const handleReady = (): void => {
  log("FAX-BANK ready!");

  const gameObj = game as GameType | undefined;
  if (gameObj?.user?.isGM) {
    log("GM detected - Admin features enabled");
  }
};

/**
 * Register hooks
 */
Hooks.once("init", handleInit);
Hooks.once("ready", handleReady);

/**
 * Add button to Token HUD for opening bank dialog
 */
Hooks.on("renderTokenHUD", (_hud: TokenHUD, html: JQuery, data: { actorId?: string }) => {
  const showOnHUD = getSetting<boolean>(SETTINGS.ENABLE_FEATURE);
  if (!showOnHUD) return;

  const actorId = data.actorId;
  if (!actorId) return;

  // Get actor name
  type ActorType = { name?: string };
  const gameActors = (
    game as { actors?: { get: (id: string) => ActorType | undefined } } | undefined
  )?.actors;
  const actor = gameActors?.get(actorId);
  const actorName = actor?.name ?? "Unknown";

  // Create bank button
  const button = $(`
    <div class="control-icon fax-bank-hud" title="Open Bank">
      <i class="fas fa-university"></i>
    </div>
  `);

  button.on("click", () => {
    openBankDialog(actorId, actorName);
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
    openBankDialog(actorId, actorName);
  }
});

/**
 * Add settings button to open Admin Panel (GM only)
 */
Hooks.on("renderSettings", (_app: Application, html: JQuery) => {
  const gameObj = game as GameType | undefined;
  if (!gameObj?.user?.isGM) return;

  const button = $(`
    <button type="button" class="fax-bank-settings-btn">
      <i class="fas fa-university"></i> FAX-BANK Admin
    </button>
  `);

  button.on("click", () => {
    if (!adminPanel) {
      adminPanel = new AdminPanel();
    }
    adminPanel.render(true);
  });

  // Add after module settings
  html.find("#settings-game").append(button);
});

/**
 * Module API
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
    if (!adminPanel) {
      adminPanel = new AdminPanel();
    }
    adminPanel.render(true);
    return adminPanel;
  },

  // Open bank dialog for an actor
  openBankDialog,

  // Get bank dialog class for extension
  BankDialog,

  // Get admin panel class for extension
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
export { AdminPanel, BankDialog, openBankDialog };
export * from "./constants";
export * from "./utils/logger";
export * from "./data/EconomyManager";
export * from "./data/BankManager";
export * from "./types";
