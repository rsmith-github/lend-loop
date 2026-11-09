import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAuth, requireAdmin, canAccessTool } from "./auth";

export const listPublicTools = query({
  args: {
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let toolsQuery = ctx.db
      .query("tools")
      .withIndex("by_available", (q) => q.eq("isAvailable", true));

    const tools = await toolsQuery.collect();

    const filtered = args.category
      ? tools.filter((t) => t.category === args.category)
      : tools;

    return filtered.map((tool) => ({
      _id: tool._id,
      name: tool.name,
      category: tool.category,
    }));
  },
});

export const listAvailableTools = query({
  args: {
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAuth(ctx);

    let tools = await ctx.db
      .query("tools")
      .withIndex("by_available", (q) => q.eq("isAvailable", true))
      .collect();

    if (args.category) {
      tools = tools.filter((t) => t.category === args.category);
    }

    const toolsWithOwners = await Promise.all(
      tools.map(async (tool) => {
        const owner = await ctx.db.get(tool.ownerId);
        return {
          ...tool,
          ownerName: owner?.name ?? "Unknown",
          ownerIsTrusted: owner?.isTrustedLender ?? false,
        };
      })
    );

    return toolsWithOwners;
  },
});

export const getToolById = query({
  args: { toolId: v.id("tools") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const tool = await ctx.db.get(args.toolId);

    if (!tool) {
      return null;
    }

    const owner = await ctx.db.get(tool.ownerId);

    return {
      ...tool,
      ownerName: owner?.name ?? "Unknown",
      ownerIsTrusted: owner?.isTrustedLender ?? false,
    };
  },
});

export const getMyListings = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireAuth(ctx);

    return await ctx.db
      .query("tools")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();
  },
});

export const createTool = mutation({
  args: {
    name: v.string(),
    category: v.string(),
    condition: v.union(
      v.literal("excellent"),
      v.literal("good"),
      v.literal("fair"),
      v.literal("poor")
    ),
    description: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);

    const toolId = await ctx.db.insert("tools", {
      ownerId: user._id,
      name: args.name,
      category: args.category,
      condition: args.condition,
      description: args.description,
      isAvailable: true,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return toolId;
  },
});

export const updateTool = mutation({
  args: {
    toolId: v.id("tools"),
    name: v.optional(v.string()),
    category: v.optional(v.string()),
    condition: v.optional(
      v.union(
        v.literal("excellent"),
        v.literal("good"),
        v.literal("fair"),
        v.literal("poor")
      )
    ),
    description: v.optional(v.string()),
    isAvailable: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const tool = await ctx.db.get(args.toolId);

    if (!tool) {
      throw new Error("Tool not found");
    }

    if (!canAccessTool(user, tool)) {
      throw new Error("Forbidden: You can only edit your own tools");
    }

    const { toolId, ...updates } = args;
    const filteredUpdates = Object.fromEntries(
      Object.entries(updates).filter(([_, v]) => v !== undefined)
    );

    await ctx.db.patch(args.toolId, {
      ...filteredUpdates,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});

export const deleteTool = mutation({
  args: { toolId: v.id("tools") },
  handler: async (ctx, args) => {
    const user = await requireAuth(ctx);
    const tool = await ctx.db.get(args.toolId);

    if (!tool) {
      throw new Error("Tool not found");
    }

    if (!canAccessTool(user, tool)) {
      throw new Error("Forbidden: You can only delete your own tools");
    }

    const activeRequests = await ctx.db
      .query("borrowRequests")
      .withIndex("by_tool", (q) => q.eq("toolId", args.toolId))
      .filter((q) =>
        q.or(
          q.eq(q.field("status"), "pending"),
          q.eq(q.field("status"), "approved")
        )
      )
      .first();

    if (activeRequests) {
      throw new Error("Cannot delete tool with active borrow requests");
    }

    await ctx.db.delete(args.toolId);
    return { success: true };
  },
});

export const adminDeleteTool = mutation({
  args: { toolId: v.id("tools") },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const tool = await ctx.db.get(args.toolId);
    if (!tool) {
      throw new Error("Tool not found");
    }

    const requests = await ctx.db
      .query("borrowRequests")
      .withIndex("by_tool", (q) => q.eq("toolId", args.toolId))
      .collect();

    for (const request of requests) {
      if (request.status === "pending" || request.status === "approved") {
        await ctx.db.patch(request._id, {
          status: "declined",
          updatedAt: Date.now(),
        });
      }
    }

    await ctx.db.delete(args.toolId);
    return { success: true };
  },
});

export const getCategories = query({
  args: {},
  handler: async (ctx) => {
    const tools = await ctx.db
      .query("tools")
      .withIndex("by_available", (q) => q.eq("isAvailable", true))
      .collect();
    const categories = [...new Set(tools.map((t) => t.category))];
    return categories.sort();
  },
});
