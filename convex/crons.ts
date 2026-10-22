import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Sunday 17:00 UTC (6pm UK summer time, 5pm winter) — the family's week in one email.
crons.weekly(
  "weekly family recap",
  { dayOfWeek: "sunday", hourUTC: 17, minuteUTC: 0 },
  internal.recap.sendWeeklyRecap,
);

crons.daily(
  "expire stale signups",
  { hourUTC: 4, minuteUTC: 15 },
  internal.auth.expireStaleSignups,
);

crons.daily(
  "purge old error reports",
  { hourUTC: 4, minuteUTC: 30 },
  internal.reports.purgeOldReports,
);

export default crons;
