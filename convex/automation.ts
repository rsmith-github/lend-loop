import { v } from "convex/values";
import { internalQuery, internalMutation, query } from "./_generated/server";
import { requireAuth } from "./auth";

export const getPendingEvents = internalQuery({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db
      .query("automationEvents")
      .withIndex("by_status", (q) => q.eq("status", "pending"))
      .filter((q) => q.lt(q.field("attempts"), 5))
      .collect();

    return events.map((event) => ({
      _id: event._id,
      eventType: event.eventType,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      idempotencyKey: event.idempotencyKey,
      payload: event.payload,
      attempts: event.attempts,
    }));
  },
});

export const markEventProcessed = internalMutation({
  args: {
    eventId: v.id("automationEvents"),
    success: v.boolean(),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db.get(args.eventId);
    if (!event) {
      return { error: "Event not found" };
    }

    if (args.success) {
      await ctx.db.patch(args.eventId, {
        status: "sent",
        lastAttemptAt: Date.now(),
      });
    } else {
      const newAttempts = event.attempts + 1;
      await ctx.db.patch(args.eventId, {
        status: newAttempts >= 5 ? "failed" : "pending",
        attempts: newAttempts,
        lastAttemptAt: Date.now(),
      });
    }

    return { success: true };
  },
});

export const getFailedEvents = query({
  args: {},
  handler: async (ctx) => {
    await requireAuth(ctx);

    const events = await ctx.db
      .query("automationEvents")
      .withIndex("by_status", (q) => q.eq("status", "failed"))
      .collect();

    return events.map((event) => ({
      _id: event._id,
      eventType: event.eventType,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      attempts: event.attempts,
      createdAt: event.createdAt,
      lastAttemptAt: event.lastAttemptAt,
    }));
  },
});

export const getAutomationEventsForLoan = query({
  args: { requestId: v.id("borrowRequests") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    const events = await ctx.db
      .query("automationEvents")
      .filter((q) =>
        q.and(
          q.eq(q.field("resourceType"), "borrowRequest"),
          q.eq(q.field("resourceId"), args.requestId)
        )
      )
      .collect();

    return events.map((event) => ({
      _id: event._id,
      eventType: event.eventType,
      status: event.status,
      attempts: event.attempts,
      createdAt: event.createdAt,
      lastAttemptAt: event.lastAttemptAt,
    }));
  },
});

export const getRemindersSentForLoan = query({
  args: { requestId: v.id("borrowRequests") },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    return await ctx.db
      .query("remindersSent")
      .withIndex("by_request_and_date", (q) =>
        q.eq("borrowRequestId", args.requestId)
      )
      .collect();
  },
});
