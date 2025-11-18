import { NextResponse } from "next/server";

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
        { error: "Missing context for vision analysis" },
        { status: 400 }
      );
    }

    if (!media || media.length === 0) {
      return NextResponse.json(
        { error: "No media provided for vision analysis" },
        { status: 400 }
      );
    }

    // Only process real images
    const imageMedia = media.filter((m) =>
      (m.contentType || "").toLowerCase().startsWith("image/")
    );

    if (imageMedia.length === 0) {
      return NextResponse.json(
        { error: "No image files available for vision analysis" },
        { status: 400 }
      );
    }

    // Build content EXACTLY like the working repo
    const content: any[] = [
      {
        type: "text",
        text: `
You are a property maintenance visual reconnaissance specialist.

Your job:
- ONLY describe what is visible in the images.
- Be objective, detailed, and neutral.
- Do NOT diagnose or guess causes.
- Do NOT suggest repairs or prices.

Short context about this job:
${context}

Return ONLY VALID JSON:

{
  "vision_summary": "...",
  "objects": [...],
  "visible_damage": {
    "water_present": true,
    "water_location": "",
    "cracks": "",
    "stains": "",
    "rust_or_corrosion": "",
    "swelling_or_warping": "",
    "other_damage": ""
  },
  "hazards": [...],
  "materials": {
    "surfaces": "",
    "fittings": ""
  },
  "labels_or_text": [...],
  "measurements": {
    "approx_leak_spread_cm": "",
    "approx_distance_to_risk_area_cm": ""
  },
  "location_hint": ""
}
`.trim(),
      },

      // IMPORTANT: use the SAME "wrong" format the good repo uses
      ...imageMedia.map((m) => ({
        type: "image_url",
        image_url: { url: m.url }, // THIS IS THE KEY DIFFERENCE!!!
      })),
    ];

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-001",
          temperature: 0.1,
          max_tokens: 1500,
          messages: [
            {
              role: "user",
              content,
            },
          ],
        }),
      }
    );

    const data = await response.json();

    let raw = data?.choices?.[0]?.message?.content || "";

    if (!raw) {
      return NextResponse.json(
        {
          error: "Gemini returned empty content. Check payload.",
          details: data,
        },
        { status: 500 }
      );
    }

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
            error: "Invalid JSON from AI after cleaning",
            raw_original: raw,
            raw_cleaned: cleaned,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(parsed);
  } catch (err: any) {
    return NextResponse.json(
      {
        error: "Server error in vision analysis",
        details: err?.message || String(err),
      },
      { status: 500 }
    );
  }
}
