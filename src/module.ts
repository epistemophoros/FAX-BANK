import "./styles/module.css";
import { MODULE_ID, MODULE_NAME } from "./constants";
import { registerSettings } from "./settings";
import { ExampleApplication } from "./applications/ExampleApplication";
import { log } from "./utils/logger";

// Type for game object
type GameType = {
  user?: { isGM?: boolean };
  modules?: { get: (id: string) => { api?: unknown } | undefined };
};

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

  const gameObj = game as GameType | undefined;
  if (gameObj?.user?.isGM) {
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

  const gameObj = game as GameType | undefined;
  if (gameObj?.modules) {
    const module = gameObj.modules.get(MODULE_ID);
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
