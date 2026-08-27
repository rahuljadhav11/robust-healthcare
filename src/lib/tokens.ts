import { randomBytes } from "crypto";
import { getDb } from "@/db";
import { sendTokens } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export async function createSendToken(messageId: string): Promise<string> {
  const token = randomBytes(24).toString("hex");
  await getDb().insert(sendTokens).values({
    id: crypto.randomUUID(),
    messageId,
    token,
  });
  return token;
}

export async function consumeSendToken(token: string): Promise<{ messageId: string } | null> {
  const db = getDb();
  const [row] = await db.select().from(sendTokens).where(eq(sendTokens.token, token));
  if (!row) return null;

  // fetchCount is kept only as an observability stat now, not an access limit.
  await db
    .update(sendTokens)
    .set({ fetchCount: sql`${sendTokens.fetchCount} + 1` })
    .where(eq(sendTokens.token, token));

  return { messageId: row.messageId };
}
