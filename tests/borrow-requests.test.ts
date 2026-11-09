import { describe, it, expect, beforeEach, vi } from "vitest";

describe("Borrow Request Logic", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2024-06-15"));
  });

  describe("Date Validation", () => {
    function isValidDateRange(startDate: string, endDate: string): boolean {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      return start >= today && end >= start;
    }

    it("accepts valid future date range", () => {
      expect(isValidDateRange("2024-06-20", "2024-06-25")).toBe(true);
    });

    it("accepts same-day start and end", () => {
      expect(isValidDateRange("2024-06-15", "2024-06-15")).toBe(true);
    });

    it("accepts today as start date", () => {
      expect(isValidDateRange("2024-06-15", "2024-06-20")).toBe(true);
    });

    it("rejects past start date", () => {
      expect(isValidDateRange("2024-06-10", "2024-06-20")).toBe(false);
    });

    it("rejects end date before start date", () => {
      expect(isValidDateRange("2024-06-25", "2024-06-20")).toBe(false);
    });
  });

  describe("Date Overlap Detection", () => {
    function datesOverlap(
      start1: string,
      end1: string,
      start2: string,
      end2: string
    ): boolean {
      return start1 <= end2 && end1 >= start2;
    }

    it("detects overlapping dates", () => {
      expect(datesOverlap("2024-06-15", "2024-06-20", "2024-06-18", "2024-06-25")).toBe(true);
    });

    it("detects contained dates", () => {
      expect(datesOverlap("2024-06-15", "2024-06-25", "2024-06-18", "2024-06-20")).toBe(true);
    });

    it("detects same dates", () => {
      expect(datesOverlap("2024-06-15", "2024-06-20", "2024-06-15", "2024-06-20")).toBe(true);
    });

    it("detects adjacent touching dates as overlapping", () => {
      expect(datesOverlap("2024-06-15", "2024-06-20", "2024-06-20", "2024-06-25")).toBe(true);
    });

    it("accepts non-overlapping dates", () => {
      expect(datesOverlap("2024-06-15", "2024-06-19", "2024-06-20", "2024-06-25")).toBe(false);
    });
  });

  describe("State Transitions", () => {
    type RequestStatus = "pending" | "approved" | "declined" | "returned" | "overdue";

    const validTransitions: Record<RequestStatus, RequestStatus[]> = {
      pending: ["approved", "declined"],
      approved: ["returned", "overdue"],
      declined: [],
      returned: [],
      overdue: ["returned"],
    };

    function canTransition(from: RequestStatus, to: RequestStatus): boolean {
      return validTransitions[from]?.includes(to) ?? false;
    }

    it("allows pending -> approved", () => {
      expect(canTransition("pending", "approved")).toBe(true);
    });

    it("allows pending -> declined", () => {
      expect(canTransition("pending", "declined")).toBe(true);
    });

    it("allows approved -> returned", () => {
      expect(canTransition("approved", "returned")).toBe(true);
    });

    it("allows approved -> overdue", () => {
      expect(canTransition("approved", "overdue")).toBe(true);
    });

    it("allows overdue -> returned", () => {
      expect(canTransition("overdue", "returned")).toBe(true);
    });

    it("denies declined -> any", () => {
      expect(canTransition("declined", "approved")).toBe(false);
      expect(canTransition("declined", "returned")).toBe(false);
    });

    it("denies returned -> any", () => {
      expect(canTransition("returned", "approved")).toBe(false);
      expect(canTransition("returned", "pending")).toBe(false);
    });

    it("denies approved -> pending (backward)", () => {
      expect(canTransition("approved", "pending")).toBe(false);
    });
  });
});
