import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs"; // IMPORTANT — Supabase storage only works on Node

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

    // Read file bytes
    const arrayBuffer = await req.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

    // Create unique upload path
    const path = `${Date.now()}-${filename}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from("cases")
      .upload(path, fileBuffer, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (error) {
      console.error("SUPABASE UPLOAD ERROR:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("cases").getPublicUrl(path);

    return NextResponse.json({
      url: publicUrl,
      contentType: "image/jpeg",
    });
  } catch (err: any) {
    console.error("UPLOAD ROUTE ERROR:", err);
    return NextResponse.json(
      { error: err?.message || "Upload failed" },
      { status: 500 }
    );
  }
}
