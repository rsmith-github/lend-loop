import { internalMutation } from "./_generated/server";

const SYNTHETIC_TOOLS = [
  { name: "Cordless Drill", category: "Power Tools", condition: "excellent" as const, description: "DeWalt 20V MAX cordless drill with extra battery pack. Great for home projects." },
  { name: "Circular Saw", category: "Power Tools", condition: "good" as const, description: "7-1/4 inch circular saw with laser guide. Ideal for straight cuts." },
  { name: "Hammer Drill", category: "Power Tools", condition: "good" as const, description: "Rotary hammer drill for masonry work. Includes various bit sizes." },
  { name: "Lawn Mower", category: "Garden", condition: "fair" as const, description: "Push lawn mower, 21-inch cutting deck. Works well for small to medium yards." },
  { name: "Hedge Trimmer", category: "Garden", condition: "excellent" as const, description: "Electric hedge trimmer with 24-inch blade. Very quiet operation." },
  { name: "Leaf Blower", category: "Garden", condition: "good" as const, description: "Cordless leaf blower, 40V battery included. Great for fall cleanup." },
  { name: "Extension Ladder", category: "Ladders", condition: "good" as const, description: "28-foot aluminum extension ladder. Weight capacity 225 lbs." },
  { name: "Step Ladder", category: "Ladders", condition: "excellent" as const, description: "6-foot fiberglass step ladder. Sturdy and safe for indoor use." },
  { name: "Pressure Washer", category: "Cleaning", condition: "fair" as const, description: "2000 PSI electric pressure washer. Perfect for deck and driveway cleaning." },
  { name: "Wet/Dry Vacuum", category: "Cleaning", condition: "good" as const, description: "16-gallon shop vac with accessories. Handles both wet and dry messes." },
  { name: "Table Saw", category: "Power Tools", condition: "excellent" as const, description: "10-inch portable table saw with folding stand. Professional quality cuts." },
  { name: "Jigsaw", category: "Power Tools", condition: "good" as const, description: "Variable speed jigsaw with LED light. Great for curved cuts." },
  { name: "Wheelbarrow", category: "Garden", condition: "fair" as const, description: "6 cubic foot steel wheelbarrow. Some surface rust but fully functional." },
  { name: "Tile Saw", category: "Power Tools", condition: "good" as const, description: "7-inch wet tile saw. Includes diamond blade and water pump." },
  { name: "Paint Sprayer", category: "Painting", condition: "excellent" as const, description: "HVLP paint sprayer with multiple tips. Gives smooth, professional finish." },
];

export const seedDatabase = internalMutation({
  args: {},
  handler: async (ctx) => {
    const existingTools = await ctx.db.query("tools").first();
    if (existingTools) {
      return { message: "Database already seeded" };
    }

    const demoUser1 = await ctx.db.insert("users", {
      clerkId: "demo_user_alice",
      email: "alice@example.local",
      name: "Alice (Demo)",
      role: "member",
      isTrustedLender: true,
      createdAt: Date.now(),
    });

    const demoUser2 = await ctx.db.insert("users", {
      clerkId: "demo_user_bob",
      email: "bob@example.local",
      name: "Bob (Demo)",
      role: "member",
      isTrustedLender: false,
      createdAt: Date.now(),
    });

    const adminUser = await ctx.db.insert("users", {
      clerkId: "demo_admin",
      email: "admin@example.local",
      name: "Admin (Demo)",
      role: "admin",
      isTrustedLender: true,
      createdAt: Date.now(),
    });

    const owners = [demoUser1, demoUser2, adminUser];

    for (let i = 0; i < SYNTHETIC_TOOLS.length; i++) {
      const tool = SYNTHETIC_TOOLS[i];
      const owner = owners[i % owners.length];

      await ctx.db.insert("tools", {
        ownerId: owner,
        name: tool.name,
        category: tool.category,
        condition: tool.condition,
        description: tool.description,
        isAvailable: true,
        createdAt: Date.now() - i * 86400000,
        updatedAt: Date.now() - i * 86400000,
      });
    }

    return {
      message: "Database seeded with synthetic data",
      users: 3,
      tools: SYNTHETIC_TOOLS.length,
    };
  },
});
