import { NextResponse } from "next/server";
import { requireAuthorizedUserId } from "@/lib/authz";
import { parseEmployeeExcel } from "@/lib/excelParser";

export async function POST(request: Request) {
  const auth = await requireAuthorizedUserId();
  if (auth.response) return NextResponse.json({ error: auth.response.error }, { status: auth.response.status });

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing 'file'" }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    const { rows, errors } = await parseEmployeeExcel(buffer);
    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join("; ") }, { status: 400 });
    }
    return NextResponse.json({ rows });
  } catch (err) {
    return NextResponse.json(
      { error: `Couldn't read that file: ${err instanceof Error ? err.message : String(err)}` },
      { status: 400 },
    );
  }
}
