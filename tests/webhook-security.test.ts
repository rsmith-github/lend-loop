import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createHmac, timingSafeEqual } from "crypto";

describe("Webhook Security", () => {
  const WEBHOOK_SECRET = "test_secret_key_32_bytes_long!!!";
  const MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000;

  function verifySignature(
    payload: string,
    signature: string,
    timestamp: string,
    secret: string
  ): boolean {
    try {
      const message = `${timestamp}.${payload}`;
      const expectedSignature = createHmac("sha256", secret)
        .update(message)
        .digest("hex");

      const sigBuffer = Buffer.from(signature, "hex");
      const expectedBuffer = Buffer.from(expectedSignature, "hex");

      if (sigBuffer.length !== expectedBuffer.length) {
        return false;
      }

      return timingSafeEqual(sigBuffer, expectedBuffer);
    } catch {
      return false;
    }
  }

  function isTimestampValid(timestamp: string, now: number = Date.now()): boolean {
    const ts = parseInt(timestamp, 10);
    if (isNaN(ts)) return false;
    return Math.abs(now - ts) <= MAX_TIMESTAMP_DRIFT_MS;
  }

  function createSignedRequest(payload: string, secret: string) {
    const timestamp = Date.now().toString();
    const message = `${timestamp}.${payload}`;
    const signature = createHmac("sha256", secret).update(message).digest("hex");
    return { payload, timestamp, signature };
  }

  describe("Signature Verification", () => {
    it("accepts valid signature", () => {
      const { payload, timestamp, signature } = createSignedRequest(
        '{"test":"data"}',
        WEBHOOK_SECRET
      );
      expect(verifySignature(payload, signature, timestamp, WEBHOOK_SECRET)).toBe(true);
    });

    it("rejects invalid signature", () => {
      const { payload, timestamp } = createSignedRequest(
        '{"test":"data"}',
        WEBHOOK_SECRET
      );
      const badSignature = "0".repeat(64);
      expect(verifySignature(payload, badSignature, timestamp, WEBHOOK_SECRET)).toBe(false);
    });

    it("rejects tampered payload", () => {
      const { timestamp, signature } = createSignedRequest(
        '{"test":"data"}',
        WEBHOOK_SECRET
      );
      const tamperedPayload = '{"test":"hacked"}';
      expect(verifySignature(tamperedPayload, signature, timestamp, WEBHOOK_SECRET)).toBe(false);
    });

    it("rejects wrong secret", () => {
      const { payload, timestamp, signature } = createSignedRequest(
        '{"test":"data"}',
        WEBHOOK_SECRET
      );
      expect(verifySignature(payload, signature, timestamp, "wrong_secret")).toBe(false);
    });

    it("rejects tampered timestamp", () => {
      const { payload, signature } = createSignedRequest(
        '{"test":"data"}',
        WEBHOOK_SECRET
      );
      const tamperedTimestamp = (Date.now() + 1000).toString();
      expect(verifySignature(payload, signature, tamperedTimestamp, WEBHOOK_SECRET)).toBe(false);
    });

    it("rejects malformed signature", () => {
      const { payload, timestamp } = createSignedRequest(
        '{"test":"data"}',
        WEBHOOK_SECRET
      );
      expect(verifySignature(payload, "not-hex", timestamp, WEBHOOK_SECRET)).toBe(false);
      expect(verifySignature(payload, "", timestamp, WEBHOOK_SECRET)).toBe(false);
    });
  });

  describe("Timestamp Validation (Replay Prevention)", () => {
    it("accepts current timestamp", () => {
      const now = Date.now();
      expect(isTimestampValid(now.toString(), now)).toBe(true);
    });

    it("accepts timestamp within 5 minutes", () => {
      const now = Date.now();
      const fourMinutesAgo = (now - 4 * 60 * 1000).toString();
      expect(isTimestampValid(fourMinutesAgo, now)).toBe(true);
    });

    it("rejects timestamp older than 5 minutes", () => {
      const now = Date.now();
      const sixMinutesAgo = (now - 6 * 60 * 1000).toString();
      expect(isTimestampValid(sixMinutesAgo, now)).toBe(false);
    });

    it("rejects future timestamp beyond 5 minutes", () => {
      const now = Date.now();
      const sixMinutesLater = (now + 6 * 60 * 1000).toString();
      expect(isTimestampValid(sixMinutesLater, now)).toBe(false);
    });

    it("rejects non-numeric timestamp", () => {
      expect(isTimestampValid("not-a-number")).toBe(false);
      expect(isTimestampValid("")).toBe(false);
    });
  });

  describe("Missing Authentication Headers", () => {
    it("should require signature header", () => {
      const hasSignature = (headers: Record<string, string | null>) =>
        headers["x-lendloop-signature"] !== null &&
        headers["x-lendloop-signature"] !== undefined;

      expect(hasSignature({ "x-lendloop-signature": null })).toBe(false);
      expect(hasSignature({})).toBe(false);
      expect(hasSignature({ "x-lendloop-signature": "valid" })).toBe(true);
    });

    it("should require timestamp header", () => {
      const hasTimestamp = (headers: Record<string, string | null>) =>
        headers["x-lendloop-timestamp"] !== null &&
        headers["x-lendloop-timestamp"] !== undefined;

      expect(hasTimestamp({ "x-lendloop-timestamp": null })).toBe(false);
      expect(hasTimestamp({})).toBe(false);
      expect(hasTimestamp({ "x-lendloop-timestamp": "123456" })).toBe(true);
    });
  });
});
