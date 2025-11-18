import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { context, media } = await req.json();

    if (!Array.isArray(media) || media.length === 0) {
      return NextResponse.json(
        { error: "No media provided." },
        { status: 400 }
      );
    }

    // Build multimodal Gemini format EXACTLY as required
    const messages = [
      {
        role: "system",
        content: `
You are the CLASS A FIX VISION RECON BRAIN for a property maintenance company.

Your ONLY job is objective reconnaissance of the images provided.

You do NOT:
- diagnose causes
- suggest repairs
- assume anything not explicitly visible
- mention things outside the image frame
- generate extra commentary
- use adjectives that imply severity unless explicitly visible

You MUST return STRICT JSON ONLY with the following structure exactly:

{
  "vision_summary": "One short objective paragraph describing what is visible.",
  "objects": ["list all notable visible objects or fixtures"],
  "hazards": ["anything that may pose a risk"],
  "visible_damage": {
    "cracks": ["list or describe visible cracks"],
    "holes": ["holes or penetrations"],
    "water_damage": ["stains, mould, discoloration"],
    "electrical": ["exposed wires, broken outlets"],
    "plumbing": ["leaks, pipes, moisture"],
    "other": ["any visible damage not in categories above"]
  },
  "materials": {
    "walls": "material if clearly visible",
    "floors": "material if clearly visible",
    "fixtures": ["materials of fixtures if visible"]
  },
  "labels_or_text": ["any visible writing, labels, stickers"],
  "measurements": {
    "relative_size": "very rough relative scale if possible",
    "count_items": "count visible fixtures or repeated elements"
  },
  "location_hint": "best guess where this could be (bathroom, kitchen, exterior) ONLY if clearly visible"
}

ONLY output JSON. No backticks, no commentary, no explanation.

`
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              context ||
              "Describe everything visible with strict objectivity only and output JSON only."
          },
          ...media.map((m: any) => ({
            type: "image_url",
            image_url: m.url
          }))
        ]
      }
    ];

    // Call OpenRouter
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-vision",
          messages,
          max_tokens: 4000,
          temperature: 0.1
        })
      }
    );

    const data = await response.json();
    let content = data?.choices?.[0]?.message?.content || "";

    // If response is empty -> return error
    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        { error: "Gemini returned empty content. Likely invalid image payload." },
        { status: 500 }
      );
    }

    // Strip markdown fences
    content = content
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .trim();

    // Extract JSON only
    const firstBrace = content.indexOf("{");
    const lastBrace = content.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1) {
      return NextResponse.json(
        { er
