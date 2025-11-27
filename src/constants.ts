/**
 * FAX-BANK Constants
 * Module ID, name, and setting keys
 */

export const MODULE_ID = "fax-bank";
export const MODULE_NAME = "FAX-BANK";

/**
 * Setting keys - maps to human-readable purposes
 */
export const SETTINGS = {
  /** Show bank button on Token HUD */
  ENABLE_FEATURE: "enableFeature",
  /** Enable Shift+Click to open bank */
  DEBUG_MODE: "debugMode",
  /** Currency display format */
  CUSTOM_MESSAGE: "customMessage",
} as const;

/**
 * Template paths
 */
export const TEMPLATES = {
  ADMIN_PANEL: `modules/${MODULE_ID}/templates/admin-panel.hbs`,
  BANK_DIALOG: `modules/${MODULE_ID}/templates/bank-dialog.hbs`,
  SETTINGS_MENU: `modules/${MODULE_ID}/templates/settings-menu.hbs`,
} as const;

/**
 * Socket events for multi-user sync
 */
export const SOCKET_EVENTS = {
  SYNC_DATA: "syncData",
  TRANSACTION: "transaction",
} as const;
