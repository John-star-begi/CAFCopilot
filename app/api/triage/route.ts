import { NextResponse } from "next/server";

export const runtime = "edge";

export async function POST(req: Request) {
  try {
    const { description } = await req.json();

    if (!description || !description.trim()) {
      return NextResponse.json(
        { error: "Missing description" },
        { status: 400 }
      );
    }

    const body = {
      model: "meta-llama/llama-3.3-70b-instruct",
      messages: [
        {
          role: "system",
          content: `
You are Class A Fix's expert maintenance triage engine.
You MUST return ONLY valid JSON. 
No backticks. No markdown. No explanations.

Your output MUST match this EXACT schema:

{
  "category": "string",
  "hazards": ["string"],
  "summary": "string",
  "questions_dispatcher": ["string"],
  "questions_tenant": ["string"],
  "initial_diagnosis": "string",
  "confidence": number (0 to 1)
}

If unsure, return empty arrays and null values, but always valid JSON.
          `,
        },
        {
          role: "user",
          content: description,
        },
      ],
    };

    // Call OpenRouter
    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      }
    );

    const data = await response.json();

    if (!data?.choices?.[0]?.message?.content) {
      return NextResponse.json(
        { error: "OpenRouter returned no content" },
        { status: 500 }
      );
    }

    let raw = data.choices[0].message.content.trim();

    // 1. Remove backticks
    raw = raw.replace(/```json/gi, "").replace(/```/g, "").trim();

    // 2. Extract JSON if AI adds extra text
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1) {
      return NextResponse.json(
        { error: "AI returned no JSON object" },
        { status: 500 }
      );
    }

    const jsonSubstring = raw.substring(firstBrace, lastBrace + 1);

    let parsed;
    try {
      parsed = JSON.parse(jsonSubstring);
    } catch (err) {
      return NextResponse.json(
        {
          error: "Invalid JSON returned by AI",
          raw: raw,
        },
        { status: 500 }
      );
    }

    // 3. Validate fields (safety)
    const safe = {
      category: parsed.category ?? "",
      hazards: Array.isArray(parsed.hazards) ? parsed.hazards : [],
      summary: parsed.summary ?? "",
      questions_dispatcher: Array.isArray(parsed.questions_dispatcher)
        ? parsed.questions_dispatcher
        : [],
      questions_tenant: Array.isArray(parsed.questions_tenant)
        ? parsed.questions_tenant
        : [],
      initial_diagnosis: parsed.initial_diagnosis ?? "",
      confidence:
        typeof parsed.confidence === "number"
          ? parsed.confidence
          : 0,
    };

    return NextResponse.json(safe);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Unexpected server error" },
      { status: 500 }
    );
  }
}
