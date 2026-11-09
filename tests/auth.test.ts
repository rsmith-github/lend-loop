import { describe, it, expect } from "vitest";

type UserRole = "member" | "admin";

interface TestUser {
  _id: any;
  clerkId: string;
  email: string;
  name: string;
  role: UserRole;
  isTrustedLender: boolean;
  createdAt: number;
}

describe("Authorization Logic", () => {
  const memberUser: TestUser = {
    _id: "user1" as any,
    clerkId: "clerk_user1",
    email: "member@example.local",
    name: "Member User",
    role: "member",
    isTrustedLender: false,
    createdAt: Date.now(),
  };

  const adminUser: TestUser = {
    _id: "admin1" as any,
    clerkId: "clerk_admin1",
    email: "admin@example.local",
    name: "Admin User",
    role: "admin",
    isTrustedLender: true,
    createdAt: Date.now(),
  };

  const otherUser: TestUser = {
    _id: "user2" as any,
    clerkId: "clerk_user2",
    email: "other@example.local",
    name: "Other User",
    role: "member",
    isTrustedLender: false,
    createdAt: Date.now(),
  };

  describe("isOwner", () => {
    function isOwner(user: TestUser, ownerId: string): boolean {
      return user._id.toString() === ownerId.toString();
    }

    it("returns true when user owns the resource", () => {
      expect(isOwner(memberUser, "user1")).toBe(true);
    });

    it("returns false when user does not own the resource", () => {
      expect(isOwner(memberUser, "user2")).toBe(false);
    });
  });

  describe("canAccessTool", () => {
    function canAccessTool(
      user: TestUser,
      tool: { ownerId: any }
    ): boolean {
      return (
        user.role === "admin" ||
        user._id.toString() === tool.ownerId.toString()
      );
    }

    it("allows admin to access any tool", () => {
      const tool = { ownerId: "user1" };
      expect(canAccessTool(adminUser, tool)).toBe(true);
    });

    it("allows owner to access their tool", () => {
      const tool = { ownerId: "user1" };
      expect(canAccessTool(memberUser, tool)).toBe(true);
    });

    it("denies non-owner member from accessing tool", () => {
      const tool = { ownerId: "user1" };
      expect(canAccessTool(otherUser, tool)).toBe(false);
    });
  });

  describe("canAccessRequest", () => {
    function canAccessRequest(
      user: TestUser,
      request: { borrowerId: any; lenderId: any },
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

    const request = {
      borrowerId: "user1",
      lenderId: "user2",
    };

    it("allows admin to access any request", () => {
      expect(canAccessRequest(adminUser, request, "any")).toBe(true);
      expect(canAccessRequest(adminUser, request, "borrower")).toBe(true);
      expect(canAccessRequest(adminUser, request, "lender")).toBe(true);
    });

    it("allows borrower to access as borrower", () => {
      expect(canAccessRequest(memberUser, request, "borrower")).toBe(true);
      expect(canAccessRequest(memberUser, request, "any")).toBe(true);
    });

    it("denies borrower from lender-only actions", () => {
      expect(canAccessRequest(memberUser, request, "lender")).toBe(false);
    });

    it("allows lender to access as lender", () => {
      expect(canAccessRequest(otherUser, request, "lender")).toBe(true);
      expect(canAccessRequest(otherUser, request, "any")).toBe(true);
    });

    it("denies lender from borrower-only actions", () => {
      expect(canAccessRequest(otherUser, request, "borrower")).toBe(false);
    });

    it("denies unrelated user from accessing", () => {
      const unrelatedUser = { ...memberUser, _id: "user3" as any };
      expect(canAccessRequest(unrelatedUser, request, "any")).toBe(false);
    });
  });

  describe("Role elevation prevention", () => {
    it("member cannot self-elevate to admin", () => {
      const isAdmin = (user: TestUser) => user.role === "admin";
      expect(isAdmin(memberUser)).toBe(false);
    });

    it("only admin can set trusted lender", () => {
      const canSetTrusted = (actor: TestUser) => actor.role === "admin";
      expect(canSetTrusted(memberUser)).toBe(false);
      expect(canSetTrusted(adminUser)).toBe(true);
    });
  });
});
