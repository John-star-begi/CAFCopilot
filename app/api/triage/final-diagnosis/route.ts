import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { description, dispatcher_answers, tenant_answers, vision } = await req.json();

    const prompt = `
You are diagnosing a maintenance issue.
Use all data together to produce multiple possible diagnoses.

Return ONLY valid JSON:
{
 "diagnoses": [
   {
     "title": "...",
     "description": "...",
     "confidence": 0-1,
     "severity": "low | medium | high | critical",
     "urgency_hours": number,
     "trade_required": "...",
     "safety_concerns": [...],
     "repair_steps": [...],
     "materials_needed": [...],
     "estimated_labor_minutes": number,
     "estimated_material_cost": number
   }
 ]
}
`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "meta-llama/llama-3.3-70b-instruct",
        messages: [
          { role: "system", content: prompt },
          {
            role: "user",
            content: JSON.stringify(
              { description, dispatcher_answers, tenant_answers, vision },
              null,
              2
            )
          }
        ]
      })
    });

    const json = await response.json();

    return NextResponse.json(JSON.parse(json.choices[0].message.content));

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
