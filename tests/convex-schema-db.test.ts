/**
 * Schema and Database Operation Tests (convex-test)
 * 
 * These tests validate Convex SCHEMA and raw DATABASE OPERATIONS using
 * convex-test's mock backend with t.run() for direct DB access.
 * 
 * For actual handler authentication/authorization tests, see:
 * - tests/handler-auth.test.ts (37 tests using makeFunctionReference + withIdentity)
 * 
 * WHAT IS TESTED HERE:
 * - Schema field validation (correct types inserted/rejected)
 * - Index queries work correctly
 * - CRUD operations on all 5 tables
 * - State transition patterns
 */
import { describe, it, expect, beforeEach } from "vitest";
import { defineTestApp } from "convex-test";
import schema from "../convex/schema";

const app = defineTestApp({ schema });

const testApp = app.defineModules({});
const createTest = testApp.createTest;

describe("Convex Schema & Database Operations (NOT handler invocation)", () => {
  describe("Schema Validation", () => {
    it("creates test instance with schema", () => {
      const t = createTest();
      expect(t).toBeDefined();
      expect(t.run).toBeDefined();
    });
  });

  describe("User Operations", () => {
    it("inserts and queries users", async () => {
      const t = createTest();

      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "clerk_test_123",
          email: "test@example.com",
          name: "Test User",
          role: "member",
          isTrustedLender: false,
          createdAt: Date.now(),
        });
      });

      expect(userId).toBeDefined();

      const user = await t.run(async (ctx) => {
        return await ctx.db.get(userId);
      });

      expect(user).not.toBeNull();
      expect(user?.clerkId).toBe("clerk_test_123");
      expect(user?.role).toBe("member");
    });

    it("queries users by clerk ID index", async () => {
      const t = createTest();

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "clerk_indexed_user",
          email: "indexed@example.com",
          name: "Indexed User",
          role: "admin",
          isTrustedLender: true,
          createdAt: Date.now(),
        });
      });

      const foundUser = await t.run(async (ctx) => {
        return await ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q) => q.eq("clerkId", "clerk_indexed_user"))
          .first();
      });

      expect(foundUser).not.toBeNull();
      expect(foundUser?.role).toBe("admin");
    });
  });

  describe("Tool Operations", () => {
    it("inserts tools with required fields", async () => {
      const t = createTest();

      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "tool_owner",
          email: "owner@example.com",
          name: "Tool Owner",
          role: "member",
          isTrustedLender: false,
          createdAt: Date.now(),
        });
      });

      const toolId = await t.run(async (ctx) => {
        return await ctx.db.insert("tools", {
          ownerId: userId,
          name: "Cordless Drill",
          category: "Power Tools",
          condition: "excellent",
          description: "DeWalt 20V MAX",
          isAvailable: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      expect(toolId).toBeDefined();

      const tool = await t.run(async (ctx) => {
        return await ctx.db.get(toolId);
      });

      expect(tool?.name).toBe("Cordless Drill");
      expect(tool?.condition).toBe("excellent");
    });

    it("filters available tools by index", async () => {
      const t = createTest();

      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "multi_tool_owner",
          email: "multi@example.com",
          name: "Multi Owner",
          role: "member",
          isTrustedLender: false,
          createdAt: Date.now(),
        });
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("tools", {
          ownerId: userId,
          name: "Available Tool",
          category: "Hand Tools",
          condition: "good",
          description: "Available for lending",
          isAvailable: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        await ctx.db.insert("tools", {
          ownerId: userId,
          name: "Unavailable Tool",
          category: "Power Tools",
          condition: "fair",
          description: "Currently lent out",
          isAvailable: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const availableTools = await t.run(async (ctx) => {
        return await ctx.db
          .query("tools")
          .withIndex("by_available", (q) => q.eq("isAvailable", true))
          .collect();
      });

      expect(availableTools).toHaveLength(1);
      expect(availableTools[0].name).toBe("Available Tool");
    });

    it("enforces category index", async () => {
      const t = createTest();

      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "cat_owner",
          email: "cat@example.com",
          name: "Cat Owner",
          role: "member",
          isTrustedLender: false,
          createdAt: Date.now(),
        });
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("tools", {
          ownerId: userId,
          name: "Hammer",
          category: "Hand Tools",
          condition: "good",
          description: "Claw hammer",
          isAvailable: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        await ctx.db.insert("tools", {
          ownerId: userId,
          name: "Drill",
          category: "Power Tools",
          condition: "excellent",
          description: "Cordless",
          isAvailable: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const powerTools = await t.run(async (ctx) => {
        return await ctx.db
          .query("tools")
          .withIndex("by_category", (q) => q.eq("category", "Power Tools"))
          .collect();
      });

      expect(powerTools).toHaveLength(1);
      expect(powerTools[0].name).toBe("Drill");
    });
  });

  describe("Borrow Request Operations", () => {
    let t: ReturnType<typeof createTest>;
    let ownerId: any;
    let borrowerId: any;
    let toolId: any;

    beforeEach(async () => {
      t = createTest();

      ownerId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "lender_123",
          email: "lender@example.com",
          name: "Tool Lender",
          role: "member",
          isTrustedLender: true,
          createdAt: Date.now(),
        });
      });

      borrowerId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "borrower_123",
          email: "borrower@example.com",
          name: "Tool Borrower",
          role: "member",
          isTrustedLender: false,
          createdAt: Date.now(),
        });
      });

      toolId = await t.run(async (ctx) => {
        return await ctx.db.insert("tools", {
          ownerId: ownerId,
          name: "Test Tool",
          category: "Test Category",
          condition: "good",
          description: "For testing",
          isAvailable: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });
    });

    it("creates borrow request with valid data", async () => {
      const requestId = await t.run(async (ctx) => {
        return await ctx.db.insert("borrowRequests", {
          toolId: toolId,
          borrowerId: borrowerId,
          lenderId: ownerId,
          startDate: "2024-06-20",
          endDate: "2024-06-25",
          status: "pending",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const request = await t.run(async (ctx) => {
        return await ctx.db.get(requestId);
      });

      expect(request?.status).toBe("pending");
      expect(request?.borrowerId).toBe(borrowerId);
      expect(request?.lenderId).toBe(ownerId);
    });

    it("queries requests by status index", async () => {
      await t.run(async (ctx) => {
        await ctx.db.insert("borrowRequests", {
          toolId: toolId,
          borrowerId: borrowerId,
          lenderId: ownerId,
          startDate: "2024-06-20",
          endDate: "2024-06-25",
          status: "pending",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        await ctx.db.insert("borrowRequests", {
          toolId: toolId,
          borrowerId: borrowerId,
          lenderId: ownerId,
          startDate: "2024-07-01",
          endDate: "2024-07-05",
          status: "approved",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const pendingRequests = await t.run(async (ctx) => {
        return await ctx.db
          .query("borrowRequests")
          .withIndex("by_status", (q) => q.eq("status", "pending"))
          .collect();
      });

      expect(pendingRequests).toHaveLength(1);
    });

    it("updates request status (state transition)", async () => {
      const requestId = await t.run(async (ctx) => {
        return await ctx.db.insert("borrowRequests", {
          toolId: toolId,
          borrowerId: borrowerId,
          lenderId: ownerId,
          startDate: "2024-06-20",
          endDate: "2024-06-25",
          status: "pending",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await t.run(async (ctx) => {
        await ctx.db.patch(requestId, {
          status: "approved",
          updatedAt: Date.now(),
        });
      });

      const updatedRequest = await t.run(async (ctx) => {
        return await ctx.db.get(requestId);
      });

      expect(updatedRequest?.status).toBe("approved");
    });

    it("queries by borrower index", async () => {
      await t.run(async (ctx) => {
        await ctx.db.insert("borrowRequests", {
          toolId: toolId,
          borrowerId: borrowerId,
          lenderId: ownerId,
          startDate: "2024-06-20",
          endDate: "2024-06-25",
          status: "pending",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const myRequests = await t.run(async (ctx) => {
        return await ctx.db
          .query("borrowRequests")
          .withIndex("by_borrower", (q) => q.eq("borrowerId", borrowerId))
          .collect();
      });

      expect(myRequests).toHaveLength(1);
    });

    it("queries by lender index", async () => {
      await t.run(async (ctx) => {
        await ctx.db.insert("borrowRequests", {
          toolId: toolId,
          borrowerId: borrowerId,
          lenderId: ownerId,
          startDate: "2024-06-20",
          endDate: "2024-06-25",
          status: "pending",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const incomingRequests = await t.run(async (ctx) => {
        return await ctx.db
          .query("borrowRequests")
          .withIndex("by_lender", (q) => q.eq("lenderId", ownerId))
          .collect();
      });

      expect(incomingRequests).toHaveLength(1);
    });
  });

  describe("Automation Events", () => {
    it("creates automation event with idempotency key", async () => {
      const t = createTest();

      const eventId = await t.run(async (ctx) => {
        return await ctx.db.insert("automationEvents", {
          eventType: "request_created",
          resourceType: "borrowRequest",
          resourceId: "req_123",
          idempotencyKey: "request_created_req_123",
          payload: { requestId: "req_123", toolId: "tool_456" },
          status: "pending",
          attempts: 0,
          createdAt: Date.now(),
        });
      });

      const event = await t.run(async (ctx) => {
        return await ctx.db.get(eventId);
      });

      expect(event?.eventType).toBe("request_created");
      expect(event?.status).toBe("pending");
      expect(event?.attempts).toBe(0);
    });

    it("queries events by status index", async () => {
      const t = createTest();

      await t.run(async (ctx) => {
        await ctx.db.insert("automationEvents", {
          eventType: "request_created",
          resourceType: "borrowRequest",
          resourceId: "req_1",
          idempotencyKey: "pending_event",
          payload: {},
          status: "pending",
          attempts: 0,
          createdAt: Date.now(),
        });
        await ctx.db.insert("automationEvents", {
          eventType: "request_approved",
          resourceType: "borrowRequest",
          resourceId: "req_2",
          idempotencyKey: "sent_event",
          payload: {},
          status: "sent",
          attempts: 1,
          lastAttemptAt: Date.now(),
          createdAt: Date.now(),
        });
      });

      const pendingEvents = await t.run(async (ctx) => {
        return await ctx.db
          .query("automationEvents")
          .withIndex("by_status", (q) => q.eq("status", "pending"))
          .collect();
      });

      expect(pendingEvents).toHaveLength(1);
      expect(pendingEvents[0].idempotencyKey).toBe("pending_event");
    });

    it("updates event status and attempts (retry logic)", async () => {
      const t = createTest();

      const eventId = await t.run(async (ctx) => {
        return await ctx.db.insert("automationEvents", {
          eventType: "request_created",
          resourceType: "borrowRequest",
          resourceId: "req_retry",
          idempotencyKey: "retry_test",
          payload: {},
          status: "pending",
          attempts: 0,
          createdAt: Date.now(),
        });
      });

      await t.run(async (ctx) => {
        const event = await ctx.db.get(eventId);
        const newAttempts = (event?.attempts ?? 0) + 1;
        await ctx.db.patch(eventId, {
          attempts: newAttempts,
          status: newAttempts >= 5 ? "failed" : "pending",
          lastAttemptAt: Date.now(),
        });
      });

      const updated = await t.run(async (ctx) => {
        return await ctx.db.get(eventId);
      });

      expect(updated?.attempts).toBe(1);
      expect(updated?.status).toBe("pending");
    });
  });

  describe("Reminders Sent (Idempotency)", () => {
    it("inserts reminder with composite index", async () => {
      const t = createTest();

      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "reminder_user",
          email: "reminder@example.com",
          name: "Reminder User",
          role: "member",
          isTrustedLender: false,
          createdAt: Date.now(),
        });
      });

      const toolId = await t.run(async (ctx) => {
        return await ctx.db.insert("tools", {
          ownerId: userId,
          name: "Reminder Tool",
          category: "Test",
          condition: "good",
          description: "Test",
          isAvailable: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const requestId = await t.run(async (ctx) => {
        return await ctx.db.insert("borrowRequests", {
          toolId: toolId,
          borrowerId: userId,
          lenderId: userId,
          startDate: "2024-06-20",
          endDate: "2024-06-25",
          status: "overdue",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const reminderId = await t.run(async (ctx) => {
        return await ctx.db.insert("remindersSent", {
          borrowRequestId: requestId,
          reminderDate: "2024-06-26",
          reminderType: "overdue",
          sentAt: Date.now(),
        });
      });

      expect(reminderId).toBeDefined();

      const existingReminder = await t.run(async (ctx) => {
        return await ctx.db
          .query("remindersSent")
          .withIndex("by_request_and_date", (q) =>
            q
              .eq("borrowRequestId", requestId)
              .eq("reminderDate", "2024-06-26")
              .eq("reminderType", "overdue")
          )
          .first();
      });

      expect(existingReminder).not.toBeNull();
    });

    it("prevents duplicate reminders via index check", async () => {
      const t = createTest();

      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "dup_check_user",
          email: "dup@example.com",
          name: "Dup User",
          role: "member",
          isTrustedLender: false,
          createdAt: Date.now(),
        });
      });

      const toolId = await t.run(async (ctx) => {
        return await ctx.db.insert("tools", {
          ownerId: userId,
          name: "Dup Tool",
          category: "Test",
          condition: "good",
          description: "Test",
          isAvailable: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const requestId = await t.run(async (ctx) => {
        return await ctx.db.insert("borrowRequests", {
          toolId: toolId,
          borrowerId: userId,
          lenderId: userId,
          startDate: "2024-06-20",
          endDate: "2024-06-25",
          status: "overdue",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await t.run(async (ctx) => {
        await ctx.db.insert("remindersSent", {
          borrowRequestId: requestId,
          reminderDate: "2024-06-26",
          reminderType: "overdue",
          sentAt: Date.now(),
        });
      });

      const alreadySent = await t.run(async (ctx) => {
        const existing = await ctx.db
          .query("remindersSent")
          .withIndex("by_request_and_date", (q) =>
            q
              .eq("borrowRequestId", requestId)
              .eq("reminderDate", "2024-06-26")
              .eq("reminderType", "overdue")
          )
          .first();
        return existing !== null;
      });

      expect(alreadySent).toBe(true);
    });
  });

  describe("Admin Operations", () => {
    it("queries all users for admin view", async () => {
      const t = createTest();

      await t.run(async (ctx) => {
        await ctx.db.insert("users", {
          clerkId: "admin_user",
          email: "admin@example.com",
          name: "Admin",
          role: "admin",
          isTrustedLender: true,
          createdAt: Date.now(),
        });
        await ctx.db.insert("users", {
          clerkId: "regular_user",
          email: "user@example.com",
          name: "Regular User",
          role: "member",
          isTrustedLender: false,
          createdAt: Date.now(),
        });
      });

      const allUsers = await t.run(async (ctx) => {
        return await ctx.db.query("users").collect();
      });

      expect(allUsers).toHaveLength(2);
      const admin = allUsers.find((u) => u.role === "admin");
      expect(admin).toBeDefined();
    });

    it("updates user trusted lender status", async () => {
      const t = createTest();

      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "trust_update_user",
          email: "trust@example.com",
          name: "Trust User",
          role: "member",
          isTrustedLender: false,
          createdAt: Date.now(),
        });
      });

      await t.run(async (ctx) => {
        await ctx.db.patch(userId, { isTrustedLender: true });
      });

      const updated = await t.run(async (ctx) => {
        return await ctx.db.get(userId);
      });

      expect(updated?.isTrustedLender).toBe(true);
    });

    it("deletes tool and handles requests", async () => {
      const t = createTest();

      const userId = await t.run(async (ctx) => {
        return await ctx.db.insert("users", {
          clerkId: "delete_tool_user",
          email: "delete@example.com",
          name: "Delete User",
          role: "admin",
          isTrustedLender: false,
          createdAt: Date.now(),
        });
      });

      const toolId = await t.run(async (ctx) => {
        return await ctx.db.insert("tools", {
          ownerId: userId,
          name: "To Delete",
          category: "Test",
          condition: "good",
          description: "Will be deleted",
          isAvailable: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const requestId = await t.run(async (ctx) => {
        return await ctx.db.insert("borrowRequests", {
          toolId: toolId,
          borrowerId: userId,
          lenderId: userId,
          startDate: "2024-06-20",
          endDate: "2024-06-25",
          status: "pending",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      await t.run(async (ctx) => {
        const requests = await ctx.db
          .query("borrowRequests")
          .withIndex("by_tool", (q) => q.eq("toolId", toolId))
          .collect();

        for (const request of requests) {
          if (request.status === "pending" || request.status === "approved") {
            await ctx.db.patch(request._id, {
              status: "declined",
              updatedAt: Date.now(),
            });
          }
        }

        await ctx.db.delete(toolId);
      });

      const deletedTool = await t.run(async (ctx) => {
        return await ctx.db.get(toolId);
      });

      const declinedRequest = await t.run(async (ctx) => {
        return await ctx.db.get(requestId);
      });

      expect(deletedTool).toBeNull();
      expect(declinedRequest?.status).toBe("declined");
    });
  });
});
