import { NextResponse } from "next/server";
import { requireAuthorizedUserId } from "@/lib/authz";
import { getDb } from "@/db";
import { clients } from "@/db/schema";
import { desc } from "drizzle-orm";

export async function GET() {
  const auth = await requireAuthorizedUserId();
  if (auth.response) return NextResponse.json({ error: auth.response.error }, { status: auth.response.status });

  const rows = await getDb().select().from(clients).orderBy(desc(clients.createdAt));
  return NextResponse.json({ clients: rows });
}

export async function POST(request: Request) {
  const auth = await requireAuthorizedUserId();
  if (auth.response) return NextResponse.json({ error: auth.response.error }, { status: auth.response.status });

  const { name } = await request.json();
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Client name is required" }, { status: 400 });
  }

  const db = getDb();
  const [client] = await db
    .insert(clients)
    .values({ id: crypto.randomUUID(), name: name.trim() })
    .returning();

  return NextResponse.json({ client });
}
