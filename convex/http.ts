import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { createHmac, timingSafeEqual } from "crypto";

const SIGNATURE_HEADER = "x-lendloop-signature";
const TIMESTAMP_HEADER = "x-lendloop-timestamp";
const MAX_TIMESTAMP_DRIFT_MS = 5 * 60 * 1000;

function verifySignature(
  payload: string,
  signature: string,
  timestamp: string,
  secret: string
): boolean {
  try {
    const message = `${timestamp}.${payload}`;
    const expectedSignature = createHmac("sha256", secret)
      .update(message)
      .digest("hex");

    const sigBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");

    if (sigBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(sigBuffer, expectedBuffer);
  } catch {
    return false;
  }
}

function isTimestampValid(timestamp: string): boolean {
  const ts = parseInt(timestamp, 10);
  if (isNaN(ts)) return false;

  const now = Date.now();
  return Math.abs(now - ts) <= MAX_TIMESTAMP_DRIFT_MS;
}

const http = httpRouter();

http.route({
  path: "/api/webhooks/overdue-check",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = process.env.N8N_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("N8N_WEBHOOK_SECRET not configured");
      return new Response(
        JSON.stringify({ error: "Server misconfigured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const signature = request.headers.get(SIGNATURE_HEADER);
    const timestamp = request.headers.get(TIMESTAMP_HEADER);

    if (!signature || !timestamp) {
      return new Response(
        JSON.stringify({ error: "Missing signature or timestamp" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!isTimestampValid(timestamp)) {
      return new Response(
        JSON.stringify({ error: "Timestamp expired or invalid" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const bodyText = await request.text();

    if (!verifySignature(bodyText, signature, timestamp, webhookSecret)) {
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    let body: { requestId: string; idempotencyKey: string };
    try {
      body = JSON.parse(bodyText);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!body.requestId || !body.idempotencyKey) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    try {
      const result = await ctx.runMutation(internal.borrowRequests.markOverdue, {
        requestId: body.requestId as any,
        idempotencyKey: body.idempotencyKey,
      });

      return new Response(
        JSON.stringify({ success: true, result }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("Error marking overdue:", error);
      return new Response(
        JSON.stringify({ error: "Internal error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

http.route({
  path: "/api/webhooks/get-overdue",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = process.env.N8N_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return new Response(
        JSON.stringify({ error: "Server misconfigured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const signature = request.headers.get(SIGNATURE_HEADER);
    const timestamp = request.headers.get(TIMESTAMP_HEADER);

    if (!signature || !timestamp) {
      return new Response(
        JSON.stringify({ error: "Missing signature or timestamp" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!isTimestampValid(timestamp)) {
      return new Response(
        JSON.stringify({ error: "Timestamp expired or invalid" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const message = `${timestamp}.`;
    if (!verifySignature("", signature, timestamp, webhookSecret)) {
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const today = new Date().toISOString().split("T")[0];

    const approvedLoans = await ctx.runQuery(
      internal.borrowRequests.getOverdueLoansInternal as any
    );

    const overdue = approvedLoans.filter(
      (loan: { endDate: string }) => loan.endDate < today
    );

    return new Response(
      JSON.stringify({
        overdueLoans: overdue.map((loan: any) => ({
          requestId: loan._id,
          toolName: loan.toolName,
          borrowerEmail: loan.borrowerEmail,
          endDate: loan.endDate,
          idempotencyKey: `overdue_${today}_${loan._id}`,
        })),
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }),
});

http.route({
  path: "/api/webhooks/pending-events",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = process.env.N8N_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return new Response(
        JSON.stringify({ error: "Server misconfigured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const signature = request.headers.get(SIGNATURE_HEADER);
    const timestamp = request.headers.get(TIMESTAMP_HEADER);

    if (!signature || !timestamp) {
      return new Response(
        JSON.stringify({ error: "Missing auth headers" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!isTimestampValid(timestamp)) {
      return new Response(
        JSON.stringify({ error: "Timestamp invalid" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!verifySignature("", signature, timestamp, webhookSecret)) {
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const events = await ctx.runQuery(internal.automation.getPendingEvents);

    return new Response(
      JSON.stringify({ events }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }),
});

http.route({
  path: "/api/webhooks/mark-event-sent",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = process.env.N8N_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return new Response(
        JSON.stringify({ error: "Server misconfigured" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    const signature = request.headers.get(SIGNATURE_HEADER);
    const timestamp = request.headers.get(TIMESTAMP_HEADER);

    if (!signature || !timestamp) {
      return new Response(
        JSON.stringify({ error: "Missing auth headers" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!isTimestampValid(timestamp)) {
      return new Response(
        JSON.stringify({ error: "Timestamp invalid" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    const bodyText = await request.text();

    if (!verifySignature(bodyText, signature, timestamp, webhookSecret)) {
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    let body: { eventId: string; success: boolean };
    try {
      body = JSON.parse(bodyText);
    } catch {
      return new Response(
        JSON.stringify({ error: "Invalid JSON" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    await ctx.runMutation(internal.automation.markEventProcessed, {
      eventId: body.eventId as any,
      success: body.success,
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }),
});

export default http;
