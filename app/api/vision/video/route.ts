export const runtime = "edge"; // CRITICAL — avoids Webpack bundling

import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { context, media } = await req.json();

    if (!context || !media || media.length === 0) {
      return NextResponse.json(
        { error: "Missing video or context" },
        { status: 400 }
      );
    }

    // Only support mp4 / mov
    const video = media.find((m: any) =>
      ["video/mp4", "video/quicktime"].includes(
        (m.contentType || "").toLowerCase()
      )
    );

    if (!video) {
      return NextResponse.json(
        { error: "No .mp4 or .mov file provided" },
        { status: 400 }
      );
    }

    // --------------------------------------------------------
    // 1. Download video file from Supabase public URL
    // --------------------------------------------------------
    const videoRes = await fetch(video.url);
    const videoBuf = await videoRes.arrayBuffer();
    const videoBytes = new Uint8Array(videoBuf);

    // --------------------------------------------------------
    // 2. Load ffmpeg.wasm (REMOTE CDN + REMOTE ESM IMPORT)
    // --------------------------------------------------------

    // Load ffmpeg library itself via remote ES module
    const { createFFmpeg, fetchFile } = await import(
      "https://esm.sh/@ffmpeg/ffmpeg@0.12.4"
    );

    // Load ffmpeg-core.js via UNPKG (your choice A)
    const ffmpeg = createFFmpeg({
      log: false,
      corePath:
        "https://unpkg.com/@ffmpeg/core@0.12.4/dist/ffmpeg-core.js",
    });

    await ffmpeg.load();

    // --------------------------------------------------------
    // 3. Write video into in-memory FS
    // --------------------------------------------------------
    ffmpeg.FS("writeFile", "input.mp4", await fetchFile(videoBytes));

    // --------------------------------------------------------
    // 4. Extract frames
    // --------------------------------------------------------
    await ffmpeg.run("-i", "input.mp4", "-vf", "fps=2", "frame_%03d.jpg");

    const frames: string[] = [];

    for (let i = 1; i <= 20; i++) {
      const name = `frame_${String(i).padStart(3, "0")}.jpg`;
      try {
        const data = ffmpeg.FS("readFile", name);
        frames.push(
          `data:image/jpeg;base64,${Buffer.from(data).toString("base64")}`
        );
      } catch {
        break;
      }
    }

    if (frames.length === 0) {
      return NextResponse.json(
        { error: "Failed to extract frames from video" },
        { status: 500 }
      );
    }

    // --------------------------------------------------------
    // 5. Prepare Nemotron request
    // --------------------------------------------------------

    const content = [
      {
        type: "text",
        text: `
You are a strict, objective visual reconnaissance system.
Describe ONLY what is visible in the frames.
Do NOT diagnose.
Do NOT guess causes.
Do NOT suggest repairs.
Return ONLY valid JSON.

Context:
${context}

Return JSON with:

{
  "vision_summary": "",
  "objects": [],
  "visible_damage": {},
  "hazards": [],
  "materials": {},
  "labels_or_text": [],
  "measurements": {},
  "movement_signals": {},
  "temporal_patterns": [],
  "location_hint": ""
}
        `.trim(),
      },
      ...frames.map((f) => ({
        type: "image",
        image_url: f,
      })),
    ];

    // --------------------------------------------------------
    // 6. Call Nemotron Nano 2 VL
    // --------------------------------------------------------
    const nemotron = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "nvidia/nemotron-nano-2-vl",
          temperature: 0.1,
          max_tokens: 2000,
          messages: [{ role: "user", content }],
        }),
      }
    );

    const data = await nemotron.json();
    let raw = data?.choices?.[0]?.message?.content || "";

    // --------------------------------------------------------
    // 7. Clean & parse JSON
    // --------------------------------------------------------
    raw = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const first = raw.indexOf("{");
    const last = raw.lastIndexOf("}");
    const json = raw.slice(first, last + 1);

    const parsed = JSON.parse(json);

    // Done
    return NextResponse.json(parsed);
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "Video vision recon failed",
        details: err?.message || String(err),
      },
      { status: 500 }
    );
  }
}
