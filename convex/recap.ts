import { internalAction, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { playerFromSession } from "./model/auth";
import { buildFamilyWeek, renderRecapEmail, type FamilyWeek } from "./model/recap";

/**
 * Weekly family recap: the home-screen card reads getFamilyWeek live; a
 * Sunday cron (crons.ts) emails the same summary to the site owner.
 *
 * Email uses the same Convex env vars as signup approvals:
 *   RESEND_API_KEY, ADMIN_EMAIL — missing either skips the email quietly.
 */

export const getFamilyWeek = query({
  args: { sessionToken: v.string() },
  handler: async (ctx, args): Promise<FamilyWeek | null> => {
    const viewer = await playerFromSession(ctx, args.sessionToken);
    if (!viewer) return null;
    return buildFamilyWeek(ctx, Date.now());
  },
});

export const familyWeekForEmail = internalQuery({
  args: {},
  handler: async (ctx): Promise<FamilyWeek> => buildFamilyWeek(ctx, Date.now()),
});

export const sendWeeklyRecap = internalAction({
  args: {},
  handler: async (ctx) => {
    const apiKey = process.env.RESEND_API_KEY;
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!apiKey || !adminEmail) {
      console.warn("sendWeeklyRecap: RESEND_API_KEY or ADMIN_EMAIL not set — skipping.");
      return;
    }
    const week = await ctx.runQuery(internal.recap.familyWeekForEmail, {});
    const { subject, html } = renderRecapEmail(week);
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: "Noodle Quest <noodle-quest@antoniosmith.xyz>", to: [adminEmail], subject, html }),
    });
    if (!res.ok) console.error("sendWeeklyRecap: Resend failed", res.status, await res.text());
  },
});
