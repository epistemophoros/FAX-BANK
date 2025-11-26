/**
 * FAX-BANK Settings
 */

import { MODULE_ID, SETTINGS } from "./constants";
import { log } from "./utils/logger";

// Type for game object with settings
type GameWithSettings = {
  user?: { isGM?: boolean };
  settings?: {
    register: (module: string, key: string, data: object) => void;
    registerMenu: (module: string, key: string, data: object) => void;
    get: (module: string, key: string) => unknown;
    set: (module: string, key: string, value: unknown) => Promise<unknown>;
  };
};

/**
 * Settings Menu - Admin Panel Launcher
 */
class AdminPanelLauncher extends FormApplication {
  static override get defaultOptions(): FormApplicationOptions {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "fax-bank-launcher",
      title: "FAX-BANK",
      template: `modules/${MODULE_ID}/templates/settings-menu.hbs`,
      width: 400,
      height: "auto",
      closeOnSubmit: false,
    }) as FormApplicationOptions;
  }

  override getData(): object {
    const gameObj = game as GameWithSettings | undefined;
    return {
      isGM: gameObj?.user?.isGM ?? false,
    };
  }

  override activateListeners(html: JQuery): void {
    super.activateListeners(html);

    html.find('[data-action="open-admin"]').on("click", (e) => {
      e.preventDefault();
      // Import dynamically to avoid circular deps
      import("./applications/AdminPanel").then(({ AdminPanel }) => {
        new AdminPanel().render(true);
        this.close();
      });
    });

    html.find('[data-action="open-bank"]').on("click", (e) => {
      e.preventDefault();
      type CanvasType = {
        tokens?: {
          controlled?: Array<{ actor?: { id?: string; name?: string } }>;
        };
      };
      const canvasObj = canvas as CanvasType | undefined;
      const controlled = canvasObj?.tokens?.controlled;
      if (controlled && controlled.length > 0 && controlled[0]?.actor?.id) {
        import("./applications/BankDialog").then(({ BankDialog }) => {
          new BankDialog(
            controlled[0]?.actor?.id ?? "",
            controlled[0]?.actor?.name ?? "Unknown"
          ).render(true);
          this.close();
        });
      } else {
        type Notifications = { warn: (msg: string) => void };
        const notifications = ui.notifications as Notifications | undefined;
        notifications?.warn("Select a token first to open their bank");
      }
    });
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  protected override async _updateObject(): Promise<void> {
    // No form data to save
  }
}

/**
 * Register module settings in Foundry
 */
export const registerSettings = (): void => {
  log("Registering settings...");

  const gameObj = game as GameWithSettings | undefined;
  if (!gameObj?.settings) {
    return;
  }

  // Settings Menu - Opens launcher with buttons
  gameObj.settings.registerMenu(MODULE_ID, "launcher", {
    name: "🏦 Open FAX-BANK",
    label: "Open FAX-BANK",
    hint: "Open the FAX-BANK panels",
    icon: "fas fa-university",
    type: AdminPanelLauncher,
    restricted: false,
  });

  // Show Bank Button on Token HUD
  gameObj.settings.register(MODULE_ID, SETTINGS.ENABLE_FEATURE, {
    name: "✅ Show Bank on Token HUD",
    hint: "Display a bank button (🏦) on the Token HUD for quick access. (Recommended: ON)",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: false,
  });

  // Enable Shift+Click on Tokens
  gameObj.settings.register(MODULE_ID, SETTINGS.DEBUG_MODE, {
    name: "✅ Shift+Select Opens Bank",
    hint: "Select a token then press Shift to instantly open their bank dialog. (Recommended: ON)",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: false,
  });

  // Default Currency Display
  gameObj.settings.register(MODULE_ID, SETTINGS.CUSTOM_MESSAGE, {
    name: "Currency Display Format",
    hint: "How currency amounts should be displayed throughout the module.",
    scope: "client",
    config: true,
    type: String,
    choices: {
      symbol: "Symbol (🪙 100)",
      abbreviation: "Abbreviation (100 gp)",
      full: "Full Name (100 Gold)",
    },
    default: "abbreviation",
    requiresReload: false,
  });

  log("Settings registered successfully");
};

/**
 * Get a setting value with type safety
 */
export const getSetting = <T>(key: string): T => {
  const gameObj = game as GameWithSettings | undefined;
  if (!gameObj?.settings) {
    // Return defaults if settings not available
    if (key === SETTINGS.ENABLE_FEATURE) return true as T;
    if (key === SETTINGS.DEBUG_MODE) return true as T;
    if (key === SETTINGS.CUSTOM_MESSAGE) return "abbreviation" as T;
    return "" as T;
  }

  try {
    return gameObj.settings.get(MODULE_ID, key) as T;
  } catch {
    // Return defaults if setting doesn't exist yet
    if (key === SETTINGS.ENABLE_FEATURE) return true as T;
    if (key === SETTINGS.DEBUG_MODE) return true as T;
    if (key === SETTINGS.CUSTOM_MESSAGE) return "abbreviation" as T;
    return "" as T;
  }
};

/**
 * Set a setting value
 */
export const setSetting = async <T>(key: string, value: T): Promise<T> => {
  const gameObj = game as GameWithSettings | undefined;
  if (!gameObj?.settings) {
    return value;
  }
  return (await gameObj.settings.set(MODULE_ID, key, value)) as T;
};

/**
 * Check if Token HUD button is enabled
 */
export const isTokenHUDEnabled = (): boolean => {
  return getSetting<boolean>(SETTINGS.ENABLE_FEATURE);
};

/**
 * Check if Shift+Click is enabled
 */
export const isShiftClickEnabled = (): boolean => {
  return getSetting<boolean>(SETTINGS.DEBUG_MODE);
};

/**
 * Get currency display format
 */
export const getCurrencyFormat = (): "symbol" | "abbreviation" | "full" => {
  return getSetting<"symbol" | "abbreviation" | "full">(SETTINGS.CUSTOM_MESSAGE);
};
