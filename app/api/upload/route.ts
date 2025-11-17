import { NextResponse } from "next/server";
import { put } from "@vercel/blob";

export const runtime = "edge"; // Faster + cheaper execution

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const filename = searchParams.get("filename");

    if (!filename) {
      return NextResponse.json(
        { error: "Missing ?filename= query" },
        { status: 400 }
      );
    }

    // Read the file binary
    const fileBuffer = await req.arrayBuffer();
    const fileBytes = new Uint8Array(fileBuffer);

    // Upload to Vercel Blob
    const blob = await put(filename, fileBytes, {
      access: "public",
    });

    return NextResponse.json({
      url: blob.url,
      pathname: blob.pathname,
      contentType: blob.contentType,
      size: blob.size,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Upload failed." },
      { status: 500 }
    );
  }
}
