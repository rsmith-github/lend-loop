import { describe, it, expect, beforeEach } from "vitest";

describe("Idempotency Logic", () => {
  type ReminderRecord = {
    borrowRequestId: string;
    reminderDate: string;
    reminderType: string;
  };

  const sentReminders: ReminderRecord[] = [];

  function hasReminderBeenSent(
    requestId: string,
    date: string,
    type: string
  ): boolean {
    return sentReminders.some(
      (r) =>
        r.borrowRequestId === requestId &&
        r.reminderDate === date &&
        r.reminderType === type
    );
  }

  function recordReminder(requestId: string, date: string, type: string): void {
    sentReminders.push({
      borrowRequestId: requestId,
      reminderDate: date,
      reminderType: type,
    });
  }

  function parseIdempotencyKey(key: string): { date: string; requestId: string } | null {
    const parts = key.split("_");
    if (parts.length < 3) return null;
    return {
      date: parts[1],
      requestId: parts[2],
    };
  }

  beforeEach(() => {
    sentReminders.length = 0;
  });

  describe("Idempotency Key Parsing", () => {
    it("parses valid idempotency key", () => {
      const key = "overdue_2024-06-15_request123";
      const parsed = parseIdempotencyKey(key);
      expect(parsed).toEqual({
        date: "2024-06-15",
        requestId: "request123",
      });
    });

    it("returns null for invalid key", () => {
      expect(parseIdempotencyKey("invalid")).toBeNull();
      expect(parseIdempotencyKey("only_one")).toBeNull();
    });
  });

  describe("Duplicate Prevention", () => {
    it("allows first reminder for a request/date combo", () => {
      const requestId = "req_001";
      const date = "2024-06-15";
      const type = "overdue";

      expect(hasReminderBeenSent(requestId, date, type)).toBe(false);
      recordReminder(requestId, date, type);
      expect(hasReminderBeenSent(requestId, date, type)).toBe(true);
    });

    it("prevents duplicate reminder for same request/date", () => {
      const requestId = "req_002";
      const date = "2024-06-15";
      const type = "overdue";

      recordReminder(requestId, date, type);

      const canSend = !hasReminderBeenSent(requestId, date, type);
      expect(canSend).toBe(false);
    });

    it("allows reminder for different date", () => {
      const requestId = "req_003";
      const type = "overdue";

      recordReminder(requestId, "2024-06-15", type);

      expect(hasReminderBeenSent(requestId, "2024-06-16", type)).toBe(false);
    });

    it("allows reminder for different request", () => {
      const date = "2024-06-15";
      const type = "overdue";

      recordReminder("req_004", date, type);

      expect(hasReminderBeenSent("req_005", date, type)).toBe(false);
    });

    it("allows different reminder types", () => {
      const requestId = "req_006";
      const date = "2024-06-15";

      recordReminder(requestId, date, "overdue");

      expect(hasReminderBeenSent(requestId, date, "returning_soon")).toBe(false);
    });
  });

  describe("Retry Safety", () => {
    it("multiple retries do not create duplicates", () => {
      const requestId = "req_007";
      const date = "2024-06-15";
      const type = "overdue";

      function processReminder(): boolean {
        if (hasReminderBeenSent(requestId, date, type)) {
          return false;
        }
        recordReminder(requestId, date, type);
        return true;
      }

      expect(processReminder()).toBe(true);
      expect(processReminder()).toBe(false);
      expect(processReminder()).toBe(false);

      const count = sentReminders.filter(
        (r) =>
          r.borrowRequestId === requestId &&
          r.reminderDate === date &&
          r.reminderType === type
      ).length;
      expect(count).toBe(1);
    });
  });
});
