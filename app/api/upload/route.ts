import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export const runtime = "edge";

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

    const arrayBuffer = await req.arrayBuffer();
    const fileBuffer = new Uint8Array(arrayBuffer);

    // Upload to Supabase Storage bucket "cases"
    const path = `${Date.now()}-${filename}`;

    const { data, error } = await supabase.storage
      .from("cases")
      .upload(path, fileBuffer, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (error) {
      console.error(error);
      return NextResponse.json(
        { error: "Upload failed" },
        { status: 500 }
      );
    }

    // Public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from("cases").getPublicUrl(path);

    return NextResponse.json({
      url: publicUrl,
      contentType: "image/jpeg",
    });
  } catch (err: any) {
    console.error("UPLOAD ERROR", err);
    return NextResponse.json(
      { error: err?.message || "Upload failed" },
      { status: 500 }
    );
  }
}
