import { randomBytes } from "crypto";
import { getDb } from "@/db";
import { sendTokens } from "@/db/schema";
import { eq } from "drizzle-orm";

const TOKEN_TTL_MS = 15 * 60 * 1000;
const MAX_FETCHES = 5; // allow a couple of Meta/MSG91 retries, not unlimited reuse

export async function createSendToken(messageId: string): Promise<string> {
  const token = randomBytes(24).toString("hex");
  await getDb().insert(sendTokens).values({
    id: crypto.randomUUID(),
    messageId,
    token,
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
  });
  return token;
}

export async function consumeSendToken(token: string): Promise<{ messageId: string } | null> {
  const db = getDb();
  const [row] = await db.select().from(sendTokens).where(eq(sendTokens.token, token));
  if (!row) return null;
  if (row.expiresAt.getTime() < Date.now()) return null;
  if (row.fetchCount >= MAX_FETCHES) return null;

  await db
    .update(sendTokens)
    .set({ fetchCount: row.fetchCount + 1 })
    .where(eq(sendTokens.token, token));

  return { messageId: row.messageId };
}
