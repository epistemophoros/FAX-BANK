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

type NotificationsType = {
  info: (msg: string) => void;
  warn: (msg: string) => void;
};

/**
 * Settings Menu - Simple launcher for Admin Panel
 */
class SettingsMenu extends FormApplication {
  static override get defaultOptions(): FormApplicationOptions {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "fax-bank-settings-menu",
      title: "FAX-BANK",
      template: `modules/${MODULE_ID}/templates/settings-menu.hbs`,
      width: 400,
      height: "auto",
      closeOnSubmit: false,
    }) as FormApplicationOptions;
  }

  override getData(): object {
    const gameObj = game as GameWithSettings | undefined;
    return { isGM: gameObj?.user?.isGM ?? false };
  }

  override activateListeners(html: JQuery): void {
    super.activateListeners(html);

    const notifications = ui.notifications as NotificationsType | undefined;

    // Admin Panel button
    html.find("#fax-bank-open-admin").on("click", () => {
      import("./applications/AdminPanel")
        .then(({ AdminPanel }) => {
          new AdminPanel().render(true);
        })
        .catch(() => {
          notifications?.warn("Failed to open Admin Panel");
        });
      void this.close();
    });

    // Bank Dialog button
    html.find("#fax-bank-open-bank").on("click", () => {
      type CanvasType = {
        tokens?: { controlled?: Array<{ actor?: { id?: string; name?: string } }> };
      };
      const canvasObj = canvas as CanvasType | undefined;
      const token = canvasObj?.tokens?.controlled?.[0];

      if (token?.actor?.id) {
        import("./applications/BankDialog")
          .then(({ BankDialog }) => {
            new BankDialog(token.actor?.id ?? "", token.actor?.name ?? "Unknown").render(true);
          })
          .catch(() => {
            notifications?.warn("Failed to open Bank Dialog");
          });
        void this.close();
      } else {
        notifications?.warn("Select a token first");
      }
    });
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  protected override async _updateObject(): Promise<void> {
    // Nothing to save
  }
}

/**
 * Register module settings
 */
export const registerSettings = (): void => {
  log("Registering settings...");

  const gameObj = game as GameWithSettings | undefined;
  if (!gameObj?.settings) return;

  // Settings Menu Button
  gameObj.settings.registerMenu(MODULE_ID, "launcher", {
    name: "🏦 Open FAX-BANK",
    label: "Open FAX-BANK",
    hint: "Open Admin Panel (GM) or Bank Dialog",
    icon: "fas fa-university",
    type: SettingsMenu,
    restricted: false,
  });

  // Show Token HUD button
  gameObj.settings.register(MODULE_ID, SETTINGS.ENABLE_FEATURE, {
    name: "Show Bank Button on Token HUD",
    hint: "Display a bank icon when right-clicking tokens",
    scope: "world",
    config: true,
    type: Boolean,
    default: true,
    requiresReload: false,
  });

  // Currency display format
  gameObj.settings.register(MODULE_ID, SETTINGS.CUSTOM_MESSAGE, {
    name: "Currency Display Format",
    hint: "How to display currency amounts",
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

  // Debug mode (hidden, for developers)
  gameObj.settings.register(MODULE_ID, SETTINGS.DEBUG_MODE, {
    name: "Debug Mode",
    hint: "Enable debug logging",
    scope: "client",
    config: false,
    type: Boolean,
    default: false,
    requiresReload: false,
  });

  log("Settings registered");
};

/**
 * Get setting value
 */
export const getSetting = <T>(key: string): T => {
  const gameObj = game as GameWithSettings | undefined;
  if (!gameObj?.settings) {
    if (key === SETTINGS.ENABLE_FEATURE) return true as T;
    if (key === SETTINGS.CUSTOM_MESSAGE) return "abbreviation" as T;
    if (key === SETTINGS.DEBUG_MODE) return false as T;
    return "" as T;
  }

  try {
    return gameObj.settings.get(MODULE_ID, key) as T;
  } catch {
    if (key === SETTINGS.ENABLE_FEATURE) return true as T;
    if (key === SETTINGS.CUSTOM_MESSAGE) return "abbreviation" as T;
    if (key === SETTINGS.DEBUG_MODE) return false as T;
    return "" as T;
  }
};

/**
 * Set setting value
 */
export const setSetting = async <T>(key: string, value: T): Promise<T> => {
  const gameObj = game as GameWithSettings | undefined;
  if (!gameObj?.settings) return value;
  return (await gameObj.settings.set(MODULE_ID, key, value)) as T;
};
