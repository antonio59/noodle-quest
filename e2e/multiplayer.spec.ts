import { test, expect, type Page } from '@playwright/test';

// Live two-player E2E. Unlike smoke.spec.ts (which aborts all Convex traffic),
// this spec exercises the real backend end to end: signup → invite → join →
// server-authoritative moves observed on both clients.
//
// It is opt-in because it needs a live deployment and creates real players:
//
//   VITE_CONVEX_URL=<dev deployment url> pnpm build
//   NQ_E2E_LIVE=1 NQ_ADMIN_SECRET=<secret> NQ_CONVEX_URL=<dev url> \
//     pnpm playwright test e2e/multiplayer.spec.ts
//
// Signup now requires owner approval, so NQ_ADMIN_SECRET approves the host
// via the admin API — the guest instead signs up through the invite link,
// which auto-approves (the real invitee flow).
//
// Point it at a throwaway dev deployment, never production.
const LIVE = !!process.env.NQ_E2E_LIVE;
const ADMIN_SECRET = process.env.NQ_ADMIN_SECRET ?? '';
const CONVEX_URL = process.env.NQ_CONVEX_URL ?? process.env.VITE_CONVEX_URL ?? '';
test.skip(!LIVE, 'set NQ_E2E_LIVE=1 and build against a dev Convex deployment');
test.skip(!ADMIN_SECRET || !CONVEX_URL, 'set NQ_ADMIN_SECRET and NQ_CONVEX_URL');
test.skip(({ isMobile }) => !!isMobile, 'desktop project only — the flow is device-agnostic');

const RUN = Date.now().toString(36);
const PIN = '246810';

async function convexCall(fn: 'query' | 'mutation', path: string, args: object) {
  const res = await fetch(`${CONVEX_URL}/api/${fn}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path, args, format: 'json' }),
  });
  const data = await res.json();
  if (data.status !== 'success') throw new Error(`${path} failed: ${data.errorMessage}`);
  return data.value;
}

// Direct signup lands on the pending-approval screen; the owner approves
// via the admin API, then the player logs in normally.
async function signUpAndApprove(page: Page, name: string) {
  await page.goto('/auth');
  const newPlayer = page.getByRole('button', { name: /new player/i });
  if (await newPlayer.isVisible({ timeout: 15_000 }).catch(() => false)) {
    await newPlayer.click();
  }
  await page.getByPlaceholder('Your name').fill(name);
  await page.getByPlaceholder('6-digit passcode').fill(PIN);
  await page.getByPlaceholder('Confirm passcode').fill(PIN);
  await page.getByRole('button', { name: /sign up/i }).click();
  await expect(page.getByText(/in the queue/i)).toBeVisible({ timeout: 15_000 });

  const { players } = await convexCall('query', 'auth:adminGetAllPlayers', { adminSecret: ADMIN_SECRET });
  const me = players.find((p: { name: string }) => p.name === name);
  expect(me, `pending player ${name} visible to admin`).toBeTruthy();
  await convexCall('mutation', 'auth:adminApprovePlayer', { playerId: me.id, adminSecret: ADMIN_SECRET });

  // Now log in as the approved player.
  await page.goto('/auth');
  await page.getByRole('button', { name }).click();
  for (const d of PIN) await page.getByRole('button', { name: d, exact: true }).click();
  await page.waitForURL('/', { timeout: 15_000 });
}

function boardCell(page: Page, index: number) {
  const name = `Row ${Math.floor(index / 3) + 1}, column ${(index % 3) + 1}`;
  return page.getByRole('button', { name: new RegExp(`^${name}`) });
}

test('invite flow: two players join and exchange tic-tac-toe moves', async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const pageA = await ctxA.newPage();
  const pageB = await ctxB.newPage();
  const nameA = `e2e-${RUN}-a`;
  const nameB = `e2e-${RUN}-b`;

  try {
    await signUpAndApprove(pageA, nameA);

    // Host opens tic-tac-toe in multiplayer mode from the board-games tab.
    await pageA.goto('/games?tab=board');
    const card = pageA.getByText('Tic-Tac-Toe', { exact: true }).locator('xpath=..');
    await card.getByRole('button', { name: /friends/i }).click();

    // Lobby auto-creates an invite and shows the code.
    const codeEl = pageA.locator('.font-mono').first();
    await expect(codeEl).toBeVisible({ timeout: 15_000 });
    const code = (await codeEl.textContent())?.trim();
    expect(code).toBeTruthy();

    // Guest follows the invite link logged-out → redirected to signup →
    // the invite code auto-approves them (no owner approval needed) →
    // lands back on the invite page and accepts.
    await pageB.goto(`/invite/tic-tac-toe/${code}`);
    await pageB.waitForURL(/\/auth/, { timeout: 15_000 });
    const newPlayer = pageB.getByRole('button', { name: /new player/i });
    if (await newPlayer.isVisible({ timeout: 15_000 }).catch(() => false)) {
      await newPlayer.click();
    }
    await pageB.getByPlaceholder('Your name').fill(nameB);
    await pageB.getByPlaceholder('6-digit passcode').fill(PIN);
    await pageB.getByPlaceholder('Confirm passcode').fill(PIN);
    await pageB.getByRole('button', { name: /sign up/i }).click();
    await pageB.waitForURL(/\/invite\//, { timeout: 15_000 });
    await expect(pageB.getByText(nameA)).toBeVisible({ timeout: 15_000 });
    await pageB.getByRole('button', { name: /accept & play/i }).click();

    // Both sides reach the game's start screen.
    const startA = pageA.getByRole('button', { name: /start game/i });
    const startB = pageB.getByRole('button', { name: /start game/i });
    await expect(startA).toBeVisible({ timeout: 15_000 });
    await expect(startB).toBeVisible({ timeout: 15_000 });
    await startA.click();
    await startB.click();

    // Each player sees the opponent chip.
    await expect(pageA.getByText(`${nameB}: O`)).toBeVisible({ timeout: 15_000 });
    await expect(pageB.getByText(`${nameA}: X`)).toBeVisible({ timeout: 15_000 });

    // Host (seat 1 = X) moves first; guest observes the mark appear.
    await pageA.getByRole('button', { name: 'Row 1, column 1: empty' }).click();
    await expect(boardCell(pageB, 0)).toHaveAccessibleName('Row 1, column 1: X', { timeout: 15_000 });

    // Guest (seat 2 = O) replies; host observes it.
    await pageB.getByRole('button', { name: 'Row 2, column 2: empty' }).click();
    await expect(boardCell(pageA, 4)).toHaveAccessibleName('Row 2, column 2: O', { timeout: 15_000 });

    // Out-of-turn guard: while it's X's turn, O's empty cells stay disabled
    // and the board is unchanged even if the click is forced through.
    await pageB.getByRole('button', { name: 'Row 1, column 2: empty' }).click({ force: true }).catch(() => {});
    await expect(boardCell(pageB, 1)).toHaveAccessibleName('Row 1, column 2: empty');
  } finally {
    await ctxA.close();
    await ctxB.close();
  }
});
