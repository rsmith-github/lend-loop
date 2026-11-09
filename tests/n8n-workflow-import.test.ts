/**
 * n8n Workflow Import Validation Tests
 * 
 * These tests verify that exported n8n workflow JSON files are valid
 * and have the required structure for n8n import.
 * 
 * VERIFIED: Both workflows successfully import into n8n 2.35.7 with:
 *   $ npx n8n import:workflow --input=n8n-workflows/request-notifications.json
 *   Successfully imported 1 workflow.
 *   
 *   $ npx n8n import:workflow --input=n8n-workflows/overdue-reminders.json
 *   Successfully imported 1 workflow.
 * 
 * EXECUTION requires configured Convex deployment URL and webhook secret.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

interface N8nNode {
  id: string;
  name: string;
  type: string;
  typeVersion: number;
  position: [number, number];
  parameters?: Record<string, any>;
  credentials?: Record<string, any>;
}

interface N8nConnection {
  node: string;
  type: string;
  index: number;
}

interface N8nWorkflow {
  name: string;
  nodes: N8nNode[];
  connections: Record<string, { main?: N8nConnection[][] }>;
  settings?: Record<string, any>;
  staticData?: any;
  tags?: Array<{ name: string }>;
}

function loadWorkflow(filename: string): N8nWorkflow {
  const filepath = path.join(process.cwd(), "n8n-workflows", filename);
  const content = fs.readFileSync(filepath, "utf-8");
  return JSON.parse(content);
}

describe("n8n Workflow Import Validation", () => {
  describe("request-notifications.json", () => {
    let workflow: N8nWorkflow;

    it("parses as valid JSON", () => {
      workflow = loadWorkflow("request-notifications.json");
      expect(workflow).toBeDefined();
    });

    it("has required workflow fields including id", () => {
      workflow = loadWorkflow("request-notifications.json");
      expect((workflow as any).id).toBe("lendloop-request-notifications");
      expect(workflow.name).toBe("LendLoop Request Notifications");
      expect(workflow.nodes).toBeInstanceOf(Array);
      expect(workflow.connections).toBeDefined();
    });

    it("has valid node structure", () => {
      workflow = loadWorkflow("request-notifications.json");
      for (const node of workflow.nodes) {
        expect(node.id).toBeDefined();
        expect(node.name).toBeDefined();
        expect(node.type).toMatch(/^n8n-nodes-base\./);
        expect(node.typeVersion).toBeGreaterThan(0);
        expect(node.position).toHaveLength(2);
      }
    });

    it("has all required node types", () => {
      workflow = loadWorkflow("request-notifications.json");
      const nodeTypes = workflow.nodes.map((n) => n.type);

      expect(nodeTypes).toContain("n8n-nodes-base.scheduleTrigger");
      expect(nodeTypes).toContain("n8n-nodes-base.httpRequest");
      expect(nodeTypes).toContain("n8n-nodes-base.code");
    });

    it("has valid HMAC signing in code nodes", () => {
      workflow = loadWorkflow("request-notifications.json");
      const codeNodes = workflow.nodes.filter(
        (n) => n.type === "n8n-nodes-base.code"
      );

      const signingNode = codeNodes.find((n) =>
        n.parameters?.jsCode?.includes("createHmac")
      );
      expect(signingNode).toBeDefined();
      expect(signingNode?.parameters?.jsCode).toContain("sha256");
      expect(signingNode?.parameters?.jsCode).toContain("$env.N8N_WEBHOOK_SECRET");
    });

    it("references environment variables correctly", () => {
      workflow = loadWorkflow("request-notifications.json");
      const workflowJson = JSON.stringify(workflow);

      expect(workflowJson).toContain("$env.N8N_WEBHOOK_SECRET");
      expect(workflowJson).toContain("$env.CONVEX_HTTP_URL");
      expect(workflowJson).not.toMatch(/sk_[a-zA-Z0-9]+/);
      expect(workflowJson).not.toMatch(/pk_[a-zA-Z0-9]+/);
    });

    it("has properly connected nodes", () => {
      workflow = loadWorkflow("request-notifications.json");
      const nodeNames = new Set(workflow.nodes.map((n) => n.name));

      for (const [sourceName, targets] of Object.entries(workflow.connections)) {
        expect(nodeNames.has(sourceName)).toBe(true);

        if (targets.main) {
          for (const connectionSet of targets.main) {
            for (const conn of connectionSet) {
              expect(nodeNames.has(conn.node)).toBe(true);
            }
          }
        }
      }
    });
  });

  describe("overdue-reminders.json", () => {
    let workflow: N8nWorkflow;

    it("parses as valid JSON", () => {
      workflow = loadWorkflow("overdue-reminders.json");
      expect(workflow).toBeDefined();
    });

    it("has required workflow fields including id", () => {
      workflow = loadWorkflow("overdue-reminders.json");
      expect((workflow as any).id).toBe("lendloop-overdue-reminders");
      expect(workflow.name).toBe("LendLoop Overdue Reminders");
      expect(workflow.nodes).toBeInstanceOf(Array);
      expect(workflow.connections).toBeDefined();
    });

    it("has daily schedule trigger at 9 AM", () => {
      workflow = loadWorkflow("overdue-reminders.json");
      const scheduleTrigger = workflow.nodes.find(
        (n) => n.type === "n8n-nodes-base.scheduleTrigger"
      );

      expect(scheduleTrigger).toBeDefined();
      expect(scheduleTrigger?.parameters?.rule?.interval?.[0]?.triggerAtHour).toBe(9);
    });

    it("has GET signature node for fetching overdue", () => {
      workflow = loadWorkflow("overdue-reminders.json");
      const codeNodes = workflow.nodes.filter(
        (n) => n.type === "n8n-nodes-base.code"
      );

      const getSignNode = codeNodes.find(
        (n) =>
          n.parameters?.jsCode?.includes("createHmac") &&
          n.name === "Compute GET Signature"
      );
      expect(getSignNode).toBeDefined();
    });

    it("has POST signature node for marking overdue", () => {
      workflow = loadWorkflow("overdue-reminders.json");
      const codeNodes = workflow.nodes.filter(
        (n) => n.type === "n8n-nodes-base.code"
      );

      const postSignNode = codeNodes.find(
        (n) =>
          n.parameters?.jsCode?.includes("createHmac") &&
          n.parameters?.jsCode?.includes("body")
      );
      expect(postSignNode).toBeDefined();
    });

    it("has conditional flow for overdue loans", () => {
      workflow = loadWorkflow("overdue-reminders.json");
      const ifNode = workflow.nodes.find((n) => n.type === "n8n-nodes-base.if");
      expect(ifNode).toBeDefined();
      expect(ifNode?.parameters?.conditions?.conditions?.[0]?.leftValue).toContain(
        "overdueLoans"
      );
    });

    it("has HTTP request nodes for Convex API", () => {
      workflow = loadWorkflow("overdue-reminders.json");
      const httpNodes = workflow.nodes.filter(
        (n) => n.type === "n8n-nodes-base.httpRequest"
      );

      const getNode = httpNodes.find((n) => n.parameters?.method === "GET");
      const postNode = httpNodes.find((n) => n.parameters?.method === "POST");

      expect(getNode).toBeDefined();
      expect(postNode).toBeDefined();
      expect(getNode?.parameters?.url).toContain("/api/webhooks/get-overdue");
      expect(postNode?.parameters?.url).toContain("/api/webhooks/overdue-check");
    });

    it("includes proper HMAC headers", () => {
      workflow = loadWorkflow("overdue-reminders.json");
      const httpNodes = workflow.nodes.filter(
        (n) => n.type === "n8n-nodes-base.httpRequest"
      );

      for (const node of httpNodes) {
        const headers = node.parameters?.headerParameters?.parameters;
        if (headers) {
          const headerNames = headers.map((h: any) => h.name);
          expect(headerNames).toContain("x-lendloop-timestamp");
          expect(headerNames).toContain("x-lendloop-signature");
        }
      }
    });

    it("has no hardcoded secrets", () => {
      workflow = loadWorkflow("overdue-reminders.json");
      const workflowJson = JSON.stringify(workflow);

      expect(workflowJson).not.toMatch(/"[a-f0-9]{64}"/);
      expect(workflowJson).not.toMatch(/Bearer\s+[A-Za-z0-9._-]+/);
      expect(workflowJson).not.toMatch(/api[_-]?key["\s]*:["\s]*[^$]/i);
    });
  });

  describe("HMAC Compatibility", () => {
    it("both workflows use compatible signature format", () => {
      const wf1 = loadWorkflow("request-notifications.json");
      const wf2 = loadWorkflow("overdue-reminders.json");

      const getAllCode = (wf: N8nWorkflow) =>
        wf.nodes
          .filter((n) => n.type === "n8n-nodes-base.code")
          .map((n) => n.parameters?.jsCode || "")
          .join("\n");

      const code1 = getAllCode(wf1);
      const code2 = getAllCode(wf2);

      expect(code1).toContain("sha256");
      expect(code2).toContain("sha256");

      expect(code1).toContain("${timestamp}.");
      expect(code2).toContain("${timestamp}.");

      expect(code1).toContain(".digest('hex')");
      expect(code2).toContain(".digest('hex')");
    });
  });
});
