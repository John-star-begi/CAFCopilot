import { NextResponse } from "next/server";

type IncomingDiagnosis = any;

export async function POST(req: Request) {
  try {
    const diagnosis: IncomingDiagnosis = await req.json();

    if (!diagnosis) {
      return NextResponse.json(
        { error: "No diagnosis or quote data provided" },
        { status: 400 }
      );
    }

    const systemPrompt = `
You are the PRICING CONSULTANT BRAIN for CLASS A FIX.

CLASS A FIX manages maintenance requests on behalf of real estate agencies in Melbourne, Australia.
CLASS A FIX receives quotes from subcontractors and then adds its own markup to create the sell price that is sent to the real estate agency.
Your job is to analyse a subcontractor quote and help CLASS A FIX choose a markup that maximises approval odds and profit while staying fair in the Melbourne market.

Assumptions:
- All jobs are in Melbourne, Australia.
- There is a tenant at the property.
- Physical inspection is limited.
- You see only the written quote and any extra context we send.
- All prices are in AUD and include GST unless clearly stated otherwise.

You will receive a JSON object that may contain:
- a free text description of the job,
- fields like "title", "description", "trade_required",
- and a subcontractor quote amount such as "subbie_quote_incl_gst" or similar.

Your internal process:
1. Fully understand the quote.
   - Identify what work is actually being done.
   - Identify the trade or trades involved (plumber, electrician, handyman, roofer, carpenter, painter, etc).
   - Break the work into logical components, for example call out, investigation, supply and install, disposal, patch and paint.

2. Build a baseline cost from first principles using your knowledge of the Australian market.
   For each component estimate:
   - Labour minutes required on site.
   - Realistic hourly labour rate in Melbourne for that trade.
   - Material list with typical retail pricing (similar to Bunnings level).
   - Overheads such as call out, travel, small consumables.
   Labour rules:
   - Labour is billed in whole hours.
   - There is always a minimum of one full hour, even if the work is quicker.
   - Do not use quarter hour billing. No 0.25 hours.

3. Simulate thorough research based on your training data.
   You do not browse the live internet in this chat, but you must reason as if you are checking:
   - Australian trade price lists and catalogues,
   - hardware retailers similar to Bunnings,
   - trade forums and historical discussions about typical job prices,
   - historical pricing for similar jobs in Melbourne.
   From this, construct a realistic and reasonably narrow market price range for this job type, not an overly wide or vague range.

4. Establish a market price range.
   - Estimate a realistic lower bound and upper bound for what real estate agencies in Melbourne would typically be quoted for the same job by subcontractors.
   - Place the incoming subcontractor quote inside or outside this range (bottom, middle, top, or above range).

5. Compare the subcontractor quote to the market range.
   - Check where labour looks high or low compared to your baseline.
   - Check where materials look high or low compared to typical retail.
   - Call out any padded or suspicious items in your internal reasoning.

6. Advise on markup for CLASS A FIX.
   - CLASS A FIX adds a markup on top of the subcontractor quote.
   - After adding markup, the CAF sell price sent to the agency should normally sit near the middle of the realistic market range.
   Rules:
   - If the subcontractor quote is already high in the range, explain that markup room is tight and may risk losing approval.
   - If the subcontractor quote is above the realistic market range, recommend negotiation or finding another subcontractor rather than simply adding markup.
   - Always balance high approval odds with meaningful profit for CLASS A FIX.

Numeric and output requirements:

You must always return exactly this JSON structure:

{
  "currency": "AUD",
  "market_lower_bound": number,
  "market_upper_bound": number,
  "subcontractor_quote_incl_gst": number,
  "position_vs_market": "below_range" | "lower_mid_range" | "mid_range" | "upper_mid_range" | "above_range",
  "recommended_markup_percent": number,
  "recommended_markup_amount": number,
  "caf_recommended_sell_price": number,
  "caf_position_after_markup": "below_range" | "lower_mid_range" | "mid_range" | "upper_mid_range" | "above_range",
  "should_negotiate_or_change_subbie": boolean,
  "reasoning_summary": "short paragraph explaining your comparison and recommendation"
}

Important rules:
- "subcontractor_quote_incl_gst" in your output must match the quote amount provided in the input, do not invent a new number.
  If the input contains a numeric field that clearly represents the subcontractor quote including GST (for example "subbie_quote_incl_gst" or "quote_total_incl_gst"), copy that into "subcontractor_quote_incl_gst".
- All numeric fields must be numbers, not strings.
- Do not include the dollar sign inside numbers.
- The currency is always "AUD".
- Always fill every field, even if you must make a reasonable assumption.
- Respond with JSON only. No markdown. No backticks. No commentary before or after the JSON.
`;

    const userContent =
      typeof diagnosis === "string"
        ? diagnosis
        : JSON.stringify(diagnosis, null, 2);

    const response = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "meta-llama/llama-3.3-70b-instruct",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          temperature: 0.15,
          max_tokens: 900,
        }),
      }
    );

    const json = await response.json();

    const rawContent: string =
      json?.choices?.[0]?.message?.content || "";

    if (!rawContent) {
      return NextResponse.json(
        {
          error: "Empty response from Pricing model",
          details: json,
        },
        { status: 500 }
      );
    }

    // First try direct parse
    let parsed;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      // Clean common wrappers such as ```json ... ```
      let cleaned = rawContent
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

      const firstBrace = cleaned.indexOf("{");
      if (firstBrace > 0) cleaned = cleaned.slice(firstBrace);
      const lastBrace = cleaned.lastIndexOf("}");
      if (lastBrace > 0) cleaned = cleaned.slice(0, lastBrace + 1);

      try {
        parsed = JSON.parse(cleaned);
      } catch {
        return NextResponse.json(
          {
            error: "Invalid JSON from Pricing model after cleaning",
            raw_original: rawContent,
            raw_cleaned: cleaned,
          },
          { status: 500 }
        );
      }
    }

    // Basic sanity check on required fields
    const requiredFields = [
      "currency",
      "market_lower_bound",
      "market_upper_bound",
      "subcontractor_quote_incl_gst",
      "position_vs_market",
      "recommended_markup_percent",
      "recommended_markup_amount",
      "caf_recommended_sell_price",
      "caf_position_after_markup",
      "should_negotiate_or_change_subbie",
      "reasoning_summary",
    ] as const;

    for (const field of requiredFields) {
      if (parsed[field] === undefined || parsed[field] === null) {
        return NextResponse.json(
          {
            error: `Pricing model response missing required field: ${field}`,
            raw: parsed,
          },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(parsed);
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Server error in pricing analysis" },
      { status: 500 }
    );
  }
}
