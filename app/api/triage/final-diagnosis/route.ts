import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { description, dispatcher_answers, tenant_answers, triage, vision } =
      await req.json();

    if (!description) {
      return NextResponse.json(
        { error: "Description is required." },
        { status: 400 }
      );
    }

    const body = {
      model: "meta-llama/llama-3.3-70b-instruct",
      messages: [
        {
          role: "system",
          content: `
You are the FINAL DIAGNOSIS ENGINE for Class A Fix.

Using:
- job description
- dispatcher answers
- tenant answers
- initial triage summary
- optional vision analysis

Produce ONLY valid JSON:
{
  "diagnoses": [
    {
      "title": "...",
      "description": "...",
      "confidence": 0-1,
      "severity": "low | medium | high | critical",
      "urgency_hours": number,
      "safety_concerns": [...],
      "trade_required": "...",
      "repair_steps": [...],
      "estimated_labor_minutes": number,
      "estimated_material_cost": number
    }
  ]
}

RULES:
- Provide 2–4 diagnosis options.
- FIRST should be most likely.
- Confidence MUST reflect available evidence.
- Do not invent unrealistic repair steps.
- Use Australian residential maintenance context.
- Never output markdown.
- Return ONLY raw JSON.
`
        },
        {
          role: "user",
          content: JSON.stringify(
            {
              description,
              dispatcher_answers,
              tenant_answers,
              triage,
              vision,
            },
            null,
            2
          ),
        },
      ],
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

    // CLEAN JSON WRAPPERS
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
