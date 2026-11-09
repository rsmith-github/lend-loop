/**
 * E2E Test Configuration
 * 
 * Checks for required environment variables and provides clear skip/fail
 * behavior when live service credentials are not configured.
 */
import { describe } from "vitest";

export interface E2EConfig {
  clerk: {
    publishableKey: string | undefined;
    secretKey: string | undefined;
    configured: boolean;
  };
  convex: {
    url: string | undefined;
    configured: boolean;
  };
  n8n: {
    webhookSecret: string | undefined;
    convexHttpUrl: string | undefined;
    configured: boolean;
  };
  allConfigured: boolean;
}

export function getE2EConfig(): E2EConfig {
  const clerk = {
    publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
    configured: !!(
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY &&
      process.env.CLERK_SECRET_KEY
    ),
  };

  const convex = {
    url: process.env.NEXT_PUBLIC_CONVEX_URL,
    configured: !!process.env.NEXT_PUBLIC_CONVEX_URL,
  };

  const n8n = {
    webhookSecret: process.env.N8N_WEBHOOK_SECRET,
    convexHttpUrl: process.env.CONVEX_HTTP_URL,
    configured: !!(
      process.env.N8N_WEBHOOK_SECRET &&
      process.env.CONVEX_HTTP_URL
    ),
  };

  return {
    clerk,
    convex,
    n8n,
    allConfigured: clerk.configured && convex.configured && n8n.configured,
  };
}

export function requireConfig(
  config: E2EConfig,
  services: ("clerk" | "convex" | "n8n")[]
): void {
  const missing: string[] = [];

  for (const service of services) {
    if (!config[service].configured) {
      switch (service) {
        case "clerk":
          missing.push(
            "NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY",
            "CLERK_SECRET_KEY"
          );
          break;
        case "convex":
          missing.push("NEXT_PUBLIC_CONVEX_URL");
          break;
        case "n8n":
          missing.push("N8N_WEBHOOK_SECRET", "CONVEX_HTTP_URL");
          break;
      }
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `E2E test requires configuration. Missing environment variables:\n` +
        missing.map((v) => `  - ${v}`).join("\n") +
        `\n\nSet these in .env.local or CI secrets to run live E2E tests.`
    );
  }
}

export function describeWithConfig(
  name: string,
  services: ("clerk" | "convex" | "n8n")[],
  fn: () => void
): void {
  const config = getE2EConfig();
  const missingServices = services.filter((s) => !config[s].configured);

  if (missingServices.length > 0) {
    describe.skip(`${name} (SKIPPED: missing ${missingServices.join(", ")} config)`, fn);
  } else {
    describe(name, fn);
  }
}
