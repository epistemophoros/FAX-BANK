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
 * Initialize module
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
 * Module ready
 */
const handleReady = (): void => {
  log("FAX-BANK ready!");

  // Expose console commands
  // @ts-expect-error - Adding to window for console access
  window.FAXBANK = {
    openAdmin: (): void => {
      openAdminPanel();
    },
    openBank: (actorId?: string, actorName?: string): void => {
      if (actorId) {
        openBankDialogForActor(actorId, actorName ?? "Unknown");
      } else {
        const canvasObj = canvas as CanvasType | undefined;
        const controlled = canvasObj?.tokens?.controlled;
        if (controlled?.[0]?.actor?.id) {
          openBankDialogForActor(controlled[0].actor.id, controlled[0].actor.name ?? "Unknown");
        } else {
          log("Select a token or use FAXBANK.openBank('actorId', 'name')");
        }
      }
    },
    help: (): void => {
      log("FAXBANK.openAdmin() - Open Admin Panel");
      log("FAXBANK.openBank() - Open Bank for selected token");
    },
  };

  log("Console: FAXBANK.openAdmin(), FAXBANK.openBank()");
};

Hooks.once("init", handleInit);
Hooks.once("ready", handleReady);

/**
 * Add Bank button to Token Controls (left sidebar)
 */
Hooks.on("getSceneControlButtons", (controls: SceneControl[]) => {
  const tokenControls = controls.find((c: SceneControl) => c.name === "token");
  if (!tokenControls) return;

  // Bank button - opens bank for selected token
  tokenControls.tools.push({
    name: "fax-bank",
    title: "FAX-BANK - Open Bank",
    icon: "fas fa-university",
    visible: true,
    button: true,
    onClick: (): void => {
      const canvasObj = canvas as CanvasType | undefined;
      const controlled = canvasObj?.tokens?.controlled;
      if (controlled?.[0]?.actor?.id) {
        openBankDialogForActor(controlled[0].actor.id, controlled[0].actor.name ?? "Unknown");
      } else {
        const notifications = ui.notifications as Notifications | undefined;
        notifications?.warn("Select a token first");
      }
    },
  } as SceneControlTool);
});

/**
 * Token HUD bank button
 */
Hooks.on("renderTokenHUD", (_hud: TokenHUD, html: JQuery, data: { actorId?: string }) => {
  if (!getSetting<boolean>(SETTINGS.ENABLE_FEATURE)) return;
  if (!data.actorId) return;

  const gameObj = game as GameType | undefined;
  const actor = gameObj?.actors?.get(data.actorId);
  const actorName = actor?.name ?? "Unknown";
  const actorId = data.actorId;

  const button = $(`
    <div class="control-icon fax-bank-hud" title="Open Bank">
      <i class="fas fa-university"></i>
    </div>
  `);

  button.on("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openBankDialogForActor(actorId, actorName);
  });

  html.find(".col.right").append(button);
});

/**
 * Shift+Click on canvas
 */
Hooks.on("canvasReady", () => {
  document.getElementById("board")?.addEventListener("click", (event: MouseEvent) => {
    if (!getSetting<boolean>(SETTINGS.DEBUG_MODE) || !event.shiftKey) return;

    const canvasObj = canvas as CanvasType | undefined;
    const controlled = canvasObj?.tokens?.controlled;
    if (controlled?.[0]?.actor?.id) {
      openBankDialogForActor(controlled[0].actor.id, controlled[0].actor.name ?? "Unknown");
    }
  });
});

/**
 * Open Admin Panel
 */
export const openAdminPanel = (): AdminPanel => {
  if (!adminPanel) {
    adminPanel = new AdminPanel();
  }
  adminPanel.render(true);
  return adminPanel;
};

/**
 * Open Bank Dialog for actor
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
 * Module API
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

Hooks.once("ready", () => {
  const gameObj = game as GameType | undefined;
  const module = gameObj?.modules?.get(MODULE_ID);
  if (module) {
    module.api = moduleApi;
  }
});

export { AdminPanel, BankDialog, openBankDialog };
export * from "./constants";
export * from "./utils/logger";
export * from "./data/EconomyManager";
export * from "./data/BankManager";
export * from "./types";
