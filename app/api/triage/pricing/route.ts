import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { diagnosis } = await req.json();

    const prompt = `
You are a pricing estimator for Class A Fix.
Calculate pricing based on:
- labour minutes
- material cost
- 20% job markup
- 5% materials buffer
- minimum 1 hour labour
Return ONLY JSON:
{
 "currency": "AUD",
 "labour_minutes_estimated": number,
 "labour_cost_estimated": number,
 "materials_cost_estimated": number,
 "materials_with_markup": number,
 "job_markup_percent": 20,
 "job_markup_amount": number,
 "subtotal_before_markup": number,
 "final_recommended_price": number
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
          { role: "user", content: JSON.stringify(diagnosis, null, 2) }
        ]
      })
    });

    const json = await response.json();

    return NextResponse.json(JSON.parse(json.choices[0].message.content));

  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
