/// <reference types="node" />
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { timingSafeEqual } from "./model/admin";

const http = httpRouter();

// Webhook endpoint for receiving error reports from OpenClaw bot or other sources
http.route({
  path: "/webhook/report",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      // Fail closed: webhook must be configured
      const webhookSecret = process.env.WEBHOOK_SECRET;
      if (!webhookSecret) {
        return new Response(
          JSON.stringify({ error: "Webhook not configured" }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        );
      }
      const headerSecret = request.headers.get("X-Webhook-Secret") ?? "";
      if (!timingSafeEqual(headerSecret, webhookSecret)) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }

      const body = await request.json() as Record<string, any>;

      // Validate required fields — must be non-empty strings, not just truthy.
      if (typeof body.errorId !== "string" || !body.errorId ||
          typeof body.message !== "string" || !body.message) {
        return new Response(
          JSON.stringify({ error: "Missing required fields: errorId, message" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // Create the report (internal mutation — the webhook secret was verified above).
      // Every field is capped so a malformed/huge payload can't bloat the table.
      const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : undefined);
      const contextJson = body.context === undefined ? undefined : JSON.stringify(body.context);
      const { id: reportId, isNew } = await ctx.runMutation(internal.reports.createReportFromWebhook, {
        errorId: str(body.errorId, 120)!,
        gameId: str(body.gameId, 60),
        playerId: typeof body.playerId === "string" && /^j[a-z0-9]{8,40}$/i.test(body.playerId)
          ? body.playerId as Id<"players">
          : undefined,
        playerName: str(body.playerName, 60),
        errorType: str(body.errorType, 40) || "runtime",
        severity: str(body.severity, 20) || "medium",
        message: str(body.message, 2000)!,
        stackTrace: str(body.stackTrace, 8000),
        context: contextJson === undefined ? undefined
          : contextJson.length <= 4000 ? body.context
          : contextJson.slice(0, 4000),
      });

      // Create Linear issue only for newly created reports (avoid duplicates)
      if (isNew) {
        const linearApiKey = process.env.LINEAR_API_KEY;
        if (linearApiKey) {
          try {
            const linearIssue = await createLinearIssue(body, linearApiKey);
            if (linearIssue) {
              await ctx.runMutation(internal.reports.updateReportWithLinear, {
                errorId: body.errorId,
                linearIssueId: linearIssue.id,
                linearIssueUrl: linearIssue.url,
              });
            }
          } catch (linearError) {
            console.error("Failed to create Linear issue:", linearError);
            // Don't fail the webhook if Linear fails
          }
        }
      }

      return new Response(
        JSON.stringify({ success: true, reportId }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("Webhook error:", error);
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

// Webhook for Linear status updates (optional - if you want Linear to notify back)
http.route({
  path: "/webhook/linear",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    try {
      const linearSecret = process.env.LINEAR_WEBHOOK_SECRET;
      if (!linearSecret) {
        return new Response(
          JSON.stringify({ error: "Webhook not configured" }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        );
      }
      const signature = request.headers.get("linear-signature") ?? "";
      if (!timingSafeEqual(signature, linearSecret)) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { "Content-Type": "application/json" } }
        );
      }

      const body = await request.json() as Record<string, any>;

      // Handle Linear issue status changes
      if (body.action === "update" && body.data?.state?.name === "Done") {
        const issueId = body.data?.id;
        if (issueId) {
          // Find the report by Linear issue ID and mark as resolved
          // This would require a reverse lookup - optional enhancement
        }
      }

      return new Response(
        JSON.stringify({ success: true }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    } catch (error) {
      console.error("Linear webhook error:", error);
      return new Response(
        JSON.stringify({ error: "Internal server error" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }
  }),
});

// Helper function to create Linear issues
async function createLinearIssue(
  report: any,
  apiKey: string
): Promise<{ id: string; url: string } | null> {
  const linearTeamId = process.env.LINEAR_TEAM_ID;
  if (!linearTeamId) {
    console.warn("LINEAR_TEAM_ID not configured, skipping Linear issue creation");
    return null;
  }

  const priority = report.severity === "critical" ? 1 : report.severity === "high" ? 2 : 3;

  const mutation = `
    mutation IssueCreate($input: IssueCreateInput!) {
      issueCreate(input: $input) {
        success
        issue {
          id
          url
          number
        }
      }
    }
  `;

  const projectId = process.env.LINEAR_PROJECT_ID;
  const variables = {
    input: {
      teamId: linearTeamId,
      title: `[${report.gameId || "Unknown"}] ${report.message.substring(0, 80)}`,
      description: buildLinearDescription(report),
      priority,
      labelIds: [],
      ...(projectId ? { projectIds: [projectId] } : {}),
    },
  };

  const response = await fetch("https://api.linear.app/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: apiKey,
    },
    body: JSON.stringify({ query: mutation, variables }),
  });

  const data = await response.json() as any;
  
  if (data.data?.issueCreate?.success) {
    return {
      id: data.data.issueCreate.issue.id,
      url: data.data.issueCreate.issue.url,
    };
  }

  console.error("Linear API error:", data.errors);
  return null;
}

function buildLinearDescription(report: any): string {
  let description = `## Error Report\n\n`;
  description += `**Error ID:** ${report.errorId}\n`;
  description += `**Type:** ${report.errorType}\n`;
  description += `**Severity:** ${report.severity}\n`;
  description += `**Game:** ${report.gameId || "N/A"}\n`;
  description += `**Player:** ${report.playerName || "Anonymous"}\n\n`;
  description += `### Message\n${report.message}\n\n`;
  
  if (report.stackTrace) {
    description += `### Stack Trace\n\`\`\`\n${report.stackTrace}\n\`\`\`\n\n`;
  }
  
  if (report.context) {
    description += `### Context\n\`\`\`json\n${JSON.stringify(report.context, null, 2)}\n\`\`\``;
  }

  return description;
}

export default http;
