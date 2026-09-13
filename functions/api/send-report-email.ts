// Cloudflare Pages Function — replaces netlify/functions/send-report-email.ts.
// Served at /api/send-report-email (and proxied from the legacy
// /.netlify/functions/send-report-email path via public/_redirects).

interface Env {
  REPORT_EMAIL_SECRET?: string;
  ADMIN_EMAIL?: string;
  RESEND_API_KEY?: string;
}

const ALLOWED_ORIGINS = new Set([
  'https://noodle.antoniosmith.xyz',
  'http://localhost:5000',
  'http://127.0.0.1:5000',
]);

function corsHeaders(origin: string): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (ALLOWED_ORIGINS.has(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Vary'] = 'Origin';
  }
  return headers;
}

function json(body: unknown, status: number, origin: string): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: corsHeaders(origin),
  });
}

function clip(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  return value.trim().slice(0, max);
}

// Browsers preflight because of the X-Report-Secret header.
export const onRequestOptions = (context: { request: Request }): Response => {
  const origin = context.request.headers.get('origin') ?? '';
  if (!ALLOWED_ORIGINS.has(origin)) {
    return new Response(null, { status: 403 });
  }
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Report-Secret',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    },
  });
};

export const onRequestPost = async (context: { request: Request; env: Env }): Promise<Response> => {
  const { request: req, env } = context;
  const origin = req.headers.get('origin') ?? '';
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return json({ ok: false, error: 'Forbidden origin' }, 403, origin);
  }

  const reportSecret = env.REPORT_EMAIL_SECRET;
  if (!reportSecret) {
    return json({ ok: false, error: 'Email reports not configured' }, 503, origin);
  }
  const provided = req.headers.get('X-Report-Secret') ?? '';
  if (provided.length !== reportSecret.length) {
    return json({ ok: false, error: 'Unauthorized' }, 401, origin);
  }
  let mismatch = 0;
  for (let i = 0; i < reportSecret.length; i++) {
    mismatch |= provided.charCodeAt(i) ^ reportSecret.charCodeAt(i);
  }
  if (mismatch !== 0) {
    return json({ ok: false, error: 'Unauthorized' }, 401, origin);
  }

  try {
    const body = await req.json() as Record<string, unknown>;
    const gameName = clip(body.gameName, 80) || 'Unknown';
    const playerName = clip(body.playerName, 40) || 'Anonymous';
    const category = clip(body.category, 40) || 'general';
    const description = clip(body.description, 2000);
    if (!description) {
      return json({ ok: false, error: 'Description required' }, 400, origin);
    }

    const adminEmail = env.ADMIN_EMAIL;
    const resendKey = env.RESEND_API_KEY;

    if (!adminEmail || !resendKey) {
      return json({ ok: true, emailed: false }, 200, origin);
    }

    const emailBody = `
Game Issue Report

Game: ${gameName}
Reported by: ${playerName}
Category: ${category}

Description:
${description}

---
View all reports at: https://noodle.antoniosmith.xyz/admin/reports
    `.trim();

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Noodle Quest <reports@noodle.antoniosmith.xyz>',
        to: adminEmail,
        subject: `Game Report: ${gameName} — ${category}`,
        text: emailBody,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('Resend error:', err);
      return json({ ok: false, error: 'Email failed' }, 500, origin);
    }

    return json({ ok: true, emailed: true }, 200, origin);
  } catch (e) {
    console.error('Email function error:', e);
    return json({ ok: false, error: 'Internal error' }, 500, origin);
  }
};

// Pages dispatches to the most specific export (onRequestPost, onRequestOptions);
// this catch-all rejects every other method.
export const onRequest = (): Response => {
  return new Response('Method not allowed', { status: 405 });
};
