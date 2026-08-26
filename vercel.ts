import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  // Vercel Hobby plans only allow once-daily cron schedules. This is a
  // safety net in case a batch is queued and nobody clicks "Send now" — the
  // dashboard's send-now button covers same-day sending in the meantime.
  crons: [{ path: "/api/cron/send", schedule: "0 4 * * *" }],
};
