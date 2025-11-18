import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "edge"; // Fast and safe for uploads

export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const filename = searchParams.get("filename");

    if (!filename) {
      return NextResponse.json(
        { error: "Filename is required" },
        { status: 400 }
      );
    }

    // Read uploaded file
    const arrayBuffer = await req.arrayBuffer();
    const fileBytes = new Uint8Array(arrayBuffer);

    // Determine extension
    const extension = filename.split(".").pop() || "jpg";

    // Unique file path inside bucket
    const path = `uploads/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${extension}`;

    // Upload to Supabase bucket "cases"
    const { data, error } = await supabase.storage
      .from("cases")
      .upload(path, fileBytes, {
        contentType: `image/${extension}`,
        upsert: false,
      });

    if (error) {
      console.error("SUPABASE UPLOAD ERROR", error);
      return NextResponse.json(
        { error: "Upload failed: " + error.message },
        { status: 500 }
      );
    }

    // Retrieve Public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("cases").getPublicUrl(path);

    return NextResponse.json({
      url: publicUrl,
      contentType: `image/${extension}`,
    });
  } catch (err: any) {
    console.error("UPLOAD ROUTE ERROR", err);
    return NextResponse.json(
      { error: err?.message || "Upload failed" },
      { status: 500 }
    );
  }
}
