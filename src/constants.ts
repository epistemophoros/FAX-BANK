/**
 * Module identifier - must match the "id" in module.json
 */
export const MODULE_ID = "fax-bank" as const;

/**
 * Human-readable module name
 */
export const MODULE_NAME = "FAX-BANK" as const;

/**
 * Template paths for the module
 */
export const TEMPLATES = {
  EXAMPLE_APP: `modules/${MODULE_ID}/templates/example-app.hbs`,
} as const;

/**
 * Setting keys for the module
 */
export const SETTINGS = {
  ENABLE_FEATURE: "enableFeature",
  DEBUG_MODE: "debugMode",
  CUSTOM_MESSAGE: "customMessage",
} as const;

/**
 * Socket event names for the module
 */
export const SOCKET_EVENTS = {
  UPDATE: `module.${MODULE_ID}.update`,
  SYNC: `module.${MODULE_ID}.sync`,
} as const;
