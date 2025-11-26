import { MODULE_ID, MODULE_NAME, TEMPLATES, SETTINGS } from "../constants";
import { getSetting } from "../settings";
import { log } from "../utils/logger";

/**
 * Data structure for the Example Application
 */
interface ExampleAppData {
  title: string;
  message: string;
  isGM: boolean;
  timestamp: string;
}

/**
 * Example Application window for the module
 */
export class ExampleApplication extends Application {
  static override get defaultOptions(): typeof Application.defaultOptions {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: `${MODULE_ID}-app`,
      title: MODULE_NAME,
      template: TEMPLATES.EXAMPLE_APP,
      classes: [MODULE_ID, "sheet"],
      width: 400,
      height: "auto",
      resizable: true,
      minimizable: true,
    });
  }

  /**
   * Prepare data for rendering the template
   */
  override getData(): ExampleAppData {
    const customMessage = getSetting<string>(SETTINGS.CUSTOM_MESSAGE);
    // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    const isGM = Boolean(game instanceof Game && (game.user as { isGM?: boolean })?.isGM);

    return {
      title: MODULE_NAME,
      message: customMessage,
      isGM,
      timestamp: new Date().toLocaleString(),
    };
  }

  /**
   * Activate event listeners for the application
   */
  override activateListeners(html: JQuery): void {
    super.activateListeners(html);

    // Handle refresh button click
    html.find('[data-action="refresh"]').on("click", this.handleRefresh.bind(this));

    // Handle close button click
    html.find('[data-action="close"]').on("click", this.handleClose.bind(this));

    // Add keyboard accessibility
    html.find("[data-action]").on("keydown", this.handleKeyDown.bind(this));

    log("Application listeners activated");
  }

  /**
   * Handle refresh button click
   */
  private handleRefresh(event: JQuery.ClickEvent): void {
    event.preventDefault();
    log("Refreshing application...");
    this.render(true);
  }

  /**
   * Handle close button click
   */
  private handleClose(event: JQuery.ClickEvent): void {
    event.preventDefault();
    log("Closing application...");
    void this.close();
  }

  /**
   * Handle keyboard navigation
   */
  private handleKeyDown(event: JQuery.KeyDownEvent): void {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      const action = (event.currentTarget as HTMLElement).dataset.action;

      if (action === "refresh") {
        this.render(true);
      } else if (action === "close") {
        void this.close();
      }
    }
  }
}
