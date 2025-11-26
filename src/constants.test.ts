import { describe, it, expect } from "vitest";
import { MODULE_ID, MODULE_NAME, TEMPLATES, SETTINGS, SOCKET_EVENTS } from "./constants";

describe("constants", () => {
  describe("MODULE_ID", () => {
    it("should be a valid module identifier", () => {
      expect(MODULE_ID).toBe("fax-bank");
      expect(MODULE_ID).toMatch(/^[a-z0-9-]+$/);
    });
  });

  describe("MODULE_NAME", () => {
    it("should be a human-readable name", () => {
      expect(MODULE_NAME).toBe("FAX-BANK");
      expect(MODULE_NAME.length).toBeGreaterThan(0);
    });
  });

  describe("TEMPLATES", () => {
    it("should contain valid template paths", () => {
      expect(TEMPLATES.ADMIN_PANEL).toContain(MODULE_ID);
      expect(TEMPLATES.ADMIN_PANEL).toMatch(/\.hbs$/);
      expect(TEMPLATES.BANK_DIALOG).toContain(MODULE_ID);
      expect(TEMPLATES.BANK_DIALOG).toMatch(/\.hbs$/);
    });
  });

  describe("SETTINGS", () => {
    it("should have all required setting keys", () => {
      expect(SETTINGS).toHaveProperty("ENABLE_FEATURE");
      expect(SETTINGS).toHaveProperty("DEBUG_MODE");
      expect(SETTINGS).toHaveProperty("CUSTOM_MESSAGE");
    });

    it("should have non-empty setting keys", () => {
      Object.values(SETTINGS).forEach((value) => {
        expect(value.length).toBeGreaterThan(0);
      });
    });
  });

  describe("SOCKET_EVENTS", () => {
    it("should have properly named event names", () => {
      expect(SOCKET_EVENTS.SYNC_DATA).toBe("syncData");
      expect(SOCKET_EVENTS.TRANSACTION).toBe("transaction");
    });
  });
});
