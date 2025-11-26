import { describe, it, expect, vi, beforeEach } from "vitest";
import { debounce, throttle } from "./helpers";

describe("helpers", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  describe("debounce", () => {
    it("should delay function execution", () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn();
      expect(mockFn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      expect(mockFn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("should reset timer on subsequent calls", () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn();
      vi.advanceTimersByTime(50);

      debouncedFn();
      vi.advanceTimersByTime(50);

      expect(mockFn).not.toHaveBeenCalled();

      vi.advanceTimersByTime(50);
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("should pass arguments to the original function", () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 100);

      debouncedFn("arg1", "arg2");
      vi.advanceTimersByTime(100);

      expect(mockFn).toHaveBeenCalledWith("arg1", "arg2");
    });
  });

  describe("throttle", () => {
    it("should execute immediately on first call", () => {
      const mockFn = vi.fn();
      const throttledFn = throttle(mockFn, 100);

      throttledFn();
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("should ignore calls within throttle period", () => {
      const mockFn = vi.fn();
      const throttledFn = throttle(mockFn, 100);

      throttledFn();
      throttledFn();
      throttledFn();

      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it("should allow calls after throttle period", () => {
      const mockFn = vi.fn();
      const throttledFn = throttle(mockFn, 100);

      throttledFn();
      expect(mockFn).toHaveBeenCalledTimes(1);

      vi.advanceTimersByTime(100);

      throttledFn();
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it("should pass arguments to the original function", () => {
      const mockFn = vi.fn();
      const throttledFn = throttle(mockFn, 100);

      throttledFn("arg1", "arg2");
      expect(mockFn).toHaveBeenCalledWith("arg1", "arg2");
    });
  });
});

