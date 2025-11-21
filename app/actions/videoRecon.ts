"use server";

import { createFFmpeg, fetchFile } from "@ffmpeg/ffmpeg";
import { supabase } from "@/lib/supabase";

export async function analyzeVideoOnServer(caseId: string, file: File, context: string) {
  try {
    // Convert file into ArrayBuffer
    const videoBuf = await file.arrayBuffer();
    const videoUint8 = new Uint8Array(videoBuf);

    // Load ffmpeg wasm at runtime (no bundling)
    const ffmpeg = createFFmpeg({ log: false });
    await ffmpeg.load();

    // Write video into FFmpeg FS
    ffmpeg.FS("writeFile", "input.mp4", await fetchFile(videoUint8));

    // Extract frames from video
    await ffmpeg.run("-i", "input.mp4", "-vf", "fps=2", "frame_%03d.jpg");

    // Collect up to 20 frames
    const framesBase64: string[] = [];

    for (let i = 1; i <= 20; i++) {
      const fname = `frame_${String(i).padStart(3, "0")}.jpg`;
      try {
        const data = ffmpeg.FS("readFile", fname);
        framesBase64.push(
          `data:image/jpeg;base64,${Buffer.from(data).toString("base64")}`
        );
      } catch {
        break;
      }
    }

    if (framesBase64.length === 0) {
      throw new Error("FFmpeg extracted 0 frames from video");
    }

    // Build Nemotron prompt
    const content = [
      {
        type: "text",
        text: `
You are a property maintenance visual reconnaissance specialist.
Only describe what is VISIBLE in the frames.
No diagnosis.
No assumptions.
No repair suggestions.
Return ONLY valid JSON.

Context:
${context}

JSON structure:
{
  "vision_summary": "",
  "objects": [],
  "visible_damage": { },
  "hazards": [],
  "materials": { },
  "labels_or_text": [],
  "measurements": { },
  "movement_signals": { },
  "temporal_patterns": [],
  "location_hint": ""
}
`
      },
      ...framesBase64.map((img) => ({
        type: "image",
        image_url: img,
      })),
    ];

    // Call Nemotron
    const resp = await fetch("https://openrouter.ai/api/v1/chat/completions", {
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
    });

    const data = await resp.json();
    let raw = data?.choices?.[0]?.message?.content || "";

    // Clean JSON
    raw = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    const cleaned = raw.slice(firstBrace, lastBrace + 1);

    const parsed = JSON.parse(cleaned);

    // Save into Supabase
    await supabase
      .from("cases")
      .update({
        vision: parsed,
        status: "visioned",
      })
      .eq("id", caseId);

    return parsed;

  } catch (err: any) {
    return {
      error: "Video analysis failed",
      details: err?.message || String(err),
    };
  }
}
