import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { description } = await req.json();

    if (!description || description.trim().length === 0) {
      return NextResponse.json(
        { error: "Description is required." },
        { status: 400 }
      );
    }

    // STEP 1 — TRIAGE PROMPT (your upgraded logic)
    const body = {
      model: "meta-llama/llama-3.3-70b-instruct",
      messages: [
        {
          role: "system",
          content: `
You are the Class A Fix TRIAGE BRAIN.

Your job is to review a maintenance job description and return ONLY valid JSON containing:
{
  "category": "...",
  "hazards": [...],
  "summary": "...",
  "questions_dispatcher": [...],
  "questions_tenant": [...],
  "initial_diagnosis": "...",
  "confidence": 0-1
}

RULES:
- Ask ULTRA-SPECIFIC questions.
- Questions must help confirm or eliminate diagnoses.
- No vague questions.
- Ask 5–12 total questions split between dispatcher and tenant.

DISPATCHER QUESTIONS: (examples)
- "Has this happened before?"
- "Is this item tenant-owned or property-managed?"
- "Any previous trade notes?"
- "Is warranty valid?"
- "Is access restricted?"

TENANT QUESTIONS: (examples)
- "Does it leak constantly or only when used?"
- "Is there noise or smell?"
- "Does the switch feel loose?"
- "Is there visible water now?"
- "Did resetting power help?"

HAZARDS:
Include only electrical, fire, water, gas, structural, or security hazards.

Return STRICT JSON. No markdown. No commentary.
`
        },
        { role: "user", content: description }
      ]
    };

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    let content = data?.choices?.[0]?.message?.content || "";

    // CLEAN JSON (removes ```json etc)
    content = content.replace(/```json/gi, "").replace(/```/g, "").trim();

    const parsed = JSON.parse(content);
    return NextResponse.json(parsed);

  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Invalid JSON returned by AI" },
      { status: 500 }
    );
  }
}
