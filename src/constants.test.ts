import { describe, it, expect } from "vitest";
import { MODULE_ID, MODULE_NAME, TEMPLATES, SETTINGS, SOCKET_EVENTS } from "./constants";

describe("constants", () => {
  describe("MODULE_ID", () => {
    it("should be a valid module identifier", () => {
      expect(MODULE_ID).toBe("example-module");
      expect(MODULE_ID).toMatch(/^[a-z0-9-]+$/);
    });
  });

  describe("MODULE_NAME", () => {
    it("should be a human-readable name", () => {
      expect(MODULE_NAME).toBe("Example Module");
      expect(MODULE_NAME.length).toBeGreaterThan(0);
    });
  });

  describe("TEMPLATES", () => {
    it("should contain valid template paths", () => {
      expect(TEMPLATES.EXAMPLE_APP).toContain(MODULE_ID);
      expect(TEMPLATES.EXAMPLE_APP).toMatch(/\.hbs$/);
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
    it("should have properly namespaced event names", () => {
      expect(SOCKET_EVENTS.UPDATE).toContain(MODULE_ID);
      expect(SOCKET_EVENTS.SYNC).toContain(MODULE_ID);
    });
  });
});
