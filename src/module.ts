import "./styles/module.css";
import { MODULE_ID, MODULE_NAME } from "./constants";
import { registerSettings } from "./settings";
import { ExampleApplication } from "./applications/ExampleApplication";
import { log } from "./utils/logger";

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

  // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
  if (game instanceof Game && (game.user as { isGM?: boolean })?.isGM) {
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
      return new ExampleApplication().render(true) as unknown as ExampleApplication;
    },
    version: "1.0.0",
    id: MODULE_ID,
    name: MODULE_NAME,
  };

  if (game instanceof Game) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    const module = (game.modules as any).get(MODULE_ID) as { api?: typeof moduleApi } | undefined;
    if (module) {
      module.api = moduleApi;
    }
  }

  log("Module API registered");
});

// Export for external use
export { ExampleApplication };
export * from "./constants";
export * from "./utils/logger";
