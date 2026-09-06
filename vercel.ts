import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  // Vercel Hobby plans only allow once-daily cron schedules. This is a
  // safety net in case a batch is queued and nobody clicks "Send now" — the
  // dashboard's send-now button covers same-day sending in the meantime.
  crons: [
    { path: "/api/cron/send", schedule: "0 4 * * *" },
    // Dry-run only — logs what a 90-day report retention policy would
    // delete, without deleting anything. See api/cron/expire-reports.
    { path: "/api/cron/expire-reports", schedule: "0 5 * * *" },
  ],
};
