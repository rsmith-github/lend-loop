import { v } from "convex/values";
import { query, mutation, internalMutation } from "./_generated/server";
import { requireAuth, requireAdmin, getAuthenticatedUser } from "./auth";

export const getCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    return await getAuthenticatedUser(ctx);
  },
});

export const getOrCreateUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (existing) {
      return existing;
    }

    const userId = await ctx.db.insert("users", {
      clerkId: identity.subject,
      email: identity.email ?? "",
      name: identity.name ?? identity.email ?? "Anonymous",
      role: "member",
      isTrustedLender: false,
      createdAt: Date.now(),
    });

    return await ctx.db.get(userId);
  },
});

export const setTrustedLender = mutation({
  args: {
    userId: v.id("users"),
    isTrusted: v.boolean(),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const user = await ctx.db.get(args.userId);
    if (!user) {
      throw new Error("User not found");
    }

    await ctx.db.patch(args.userId, {
      isTrustedLender: args.isTrusted,
    });

    return { success: true };
  },
});

export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return await ctx.db.query("users").collect();
  },
});

export const getUserById = query({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const currentUser = await requireAuth(ctx);
    const user = await ctx.db.get(args.userId);

    if (!user) {
      return null;
    }

    if (currentUser.role !== "admin" && currentUser._id !== user._id) {
      return {
        _id: user._id,
        name: user.name,
        isTrustedLender: user.isTrustedLender,
      };
    }

    return user;
  },
});
