import "./styles/module.css";
import { MODULE_ID, MODULE_NAME } from "./constants";
import { registerSettings } from "./settings";
import { ExampleApplication } from "./applications/ExampleApplication";
import { log, error } from "./utils/logger";

/**
 * Initialize the module when Foundry is ready
 */
const handleInit = (): void => {
  log("Initializing module...");
  registerSettings();
};

/**
 * Setup module after initialization
 */
const handleReady = (): void => {
  log("Module ready!");

  // Example: Register a button in the settings tab
  if (game instanceof Game && game.user?.isGM) {
    log("User is GM, additional features enabled");
  }
};

/**
 * Register module hooks
 */
Hooks.once("init", handleInit);
Hooks.once("ready", handleReady);

/**
 * Expose module API for external access
 */
Hooks.once("ready", () => {
  const moduleApi = {
    openExampleApp: (): ExampleApplication => {
      return new ExampleApplication().render(true) as ExampleApplication;
    },
    version: "1.0.0",
    id: MODULE_ID,
    name: MODULE_NAME,
  };

  // @ts-expect-error - Extending game object with module API
  game.modules.get(MODULE_ID).api = moduleApi;

  log("Module API registered");
});

// Export for external use
export { ExampleApplication };
export * from "./constants";
export * from "./utils/logger";

