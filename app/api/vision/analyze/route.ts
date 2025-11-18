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

    // -----------------------------
    // BUILD CORRECT MULTIMODAL FORMAT FOR GEMINI
    // -----------------------------
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
- generate commentary
- add markdown or code fences

You MUST return STRICT JSON ONLY with the structure:

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
    "other": ["any visible damage not listed above"]
  },
  "materials": {
    "walls": "material if clearly visible",
    "floors": "material if clearly visible",
    "fixtures": ["materials of fixtures if visible"]
  },
  "labels_or_text": ["any visible writing or labels"],
  "measurements": {
    "relative_size": "very rough relative scale if possible",
    "count_items": "count visible repeated fixtures or elements"
  },
  "location_hint": "best guess where this is (bathroom, kitchen, exterior) ONLY if clearly visible"
}

Return ONLY JSON. Never wrap in backticks. Never write explanations.
`
      },
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              context ||
              "Describe everything visible objectively and output strict JSON only."
          },
          ...media.map((item: any) => ({
            type: "image_url",
            image_url: item.url
          }))
        ]
      }
    ];

    // -----------------------------
    // CALL OPENROUTER API
    // -----------------------------
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
          max_tokens: 6000,
          temperature: 0.1
        })
      }
    );

    const data = await response.json();
    let content = data?.choices?.[0]?.message?.content || "";

    // If response is empty => model rejected image format
    if (!content || content.trim().length === 0) {
      return NextResponse.json(
        {
          error:
            "Gemini returned empty content. Image payload format may be rejected.",
          raw: content
        },
        { status: 500 }
      );
    }

    // -----------------------------
    // CLEAN GARBAGE BEFORE JSON
    // -----------------------------
    // Strip markdown code fences
    content = content
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .replace(/^\s*Here.*?:/gi, "")
      .replace(/^\s*JSON:/gi, "")
      .replace(/^\s*Output:/gi, "")
      .replace(/^\s*Result:/gi, "")
      .replace(/\uFEFF/g, "")
      .trim();

    // Remove everything before the first '{'
    const firstBrace = content.indexOf("{");
    if (firstBrace > 0) {
      content = content.substring(firstBrace);
    }

    // Remove everything after last '}'
    const lastBrace = content.lastIndexOf("}");
    if (lastBrace > 0) {
      content = content.substring(0, lastBrace + 1);
    }

    // -----------------------------
    // PARSE JSON
    // -----------------------------
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      console.error("FAILED RAW CONTENT:");
      console.error(content);

      return NextResponse.json(
        {
          error:
            "Gemini returned content but it was not valid JSON after cleanup.",
          raw: content
        },
        { status: 500 }
      );
    }

    // Success
    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error("Vision Route Error:", err);
    return NextResponse.json(
      { error: err?.message || "Vision analysis failed." },
      { status: 500 }
    );
  }
}
