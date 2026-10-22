// @vitest-environment edge-runtime
import { describe, expect, test } from "vitest";
import { api, internal } from "../../convex/_generated/api";
import { setup } from "./setup";

describe("createReport", () => {
  test("caps every stored field", async () => {
    const t = setup();
    const created = await t.mutation(api.reports.createReport, {
      errorId: "e".repeat(500),
      gameId: "g".repeat(200),
      errorType: "t".repeat(100),
      severity: "s".repeat(80),
      message: "m".repeat(5000),
      stackTrace: "k".repeat(20_000),
      context: { blob: "c".repeat(10_000) },
    });
    const report = await t.run(async ctx => ctx.db.get(created.id));
    expect(report!.errorId).toHaveLength(120);
    expect(report!.gameId).toHaveLength(60);
    expect(report!.errorType).toHaveLength(40);
    expect(report!.severity).toHaveLength(20);
    expect(report!.message).toHaveLength(2000);
    expect(report!.stackTrace).toHaveLength(8000);
    expect(typeof report!.context).toBe("string");
    expect((report!.context as string).length).toBe(4000);

    const again = await t.mutation(api.reports.createReport, {
      errorId: "e".repeat(500),
      errorType: "runtime",
      severity: "low",
      message: "same error",
      context: { ok: true },
    });
    expect(again.isNew).toBe(false);
    const rows = await t.run(async ctx => ctx.db.query("reports").collect());
    expect(rows).toHaveLength(1);
  });
});

describe("purgeOldReports", () => {
  test("deletes reports older than the retention window", async () => {
    const t = setup();
    const old = await t.mutation(api.reports.createReport, {
      errorId: "old", errorType: "runtime", severity: "low", message: "stale",
    });
    const fresh = await t.mutation(api.reports.createReport, {
      errorId: "fresh", errorType: "runtime", severity: "low", message: "new",
    });
    await t.run(async ctx => {
      await ctx.db.patch(old.id, { createdAt: 1 });
    });
    const res = await t.mutation(internal.reports.purgeOldReports, {});
    expect(res.deleted).toBe(1);
    const left = await t.run(async ctx => ctx.db.query("reports").collect());
    expect(left.map(r => r._id)).toEqual([fresh.id]);
  });
});
