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
 * Module ready - set up hooks and UI, expose console commands
 */
const handleReady = (): void => {
  log("FAX-BANK ready!");

  const gameObj = game as GameType | undefined;
  const notifications = ui.notifications as Notifications | undefined;

  // Expose global console commands
  // @ts-expect-error - Adding to window for console access
  window.FAXBANK = {
    openAdmin: () => {
      openAdminPanel();
      log("Admin Panel opened via console");
    },
    openBank: (actorId?: string, actorName?: string) => {
      if (actorId) {
        openBankDialogForActor(actorId, actorName ?? "Unknown");
      } else {
        // Try to get selected token
        const canvasObj = canvas as CanvasType | undefined;
        const controlled = canvasObj?.tokens?.controlled;
        if (controlled && controlled.length > 0 && controlled[0]?.actor?.id) {
          openBankDialogForActor(
            controlled[0].actor.id,
            controlled[0].actor.name ?? "Unknown"
          );
        } else {
          log("No actor specified. Usage: FAXBANK.openBank('actorId', 'name') or select a token");
        }
      }
    },
    help: () => {
      log("=== FAX-BANK Console Commands ===");
      log("FAXBANK.openAdmin() - Open the Admin Panel (GM only)");
      log("FAXBANK.openBank() - Open bank for selected token");
      log("FAXBANK.openBank('actorId', 'name') - Open bank for specific actor");
      log("FAXBANK.help() - Show this help");
    },
  };

  if (gameObj?.user?.isGM) {
    log("GM detected - Admin features enabled");
    notifications?.info("FAX-BANK loaded! Use FAXBANK.openAdmin() in console or check Settings");
  } else {
    notifications?.info("FAX-BANK loaded! Use Token HUD bank button or FAXBANK.openBank() in console");
  }

  log("Console commands available: FAXBANK.openAdmin(), FAXBANK.openBank(), FAXBANK.help()");
};

/**
 * Register hooks
 */
Hooks.once("init", handleInit);
Hooks.once("ready", handleReady);

/**
 * Add scene control buttons (Token Controls in left sidebar)
 */
Hooks.on("getSceneControlButtons", (controls: SceneControl[]) => {
  const gameObj = game as GameType | undefined;

  // Find the token controls group
  const tokenControls = controls.find((c: SceneControl) => c.name === "token");
  if (!tokenControls) {
    log("Token controls not found, cannot add bank button");
    return;
  }

  log("Adding FAX-BANK buttons to Token Controls");

  // Add Bank button for all users
  tokenControls.tools.push({
    name: "fax-bank",
    title: "FAX-BANK - Open Bank",
    icon: "fas fa-university",
    visible: true,
    onClick: () => {
      const canvasObj = canvas as CanvasType | undefined;
      const controlled = canvasObj?.tokens?.controlled;
      if (controlled && controlled.length > 0 && controlled[0]?.actor?.id) {
        openBankDialogForActor(
          controlled[0].actor.id,
          controlled[0].actor.name ?? "Unknown"
        );
      } else {
        const notifications = ui.notifications as Notifications | undefined;
        notifications?.warn("Select a token first to open their bank");
      }
    },
    button: true,
  } as SceneControlTool);

  // Add Admin Panel button for GMs only
  if (gameObj?.user?.isGM) {
    tokenControls.tools.push({
      name: "fax-bank-admin",
      title: "FAX-BANK - Admin Panel",
      icon: "fas fa-cogs",
      visible: true,
      onClick: () => {
        openAdminPanel();
      },
      button: true,
    } as SceneControlTool);
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
 * Handle canvas click with shift key to open bank dialog
 */
Hooks.on("canvasReady", () => {
  const canvasElement = document.getElementById("board");
  if (!canvasElement) return;

  canvasElement.addEventListener("click", (event: MouseEvent) => {
    const enableShiftClick = getSetting<boolean>(SETTINGS.DEBUG_MODE);
    if (!enableShiftClick || !event.shiftKey) return;

    // Get controlled tokens
    const canvasObj = canvas as CanvasType | undefined;
    const controlled = canvasObj?.tokens?.controlled;
    if (controlled && controlled.length > 0 && controlled[0]?.actor?.id) {
      openBankDialogForActor(
        controlled[0].actor.id,
        controlled[0].actor.name ?? "Unknown"
      );
    }
  });
});

/**
 * Also try the controlToken hook for shift+click
 */
Hooks.on(
  "controlToken",
  (token: { actor?: { id?: string; name?: string } }, controlled: boolean) => {
    if (!controlled) return;

    // Check if shift is held (we'll check on next click)
    const enableShiftClick = getSetting<boolean>(SETTINGS.DEBUG_MODE);
    if (!enableShiftClick) return;

    // Store token info for shift+click handler
    const actorId = token.actor?.id;
    const actorName = token.actor?.name ?? "Unknown";

    if (actorId) {
      // Add one-time keydown listener for shift
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Shift") {
          openBankDialogForActor(actorId, actorName);
          document.removeEventListener("keydown", handleKeyDown);
        }
      };

      // Remove after 2 seconds if not used
      document.addEventListener("keydown", handleKeyDown);
      setTimeout(() => {
        document.removeEventListener("keydown", handleKeyDown);
      }, 2000);
    }
  }
);

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
  openAdminPanel,
  openBankDialog: openBankDialogForActor,
  BankDialog,
  AdminPanel,
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
