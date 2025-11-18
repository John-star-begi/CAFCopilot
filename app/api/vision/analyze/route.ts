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

    // Build Gemini Vision-compatible message
    const messages = [
      {
        role: "system",
        content: `
You are the CLASS A FIX VISION RECON BRAIN.
Your ONLY job is objective reconnaissance.

STRICT RULES:
- Only visible details
- No diagnosis
- No causes
- No repair suggestions
- No assumptions
- No filler wording

Return STRICT JSON ONLY:
{
  "vision_summary": "...",
  "objects": [...],
  "hazards": [...],
  "visible_damage": { ... },
  "materials": { ... },
  "labels_or_text": [...],
  "measurements": { ... },
  "location_hint": "..."
}
`
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text:
              context ||
              "Describe everything visible in the images objectively."
          },

          // Attach all images correctly for Gemini
          ...media.map((item: any) => ({
            type: "input_image",
            image_url: item.url
          }))
        ]
      }
    ];

    // Call OpenRouter AI
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
          max_tokens: 5000,
          temperature: 0.1,
          bias: {
            "```": -5,
            "`": -2
          }
        })
      }
    );

    const data = await response.json();

    let content =
      data?.choices?.[0]?.message?.content?.trim() || "";

    // -------------------------------
    // CLEAN GARBAGE BEFORE JSON
    // -------------------------------
    // Remove markdown fences
    content = content
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .replace(/^\s*Here.*?:/gi, "")
      .replace(/^\s*JSON:/gi, "")
      .replace(/^\s*Result:/gi, "")
      .replace(/\uFEFF/g, "")
      .trim();

    // Remove anything BEFORE the first '{'
    if (content.includes("{")) {
      content = content.substring(content.indexOf("{"));
    }

    // Remove anything AFTER the final '}'
    if (content.lastIndexOf("}") !== -1) {
      content = content.substring(0, content.lastIndexOf("}") + 1);
    }

    // Try to parse JSON
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (err) {
      console.error("❌ FAILED RAW CONTENT");
      console.error(content);

      return NextResponse.json(
        {
          error: "Invalid JSON from Vision model.",
          raw: content
        },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err?.message || "Vision analysis failed." },
      { status: 500 }
    );
  }
}
