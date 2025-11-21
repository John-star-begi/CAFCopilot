import { NextResponse } from "next/server";
import { createFFmpeg, fetchFile } from "@ffmpeg/ffmpeg";
import { supabase } from "@/lib/supabase";

export const runtime = "nodejs";

// Only accept mp4 and mov
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/quicktime"];

type MediaItem = {
  url: string;
  contentType?: string;
};

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const context: string = body.context || "";
    const media: MediaItem[] = body.media || [];

    if (!context.trim()) {
      return NextResponse.json(
        { error: "Missing context for video analysis" },
        { status: 400 }
      );
    }

    if (!media || media.length === 0) {
      return NextResponse.json(
        { error: "No media provided for video analysis" },
        { status: 400 }
      );
    }

    const videoMedia = media.filter(
      (m) =>
        m.contentType &&
        ALLOWED_VIDEO_TYPES.includes(m.contentType.toLowerCase())
    );

    if (videoMedia.length === 0) {
      return NextResponse.json(
        {
          error:
            "No valid video files (.mp4 or .mov) found for analysis.",
        },
        { status: 400 }
      );
    }

    const videoUrl = videoMedia[0].url;

    // Download raw video data from Supabase public URL
    const videoRes = await fetch(videoUrl);
    const videoBuffer = await videoRes.arrayBuffer();
    const videoUint8 = new Uint8Array(videoBuffer);

    // Load FFmpeg WASM
    const ffmpeg = createFFmpeg({ log: false });
    await ffmpeg.load();

    // Feed into FFmpeg virtual FS
    ffmpeg.FS("writeFile", "input.mp4", await fetchFile(videoUint8));

    // Extract frames ~2 FPS (EVS-like)
    await ffmpeg.run(
      "-i",
      "input.mp4",
      "-vf",
      "fps=2",
      "frame_%03d.jpg"
    );

    // Collect up to 20 frames
    const framesBase64: string[] = [];

    for (let i = 1; i <= 20; i++) {
      const fileName = `frame_${String(i).padStart(3, "0")}.jpg`;

      try {
        const frame = ffmpeg.FS("readFile", fileName);
        framesBase64.push(
          `data:image/jpeg;base64,${Buffer.from(frame).toString("base64")}`
        );
      } catch {
        break;
      }
    }

    if (framesBase64.length === 0) {
      return NextResponse.json(
        {
          error: "Failed to extract frames from video",
          details: "FFmpeg returned 0 usable frames",
        },
        { status: 500 }
      );
    }

    // Build Nemotron request content
    const content: any[] = [
      {
        type: "text",
        text: `
You are a property maintenance visual reconnaissance specialist.

Your job:
- ONLY describe what is visible in the frames.
- ABSOLUTELY NO DIAGNOSIS.
- NO assumptions about causes.
- NO repair ideas.
- NO pricing.
- Just objective, crystal-clear reconnaissance.

Context about this job:
${context}

Return ONLY valid JSON:

{
  "vision_summary": "",
  "objects": [],
  "visible_damage": {
    "water_present": false,
    "water_location": "",
    "cracks": "",
    "stains": "",
    "rust_or_corrosion": "",
    "swelling_or_warping": "",
    "other_damage": ""
  },
  "hazards": [],
  "materials": {
    "surfaces": "",
    "fittings": ""
  },
  "labels_or_text": [],
  "measurements": {
    "approx_leak_spread_cm": "",
    "approx_distance_to_risk_area_cm": ""
  },
  "movement_signals": {
    "drip_rate": "",
    "flicker_frequency": "",
    "vibration_detected": "",
    "movement_pattern": ""
  },
  "temporal_patterns": [],
  "location_hint": ""
}
`.trim(),
      },

      ...framesBase64.map((img) => ({
        type: "image",
        image_url: img,
      })),
    ];

    // Call Nemotron Vision
    const nemotronRes = await fetch(
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
          messages: [
            {
              role: "user",
              content,
            },
          ],
        }),
      }
    );

    const nemotronData = await nemotronRes.json();

    let raw = nemotronData?.choices?.[0]?.message?.content || "";

    if (!raw) {
      return NextResponse.json(
        {
          error: "Nemotron returned empty content",
          details: nemotronData,
        },
        { status: 500 }
      );
    }

    // Try parse JSON
    let parsed;

    try {
      parsed = JSON.parse(raw);
    } catch {
      let cleaned = raw
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

      const fb = cleaned.indexOf("{");
      if (fb > 0) cleaned = cleaned.slice(fb);

      const lb = cleaned.lastIndexOf("}");
      if (lb > 0) cleaned = cleaned.slice(0, lb + 1);

      try {
        parsed = JSON.parse(cleaned);
      } catch {
        return NextResponse.json(
          {
            error: "Invalid JSON after cleanup",
            raw_original: raw,
            raw_cleaned: cleaned,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error("VIDEO VISION ERROR:", err);
    return NextResponse.json(
      {
        error: "Server error in video analysis",
        details: err?.message || String(err),
      },
      { status: 500 }
    );
  }
}
