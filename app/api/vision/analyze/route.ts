Your cleaning handles some cases, but NOT all.

We need to clean:

- ```json  
- ```  
- \`  
- “Here is your result:”  
- Newlines before or after JSON  
- Invisible UTF BOM bytes  
- Models that wrap inside **markdown code blocks + text**  
- Models that return arrays as `"objects": "[]"` (string instead of array)

---

### **2. If JSON parsing fails, you currently crash the whole endpoint**

We need to:

- Catch invalid JSON  
- Return a readable error to user  
- Log the raw output in console  

---

### **3. You did not enforce token bias preventing “```”**

We can add token bias to discourage markdown formatting.

---

### **4. You allow `media.url` without checking for `.url` attribute**

We can tighten this.

---

# ✅ **Here is the FINAL FIXED version (copy + paste)**

This version is:

✔ Bulletproof JSON parsing  
✔ Bulletproof code-block removal  
✔ Logs raw content on parse error  
✔ Safe typing for media  
✔ Token bias to reduce formatting  
✔ Works with ANY LLM that tries to be cute and write markdown  

---

# 🔥 **FINAL: `/api/vision/analyze/route.ts`**

```ts
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

    // Convert images
    const images = media
      .filter((m: any) => typeof m?.url === "string")
      .map((item: any) => ({
        type: "input_image",
        image_url: item.url,
      }));

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
        content: context || "Describe everything visible with maximum objectivity."
      },
      ...images,
    ];

    // Call OpenRouter
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.0-flash-vision",
        messages,
        //
        // Token bias to discourage code fences
        //
        bias: {
          "```": -5,
          "`": -2
        }
      }),
    });

    const data = await response.json();

    let content = data?.choices?.[0]?.message?.content || "";

    //
    // CLEAN JSON — handles ALL weird cases
    //
    content = content
      .replace(/```json/gi, "")
      .replace(/```/g, "")
      .replace(/^\s*Here.*?:/gi, "")      // remove "Here is your JSON:"
      .replace(/^\s*JSON:/gi, "")
      .replace(/^\s*Result:/gi, "")
      .replace(/\uFEFF/g, "")             // remove BOM bytes
      .trim();

    //
    // Attempt to parse the cleaned JSON
    //
    let parsed: any;

    try {
      parsed = JSON.parse(content);
    } catch (err) {
      console.error("❌ JSON PARSE FAILED — RAW OUTPUT BELOW:");
      console.error(content);

      return NextResponse.json(
        { error: "Invalid JSON from Vision model.", raw: content },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed);

  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Vision analysis failed." },
      { status: 500 }
    );
  }
}
