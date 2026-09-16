import { internalAction } from "./_generated/server";
import { v } from "convex/values";

/**
 * Notify the site owner that someone signed up and is waiting for
 * approval. Sent via the Resend REST API — no SDK needed.
 *
 * Required env vars on the Convex deployment (dashboard → Settings →
 * Environment Variables, NOT Cloudflare Pages):
 *   RESEND_API_KEY  — Resend API key (domain antoniosmith.xyz is verified)
 *   ADMIN_EMAIL     — where approval requests go
 *
 * If either is missing the email is skipped — signups still queue in the
 * admin panel, so nothing breaks.
 */
export const sendSignupApproval = internalAction({
  args: {
    name: v.string(),
    avatar: v.string(),
    approvalToken: v.string(),
  },
  handler: async (_ctx, args) => {
    const apiKey = process.env.RESEND_API_KEY;
    const adminEmail = process.env.ADMIN_EMAIL;
    if (!apiKey || !adminEmail) {
      console.warn(
        "sendSignupApproval: RESEND_API_KEY or ADMIN_EMAIL not set — " +
        "signup stays pending in the admin panel.",
      );
      return;
    }

    const site = process.env.CONVEX_SITE_URL;
    if (!site) {
      console.error("sendSignupApproval: CONVEX_SITE_URL missing");
      return;
    }
    const approveUrl = `${site}/approve-signup?token=${args.approvalToken}&decision=approve`;
    const rejectUrl = `${site}/approve-signup?token=${args.approvalToken}&decision=reject`;
    const safeName = args.name.replace(/[<>&"]/g, "");

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Noodle Quest <noodle-quest@antoniosmith.xyz>",
        to: [adminEmail],
        subject: `🍜 New player wants in: ${safeName}`,
        html: `
          <div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
            <h2 style="margin:0 0 8px">Someone wants to play 🍜</h2>
            <p style="color:#444;line-height:1.5">
              <strong style="font-size:18px">${args.avatar} ${safeName}</strong><br/>
              just signed up for Noodle Quest and is waiting for your approval.
            </p>
            <p style="margin:24px 0">
              <a href="${approveUrl}" style="background:#3ecf8e;color:#06251a;font-weight:bold;padding:12px 24px;border-radius:12px;text-decoration:none;display:inline-block">✅ Approve</a>
              &nbsp;&nbsp;
              <a href="${rejectUrl}" style="background:#ef5b5b;color:#fff;font-weight:bold;padding:12px 24px;border-radius:12px;text-decoration:none;display:inline-block">🚫 Reject</a>
            </p>
            <p style="color:#888;font-size:12px">
              Each link asks for a confirmation click — email scanners can't
              trigger it by prefetching. You can also manage pending signups
              from the admin panel.
            </p>
          </div>`,
      }),
    });

    if (!res.ok) {
      console.error("sendSignupApproval: Resend failed", res.status, await res.text());
    }
  },
});
