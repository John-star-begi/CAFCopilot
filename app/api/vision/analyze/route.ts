import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { media, context } = await req.json();

    const messages = [
      {
        role: "system",
        content: `
You are a maintenance reconnaissance specialist.
Describe EVERYTHING you see in the images objectively.
Do NOT diagnose. Just describe.
Return ONLY valid JSON:
{
 "vision_summary": "...",
 "objects": [...],
 "hazards": [...],
 "visible_damage": {...},
 "materials": {...},
 "labels_or_text": [...],
 "measurements": {...},
 "location_hint": "..."
}
`
      },
      { role: "user", content: context },
      ...media.map((m: any) => ({
        role: "user",
        content: [
          { type: "input_text", text: "Analyze this image" },
          { type: "input_image", image_url: m.url }
        ]
      }))
    ];

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash",
        messages
      })
    });

    const data = await response.json();

    return NextResponse.json(JSON.parse(data.choices[0].message.content));

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
