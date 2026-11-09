import { QueryCtx, MutationCtx } from "./_generated/server";
import { Doc } from "./_generated/dataModel";

export type AuthenticatedUser = Doc<"users">;

export async function getAuthenticatedUser(
  ctx: QueryCtx | MutationCtx
): Promise<AuthenticatedUser | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    return null;
  }

  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
    .unique();

  return user;
}

export async function requireAuth(
  ctx: QueryCtx | MutationCtx
): Promise<AuthenticatedUser> {
  const user = await getAuthenticatedUser(ctx);
  if (!user) {
    throw new Error("Unauthorized: You must be logged in");
  }
  return user;
}

export async function requireAdmin(
  ctx: QueryCtx | MutationCtx
): Promise<AuthenticatedUser> {
  const user = await requireAuth(ctx);
  if (user.role !== "admin") {
    throw new Error("Forbidden: Admin access required");
  }
  return user;
}

export function isOwner(user: AuthenticatedUser, ownerId: string): boolean {
  return user._id.toString() === ownerId.toString();
}

export function canAccessTool(
  user: AuthenticatedUser,
  tool: Doc<"tools">
): boolean {
  return user.role === "admin" || isOwner(user, tool.ownerId.toString());
}

export function canAccessRequest(
  user: AuthenticatedUser,
  request: Doc<"borrowRequests">,
  role: "borrower" | "lender" | "any"
): boolean {
  if (user.role === "admin") return true;

  const isBorrower = user._id.toString() === request.borrowerId.toString();
  const isLender = user._id.toString() === request.lenderId.toString();

  switch (role) {
    case "borrower":
      return isBorrower;
    case "lender":
      return isLender;
    case "any":
      return isBorrower || isLender;
  }
}
