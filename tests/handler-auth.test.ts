/**
 * Handler Authentication & Authorization Tests
 * 
 * Tests actual shipped Convex handlers with authentication context using
 * convex-test's withIdentity() and makeFunctionReference().
 * 
 * This validates:
 * - Unauthenticated access denial
 * - Wrong owner denial
 * - Admin role enforcement
 * - Role escalation prevention
 * - Correct owner/admin allow paths
 * - Public query data minimization
 */
import { describe, it, expect, beforeEach } from "vitest";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import schema from "../convex/schema";

// Create function references for actual shipped handlers
const listPublicTools = makeFunctionReference<"query">("tools:listPublicTools");
const listAvailableTools = makeFunctionReference<"query">("tools:listAvailableTools");
const getMyListings = makeFunctionReference<"query">("tools:getMyListings");
const createTool = makeFunctionReference<"mutation">("tools:createTool");
const updateTool = makeFunctionReference<"mutation">("tools:updateTool");
const deleteTool = makeFunctionReference<"mutation">("tools:deleteTool");
const adminDeleteTool = makeFunctionReference<"mutation">("tools:adminDeleteTool");
const getCategories = makeFunctionReference<"query">("tools:getCategories");

const createRequest = makeFunctionReference<"mutation">("borrowRequests:createRequest");
const getMyRequests = makeFunctionReference<"query">("borrowRequests:getMyRequests");
const getIncomingRequests = makeFunctionReference<"query">("borrowRequests:getIncomingRequests");
const approveRequest = makeFunctionReference<"mutation">("borrowRequests:approveRequest");
const declineRequest = makeFunctionReference<"mutation">("borrowRequests:declineRequest");
const markReturned = makeFunctionReference<"mutation">("borrowRequests:markReturned");
const cancelRequest = makeFunctionReference<"mutation">("borrowRequests:cancelRequest");
const getAllLoans = makeFunctionReference<"query">("borrowRequests:getAllLoans");

const getOrCreateUser = makeFunctionReference<"mutation">("users:getOrCreateUser");
const listUsers = makeFunctionReference<"query">("users:listUsers");
const setTrustedLender = makeFunctionReference<"mutation">("users:setTrustedLender");

// Import modules for convexTest - using dynamic import pattern
const modules = import.meta.glob("../convex/**/*.ts");

describe("Handler Authentication Tests", () => {
  let t: ReturnType<typeof convexTest>;
  let ownerUserId: any;
  let otherUserId: any;
  let adminUserId: any;
  let toolId: any;

  beforeEach(async () => {
    t = convexTest(schema, modules);

    // Seed users with t.run (raw DB access for fixtures)
    ownerUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "owner_clerk_id",
        email: "owner@example.com",
        name: "Tool Owner",
        role: "member",
        isTrustedLender: false,
        createdAt: Date.now(),
      });
    });

    otherUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "other_clerk_id",
        email: "other@example.com",
        name: "Other User",
        role: "member",
        isTrustedLender: false,
        createdAt: Date.now(),
      });
    });

    adminUserId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "admin_clerk_id",
        email: "admin@example.com",
        name: "Admin User",
        role: "admin",
        isTrustedLender: true,
        createdAt: Date.now(),
      });
    });

    // Seed a tool owned by owner
    toolId = await t.run(async (ctx) => {
      return await ctx.db.insert("tools", {
        ownerId: ownerUserId,
        name: "Test Drill",
        category: "Power Tools",
        condition: "excellent",
        description: "A test drill for testing",
        isAvailable: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
  });

  describe("Public Query (listPublicTools)", () => {
    it("returns tools without authentication", async () => {
      // No identity - should work
      const tools = await t.query(listPublicTools, {});
      expect(tools).toHaveLength(1);
    });

    it("returns only name and category (data minimization)", async () => {
      const tools = await t.query(listPublicTools, {});
      const tool = tools[0];
      
      expect(tool).toHaveProperty("_id");
      expect(tool).toHaveProperty("name", "Test Drill");
      expect(tool).toHaveProperty("category", "Power Tools");
      
      // Should NOT have private data
      expect(tool).not.toHaveProperty("ownerId");
      expect(tool).not.toHaveProperty("description");
      expect(tool).not.toHaveProperty("condition");
      expect(tool).not.toHaveProperty("ownerName");
    });

    it("filters by category", async () => {
      // Add another tool in different category
      await t.run(async (ctx) => {
        await ctx.db.insert("tools", {
          ownerId: ownerUserId,
          name: "Garden Hose",
          category: "Garden",
          condition: "good",
          description: "A hose",
          isAvailable: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const powerTools = await t.query(listPublicTools, { category: "Power Tools" });
      expect(powerTools).toHaveLength(1);
      expect(powerTools[0].name).toBe("Test Drill");

      const gardenTools = await t.query(listPublicTools, { category: "Garden" });
      expect(gardenTools).toHaveLength(1);
      expect(gardenTools[0].name).toBe("Garden Hose");
    });

    it("excludes unavailable tools", async () => {
      await t.run(async (ctx) => {
        await ctx.db.patch(toolId, { isAvailable: false });
      });

      const tools = await t.query(listPublicTools, {});
      expect(tools).toHaveLength(0);
    });
  });

  describe("Authenticated Query (listAvailableTools)", () => {
    it("denies unauthenticated access", async () => {
      await expect(t.query(listAvailableTools, {})).rejects.toThrow();
    });

    it("allows authenticated member access", async () => {
      const asOwner = t.withIdentity({ subject: "owner_clerk_id" });
      const tools = await asOwner.query(listAvailableTools, {});
      expect(tools).toHaveLength(1);
      expect(tools[0]).toHaveProperty("ownerName");
      expect(tools[0]).toHaveProperty("condition");
      expect(tools[0]).toHaveProperty("description");
    });
  });

  describe("Tool Creation (createTool)", () => {
    it("denies unauthenticated creation", async () => {
      await expect(
        t.mutation(createTool, {
          name: "New Tool",
          category: "Hand Tools",
          condition: "good",
          description: "A new tool",
        })
      ).rejects.toThrow();
    });

    it("allows authenticated member to create tool", async () => {
      const asOwner = t.withIdentity({ subject: "owner_clerk_id" });
      const newToolId = await asOwner.mutation(createTool, {
        name: "New Tool",
        category: "Hand Tools",
        condition: "good",
        description: "A new tool",
      });
      expect(newToolId).toBeDefined();

      // Verify tool was created
      const tool = await t.run(async (ctx) => ctx.db.get(newToolId));
      expect(tool?.name).toBe("New Tool");
      expect(tool?.ownerId).toBe(ownerUserId);
    });
  });

  describe("Tool Update (updateTool)", () => {
    it("denies unauthenticated update", async () => {
      await expect(
        t.mutation(updateTool, { toolId, name: "Hacked Name" })
      ).rejects.toThrow();
    });

    it("denies update by non-owner", async () => {
      const asOther = t.withIdentity({ subject: "other_clerk_id" });
      await expect(
        asOther.mutation(updateTool, { toolId, name: "Stolen Tool" })
      ).rejects.toThrow(/Forbidden|own/i);
    });

    it("allows update by owner", async () => {
      const asOwner = t.withIdentity({ subject: "owner_clerk_id" });
      await asOwner.mutation(updateTool, { toolId, name: "Updated Drill" });

      const tool = await t.run(async (ctx) => ctx.db.get(toolId));
      expect(tool?.name).toBe("Updated Drill");
    });

    it("allows update by admin", async () => {
      const asAdmin = t.withIdentity({ subject: "admin_clerk_id" });
      await asAdmin.mutation(updateTool, { toolId, name: "Admin Updated" });

      const tool = await t.run(async (ctx) => ctx.db.get(toolId));
      expect(tool?.name).toBe("Admin Updated");
    });
  });

  describe("Tool Deletion (deleteTool)", () => {
    it("denies unauthenticated deletion", async () => {
      await expect(t.mutation(deleteTool, { toolId })).rejects.toThrow();
    });

    it("denies deletion by non-owner", async () => {
      const asOther = t.withIdentity({ subject: "other_clerk_id" });
      await expect(
        asOther.mutation(deleteTool, { toolId })
      ).rejects.toThrow(/Forbidden|own/i);
    });

    it("allows deletion by owner", async () => {
      const asOwner = t.withIdentity({ subject: "owner_clerk_id" });
      await asOwner.mutation(deleteTool, { toolId });

      const tool = await t.run(async (ctx) => ctx.db.get(toolId));
      expect(tool).toBeNull();
    });
  });

  describe("Admin Tool Deletion (adminDeleteTool)", () => {
    it("denies access to regular member", async () => {
      const asOwner = t.withIdentity({ subject: "owner_clerk_id" });
      await expect(
        asOwner.mutation(adminDeleteTool, { toolId })
      ).rejects.toThrow(/admin|forbidden/i);
    });

    it("allows admin to delete any tool", async () => {
      const asAdmin = t.withIdentity({ subject: "admin_clerk_id" });
      await asAdmin.mutation(adminDeleteTool, { toolId });

      const tool = await t.run(async (ctx) => ctx.db.get(toolId));
      expect(tool).toBeNull();
    });
  });

  describe("My Listings (getMyListings)", () => {
    it("denies unauthenticated access", async () => {
      await expect(t.query(getMyListings, {})).rejects.toThrow();
    });

    it("returns only user's own tools", async () => {
      const asOwner = t.withIdentity({ subject: "owner_clerk_id" });
      const listings = await asOwner.query(getMyListings, {});
      expect(listings).toHaveLength(1);
      expect(listings[0].name).toBe("Test Drill");

      const asOther = t.withIdentity({ subject: "other_clerk_id" });
      const otherListings = await asOther.query(getMyListings, {});
      expect(otherListings).toHaveLength(0);
    });
  });

  describe("Categories (getCategories)", () => {
    it("returns categories from available tools only", async () => {
      // Add unavailable tool
      await t.run(async (ctx) => {
        await ctx.db.insert("tools", {
          ownerId: ownerUserId,
          name: "Unavailable Item",
          category: "Secret Category",
          condition: "poor",
          description: "Should not appear",
          isAvailable: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });

      const categories = await t.query(getCategories, {});
      expect(categories).toContain("Power Tools");
      expect(categories).not.toContain("Secret Category");
    });
  });
});

describe("Borrow Request Handler Tests", () => {
  let t: ReturnType<typeof convexTest>;
  let lenderId: any;
  let borrowerId: any;
  let adminId: any;
  let toolId: any;
  let requestId: any;

  beforeEach(async () => {
    t = convexTest(schema, modules);

    lenderId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "lender_clerk",
        email: "lender@example.com",
        name: "Lender",
        role: "member",
        isTrustedLender: true,
        createdAt: Date.now(),
      });
    });

    borrowerId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "borrower_clerk",
        email: "borrower@example.com",
        name: "Borrower",
        role: "member",
        isTrustedLender: false,
        createdAt: Date.now(),
      });
    });

    adminId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "admin_clerk",
        email: "admin@example.com",
        name: "Admin",
        role: "admin",
        isTrustedLender: true,
        createdAt: Date.now(),
      });
    });

    toolId = await t.run(async (ctx) => {
      return await ctx.db.insert("tools", {
        ownerId: lenderId,
        name: "Lender's Tool",
        category: "Tools",
        condition: "good",
        description: "For lending",
        isAvailable: true,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    });
  });

  describe("Create Request (createRequest)", () => {
    it("denies unauthenticated request creation", async () => {
      await expect(
        t.mutation(createRequest, {
          toolId,
          startDate: "2030-01-15",
          endDate: "2030-01-20",
        })
      ).rejects.toThrow();
    });

    it("allows authenticated borrower to create request", async () => {
      const asBorrower = t.withIdentity({ subject: "borrower_clerk" });
      requestId = await asBorrower.mutation(createRequest, {
        toolId,
        startDate: "2030-01-15",
        endDate: "2030-01-20",
      });
      expect(requestId).toBeDefined();
    });

    it("denies borrowing own tool", async () => {
      const asLender = t.withIdentity({ subject: "lender_clerk" });
      await expect(
        asLender.mutation(createRequest, {
          toolId,
          startDate: "2030-01-15",
          endDate: "2030-01-20",
        })
      ).rejects.toThrow(/own tool/i);
    });
  });

  describe("Approve Request (approveRequest)", () => {
    beforeEach(async () => {
      requestId = await t.run(async (ctx) => {
        return await ctx.db.insert("borrowRequests", {
          toolId,
          borrowerId,
          lenderId,
          startDate: "2030-01-15",
          endDate: "2030-01-20",
          status: "pending",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });
    });

    it("denies approval by borrower", async () => {
      const asBorrower = t.withIdentity({ subject: "borrower_clerk" });
      await expect(
        asBorrower.mutation(approveRequest, { requestId })
      ).rejects.toThrow(/owner|forbidden/i);
    });

    it("allows approval by lender", async () => {
      const asLender = t.withIdentity({ subject: "lender_clerk" });
      await asLender.mutation(approveRequest, { requestId });

      const request = await t.run(async (ctx) => ctx.db.get(requestId));
      expect(request?.status).toBe("approved");
    });
  });

  describe("Decline Request (declineRequest)", () => {
    beforeEach(async () => {
      requestId = await t.run(async (ctx) => {
        return await ctx.db.insert("borrowRequests", {
          toolId,
          borrowerId,
          lenderId,
          startDate: "2030-01-15",
          endDate: "2030-01-20",
          status: "pending",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });
    });

    it("denies decline by borrower", async () => {
      const asBorrower = t.withIdentity({ subject: "borrower_clerk" });
      await expect(
        asBorrower.mutation(declineRequest, { requestId })
      ).rejects.toThrow(/owner|forbidden/i);
    });

    it("allows decline by lender", async () => {
      const asLender = t.withIdentity({ subject: "lender_clerk" });
      await asLender.mutation(declineRequest, { requestId });

      const request = await t.run(async (ctx) => ctx.db.get(requestId));
      expect(request?.status).toBe("declined");
    });
  });

  describe("Cancel Request (cancelRequest)", () => {
    beforeEach(async () => {
      requestId = await t.run(async (ctx) => {
        return await ctx.db.insert("borrowRequests", {
          toolId,
          borrowerId,
          lenderId,
          startDate: "2030-01-15",
          endDate: "2030-01-20",
          status: "pending",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });
    });

    it("denies cancel by lender", async () => {
      const asLender = t.withIdentity({ subject: "lender_clerk" });
      await expect(
        asLender.mutation(cancelRequest, { requestId })
      ).rejects.toThrow(/borrower|forbidden/i);
    });

    it("allows cancel by borrower", async () => {
      const asBorrower = t.withIdentity({ subject: "borrower_clerk" });
      await asBorrower.mutation(cancelRequest, { requestId });

      const request = await t.run(async (ctx) => ctx.db.get(requestId));
      expect(request).toBeNull();
    });
  });

  describe("Mark Returned (markReturned)", () => {
    beforeEach(async () => {
      requestId = await t.run(async (ctx) => {
        return await ctx.db.insert("borrowRequests", {
          toolId,
          borrowerId,
          lenderId,
          startDate: "2030-01-15",
          endDate: "2030-01-20",
          status: "approved",
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });
    });

    it("denies mark returned by borrower", async () => {
      const asBorrower = t.withIdentity({ subject: "borrower_clerk" });
      await expect(
        asBorrower.mutation(markReturned, { requestId })
      ).rejects.toThrow(/owner|forbidden/i);
    });

    it("allows mark returned by lender", async () => {
      const asLender = t.withIdentity({ subject: "lender_clerk" });
      await asLender.mutation(markReturned, { requestId });

      const request = await t.run(async (ctx) => ctx.db.get(requestId));
      expect(request?.status).toBe("returned");
    });
  });

  describe("Get All Loans - Admin Only (getAllLoans)", () => {
    it("denies access to regular member", async () => {
      const asBorrower = t.withIdentity({ subject: "borrower_clerk" });
      await expect(asBorrower.query(getAllLoans, {})).rejects.toThrow(/admin/i);
    });

    it("allows admin access", async () => {
      const asAdmin = t.withIdentity({ subject: "admin_clerk" });
      const loans = await asAdmin.query(getAllLoans, {});
      expect(loans).toBeDefined();
    });
  });
});

describe("User Management Handler Tests", () => {
  let t: ReturnType<typeof convexTest>;
  let memberId: any;
  let adminId: any;

  beforeEach(async () => {
    t = convexTest(schema, modules);

    memberId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "member_clerk",
        email: "member@example.com",
        name: "Member",
        role: "member",
        isTrustedLender: false,
        createdAt: Date.now(),
      });
    });

    adminId = await t.run(async (ctx) => {
      return await ctx.db.insert("users", {
        clerkId: "admin_clerk",
        email: "admin@example.com",
        name: "Admin",
        role: "admin",
        isTrustedLender: true,
        createdAt: Date.now(),
      });
    });
  });

  describe("List Users (listUsers)", () => {
    it("denies access to regular member", async () => {
      const asMember = t.withIdentity({ subject: "member_clerk" });
      await expect(asMember.query(listUsers, {})).rejects.toThrow(/admin/i);
    });

    it("allows admin access", async () => {
      const asAdmin = t.withIdentity({ subject: "admin_clerk" });
      const users = await asAdmin.query(listUsers, {});
      expect(users).toHaveLength(2);
    });
  });

  describe("Set Trusted Lender (setTrustedLender)", () => {
    it("denies access to regular member (role escalation prevention)", async () => {
      const asMember = t.withIdentity({ subject: "member_clerk" });
      await expect(
        asMember.mutation(setTrustedLender, { userId: memberId, isTrusted: true })
      ).rejects.toThrow(/admin/i);
    });

    it("allows admin to set trusted lender", async () => {
      const asAdmin = t.withIdentity({ subject: "admin_clerk" });
      await asAdmin.mutation(setTrustedLender, { userId: memberId, isTrusted: true });

      const user = await t.run(async (ctx) => ctx.db.get(memberId));
      expect(user?.isTrustedLender).toBe(true);
    });
  });
});
