import { NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";
import { requireAuthorizedUserId } from "@/lib/authz";

const MAX_PDF_BYTES = 20 * 1024 * 1024;

// Issues short-lived client tokens so PDFs can go straight from the browser
// to Blob storage — never through this (or any) serverless function body,
// which is what was hitting Vercel's request-size limit for large batches.
export async function POST(request: Request) {
  const auth = await requireAuthorizedUserId();
  if (auth.response) return NextResponse.json({ error: auth.response.error }, { status: auth.response.status });

  const body = (await request.json()) as HandleUploadBody;

  try {
    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("reports/")) {
          throw new Error("Invalid upload path");
        }
        return {
          allowedContentTypes: ["application/pdf"],
          addRandomSuffix: false,
          maximumSizeInBytes: MAX_PDF_BYTES,
        };
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Couldn't start the upload" },
      { status: 400 },
    );
  }
}
