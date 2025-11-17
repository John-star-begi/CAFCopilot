import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { description } = await req.json();

    const body = {
      model: "meta-llama/llama-3.3-70b-instruct",
      messages: [
        {
          role: "system",
          content: `
You are an expert maintenance triage assistant for Class A Fix.
Analyze the description and output ONLY valid JSON.
Return:
{
  "category": "...",
  "hazards": [...],
  "summary": "...",
  "questions_dispatcher": [...],
  "questions_tenant": [...],
  "initial_diagnosis": "...",
  "confidence": 0-1
}
`
        },
        { role: "user", content: description }
      ]
    };

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    const data = await response.json();
    return NextResponse.json(JSON.parse(data.choices[0].message.content));

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
