import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { context, media } = await req.json();

    if (!media || !Array.isArray(media) || media.length === 0) {
      return NextResponse.json(
        { error: "No media provided." },
        { status: 400 }
      );
    }

    // Prepare vision inputs
    const images = media.map((item: any) => ({
      type: "input_image",
      image_url: item.url,
    }));

    const messages = [
      {
        role: "system",
        content: `
You are the CLASS A FIX VISION RECON BRAIN.

Your ONLY job is objective reconnaissance, like a military drone pilot describing a target.

NEVER diagnose.
NEVER interpret beyond what is explicitly visible.

You must return STRICT JSON ONLY:
{
  "vision_summary": "...",
  "objects": [...],
  "hazards": [...],
  "visible_damage": {
      "water_present": true/false,
      "water_location": "...",
      "cracks": "...",
      "stains": "...",
      "rust_or_corrosion": "...",
      "swelling_or_warping": "...",
      "other_damage": "..."
  },
  "materials": {
      "surfaces": "...",
      "fittings": "..."
  },
  "labels_or_text": [...],
  "measurements": {
      "approx_leak_spread_cm": "",
      "approx_distance_to_risk_area_cm": ""
  },
  "location_hint": "..."
}

STRICT RULES:
- Be as objective as possible.
- Describe ONLY what is visible.
- Include fine details, textures, stains, shadows, marks, materials.
- No assumptions about causes.
- No troubleshooting.
- No safety or repair advice.
`
      },
      {
        role: "user",
        content: context || "Describe everything visible with maximum objectivity."
      },
      ...images,
    ];

    // Call OpenRouter
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-vision",
        messages,
      }),
    });

    const data = await response.json();
    let content = data?.choices?.[0]?.message?.content || "";

    // Clean triple backticks if present
    content = content.replace(/```json/gi, "").replace(/```/g, "").trim();

    const parsed = JSON.parse(content);

    return NextResponse.json(parsed);

  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Vision analysis failed." },
      { status: 500 }
    );
  }
}
