import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

describe("n8n Workflow Schemas", () => {
  const workflowsDir = join(__dirname, "..", "n8n-workflows");

  const workflowFiles = [
    "request-notifications.json",
    "overdue-reminders.json",
  ];

  describe("Workflow Files Exist", () => {
    workflowFiles.forEach((file) => {
      it(`${file} exists`, () => {
        const path = join(workflowsDir, file);
        expect(existsSync(path)).toBe(true);
      });
    });
  });

  describe("Workflow Schema Validation", () => {
    workflowFiles.forEach((file) => {
      const path = join(workflowsDir, file);
      let workflow: any;

      try {
        workflow = JSON.parse(readFileSync(path, "utf-8"));
      } catch {
        workflow = null;
      }

      describe(`${file}`, () => {
        it("is valid JSON", () => {
          expect(workflow).not.toBeNull();
        });

        it("has a name", () => {
          expect(workflow).toHaveProperty("name");
          expect(typeof workflow.name).toBe("string");
        });

        it("has nodes array", () => {
          expect(workflow).toHaveProperty("nodes");
          expect(Array.isArray(workflow.nodes)).toBe(true);
        });

        it("has connections object", () => {
          expect(workflow).toHaveProperty("connections");
          expect(typeof workflow.connections).toBe("object");
        });

        it("has settings object", () => {
          expect(workflow).toHaveProperty("settings");
          expect(typeof workflow.settings).toBe("object");
        });

        it("each node has required properties", () => {
          workflow?.nodes?.forEach((node: any, index: number) => {
            expect(node, `Node ${index} missing id`).toHaveProperty("id");
            expect(node, `Node ${index} missing name`).toHaveProperty("name");
            expect(node, `Node ${index} missing type`).toHaveProperty("type");
            expect(node, `Node ${index} missing position`).toHaveProperty("position");
          });
        });
      });
    });
  });

  describe("No Secrets in Workflow Files", () => {
    workflowFiles.forEach((file) => {
      it(`${file} contains no hardcoded secrets`, () => {
        const path = join(workflowsDir, file);
        const content = readFileSync(path, "utf-8");

        const secretPatterns = [
          /sk_[a-zA-Z0-9]{20,}/,
          /pk_[a-zA-Z0-9]{20,}/,
          /[a-f0-9]{64}/,
          /"password"\s*:\s*"(?!changeme)[^"]+"/,
          /"apiKey"\s*:\s*"[^"]+"/,
          /"secret"\s*:\s*"(?!\$env\.)[^"]+"/i,
        ];

        secretPatterns.forEach((pattern) => {
          const match = content.match(pattern);
          if (match && !match[0].includes("$env.") && !match[0].includes("changeme")) {
            expect(match).toBeNull();
          }
        });
      });
    });
  });

  describe("Environment Variable References", () => {
    workflowFiles.forEach((file) => {
      it(`${file} uses $env for secrets`, () => {
        const path = join(workflowsDir, file);
        const content = readFileSync(path, "utf-8");

        expect(content).toContain("$env.N8N_WEBHOOK_SECRET");
        expect(content).toContain("$env.CONVEX_HTTP_URL");
      });
    });
  });

  describe("Credential References", () => {
    workflowFiles.forEach((file) => {
      it(`${file} does not embed credential values`, () => {
        const path = join(workflowsDir, file);
        const workflow = JSON.parse(readFileSync(path, "utf-8"));

        workflow?.nodes?.forEach((node: any) => {
          if (node.credentials) {
            Object.values(node.credentials).forEach((cred: any) => {
              expect(cred).not.toHaveProperty("password");
              expect(cred).not.toHaveProperty("apiKey");
              expect(cred).not.toHaveProperty("token");
            });
          }
        });
      });
    });
  });
});
