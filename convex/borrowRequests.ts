import { v } from "convex/values";
import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { requireAuth, requireAdmin, canAccessRequest } from "./auth";

function isValidDateRange(startDate: string, endDate: string): boolean {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return start >= today && end >= start;
}

function datesOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
): boolean {
  return start1 <= end2 && end1 >= start2;
}

export const createRequest = mutation({
  args: {
    toolId: v.id("tools"),
    startDate: v.string(),
    endDate: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const tool = await ctx.db.get(args.toolId);

    if (!tool) {
      throw new Error("Tool not found");
    }

    if (!tool.isAvailable) {
      throw new Error("Tool is not available");
    }

    if (tool.ownerId === user._id) {
      throw new Error("You cannot borrow your own tool");
    }

    if (!isValidDateRange(args.startDate, args.endDate)) {
      throw new Error("Invalid date range: start must be today or later, and end must be on or after start");
    }

    const existingRequests = await ctx.db
      .query("borrowRequests")
      .withIndex("by_tool", (q) => q.eq("toolId", args.toolId))
      .filter((q) => q.eq(q.field("status"), "approved"))
      .collect();

    for (const request of existingRequests) {
      if (datesOverlap(args.startDate, args.endDate, request.startDate, request.endDate)) {
        throw new Error("Requested dates overlap with an existing approved loan");
      }
    }

    const requestId = await ctx.db.insert("borrowRequests", {
      toolId: args.toolId,
      borrowerId: user._id,
      lenderId: tool.ownerId,
      startDate: args.startDate,
      endDate: args.endDate,
      status: "pending",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await ctx.db.insert("automationEvents", {
      eventType: "request_created",
      resourceType: "borrowRequest",
      resourceId: requestId,
      idempotencyKey: `request_created_${requestId}`,
      payload: {
        requestId,
        toolId: args.toolId,
        lenderId: tool.ownerId,
      },
      status: "pending",
      attempts: 0,
      createdAt: Date.now(),
    });

    return requestId;
  },
});

export const getMyRequests = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    const requests = await ctx.db
      .query("borrowRequests")
      .withIndex("by_borrower", (q) => q.eq("borrowerId", user._id))
      .collect();

    const enriched = await Promise.all(
      requests.map(async (request) => {
        const tool = await ctx.db.get(request.toolId);
        const lender = await ctx.db.get(request.lenderId);
        return {
          ...request,
          toolName: tool?.name ?? "Unknown",
          toolCategory: tool?.category ?? "Unknown",
          lenderName: lender?.name ?? "Unknown",
        };
      })
    );

    return enriched;
  },
});

export const getIncomingRequests = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    const requests = await ctx.db
      .query("borrowRequests")
      .withIndex("by_lender", (q) => q.eq("lenderId", user._id))
      .collect();

    const enriched = await Promise.all(
      requests.map(async (request) => {
        const tool = await ctx.db.get(request.toolId);
        const borrower = await ctx.db.get(request.borrowerId);
        return {
          ...request,
          toolName: tool?.name ?? "Unknown",
          toolCategory: tool?.category ?? "Unknown",
          borrowerName: borrower?.name ?? "Unknown",
        };
      })
    );

    return enriched;
  },
});

export const approveRequest = mutation({
  args: { requestId: v.id("borrowRequests") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const request = await ctx.db.get(args.requestId);

    if (!request) {
      throw new Error("Request not found");
    }

    if (!canAccessRequest(user, request, "lender")) {
      throw new Error("Forbidden: Only the tool owner can approve requests");
    }

    if (request.status !== "pending") {
      throw new Error("Can only approve pending requests");
    }

    const conflictingRequests = await ctx.db
      .query("borrowRequests")
      .withIndex("by_tool", (q) => q.eq("toolId", request.toolId))
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "approved"),
          q.neq(q.field("_id"), args.requestId)
        )
      )
      .collect();

    for (const existing of conflictingRequests) {
      if (datesOverlap(request.startDate, request.endDate, existing.startDate, existing.endDate)) {
        throw new Error("Cannot approve: dates conflict with another approved loan");
      }
    }

    await ctx.db.patch(args.requestId, {
      status: "approved",
      updatedAt: Date.now(),
    });

    await ctx.db.insert("automationEvents", {
      eventType: "request_approved",
      resourceType: "borrowRequest",
      resourceId: args.requestId,
      idempotencyKey: `request_approved_${args.requestId}_${Date.now()}`,
      payload: {
        requestId: args.requestId,
        borrowerId: request.borrowerId,
      },
      status: "pending",
      attempts: 0,
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

export const declineRequest = mutation({
  args: { requestId: v.id("borrowRequests") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const request = await ctx.db.get(args.requestId);

    if (!request) {
      throw new Error("Request not found");
    }

    if (!canAccessRequest(user, request, "lender")) {
      throw new Error("Forbidden: Only the tool owner can decline requests");
    }

    if (request.status !== "pending") {
      throw new Error("Can only decline pending requests");
    }

    await ctx.db.patch(args.requestId, {
      status: "declined",
      updatedAt: Date.now(),
    });

    await ctx.db.insert("automationEvents", {
      eventType: "request_declined",
      resourceType: "borrowRequest",
      resourceId: args.requestId,
      idempotencyKey: `request_declined_${args.requestId}`,
      payload: {
        requestId: args.requestId,
        borrowerId: request.borrowerId,
      },
      status: "pending",
      attempts: 0,
      createdAt: Date.now(),
    });

    return { success: true };
  },
});

export const markReturned = mutation({
  args: { requestId: v.id("borrowRequests") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const request = await ctx.db.get(args.requestId);

    if (!request) {
      throw new Error("Request not found");
    }

    if (!canAccessRequest(user, request, "lender")) {
      throw new Error("Forbidden: Only the tool owner can mark items as returned");
    }

    if (request.status !== "approved" && request.status !== "overdue") {
      throw new Error("Can only mark approved or overdue loans as returned");
    }

    await ctx.db.patch(args.requestId, {
      status: "returned",
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const getAllLoans = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const requests = await ctx.db.query("borrowRequests").collect();

    const enriched = await Promise.all(
      requests.map(async (request) => {
        const tool = await ctx.db.get(request.toolId);
        const borrower = await ctx.db.get(request.borrowerId);
        const lender = await ctx.db.get(request.lenderId);
        return {
          ...request,
          toolName: tool?.name ?? "Unknown",
          borrowerName: borrower?.name ?? "Unknown",
          lenderName: lender?.name ?? "Unknown",
        };
      })
    );

    return enriched;
  },
});

export const getOverdueLoans = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);

    const today = new Date().toISOString().split("T")[0];

    const approvedLoans = await ctx.db
      .query("borrowRequests")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .collect();

    const overdue = approvedLoans.filter((loan) => loan.endDate < today);

    const enriched = await Promise.all(
      overdue.map(async (loan) => {
        const tool = await ctx.db.get(loan.toolId);
        const borrower = await ctx.db.get(loan.borrowerId);
        return {
          ...loan,
          toolName: tool?.name ?? "Unknown",
          borrowerEmail: borrower?.email ?? "",
          borrowerName: borrower?.name ?? "Unknown",
        };
      })
    );

    return enriched;
  },
});

export const markOverdue = internalMutation({
  args: {
    requestId: v.id("borrowRequests"),
    idempotencyKey: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("remindersSent")
      .withIndex("by_request_and_date", (q) =>
        q
          .eq("borrowRequestId", args.requestId)
          .eq("reminderDate", args.idempotencyKey.split("_")[1] ?? "")
          .eq("reminderType", "overdue")
      )
      .first();

    if (existing) {
      return { alreadySent: true };
    }

    const request = await ctx.db.get(args.requestId);
    if (!request || request.status !== "approved") {
      return { skipped: true, reason: "Not an approved loan" };
    }

    await ctx.db.patch(args.requestId, {
      status: "overdue",
      updatedAt: Date.now(),
    });

    const datePart = args.idempotencyKey.split("_")[1] ?? new Date().toISOString().split("T")[0];
    await ctx.db.insert("remindersSent", {
      borrowRequestId: args.requestId,
      reminderDate: datePart,
      reminderType: "overdue",
      sentAt: Date.now(),
    });

    return { success: true };
  },
});

export const cancelRequest = mutation({
  args: { requestId: v.id("borrowRequests") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const request = await ctx.db.get(args.requestId);

    if (!request) {
      throw new Error("Request not found");
    }

    if (!canAccessRequest(user, request, "borrower")) {
      throw new Error("Forbidden: Only the borrower can cancel their request");
    }

    if (request.status !== "pending") {
      throw new Error("Can only cancel pending requests");
    }

    await ctx.db.delete(args.requestId);
    return { success: true };
  },
});

export const getOverdueLoansInternal = internalQuery({
  args: {},
  handler: async (ctx) => {
    const approvedLoans = await ctx.db
      .query("borrowRequests")
      .withIndex("by_status", (q) => q.eq("status", "approved"))
      .collect();

    const enriched = await Promise.all(
      approvedLoans.map(async (loan) => {
        const tool = await ctx.db.get(loan.toolId);
        const borrower = await ctx.db.get(loan.borrowerId);
        return {
          ...loan,
          toolName: tool?.name ?? "Unknown",
          borrowerEmail: borrower?.email ?? "",
        };
      })
    );

    return enriched;
  },
});
