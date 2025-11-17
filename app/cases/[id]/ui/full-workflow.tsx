"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

type MediaItem = { url: string; contentType?: string };

type TriageDiagnosis = {
  most_likely?: string;
  alternatives?: string[];
  confidence?: number;
};

type QuestionItem = {
  id: string;
  question: string;
  reason?: string;
};

type TriageResult = {
  category?: string;
  hazards?: string[];
  summary?: string;
  questions_checklist?: QuestionItem[];
  diagnosis?: TriageDiagnosis;
};

type VisionRecon = {
  vision_summary?: string;
  objects?: string[];
  hazards?: string[];
  visible_damage?: Record<string, any>;
  materials?: Record<string, any>;
  labels_or_text?: string[];
  measurements?: Record<string, any>;
  location_hint?: string;
};

type FinalDiagnosisItem = {
  title: string;
  description: string;
  confidence: number;
  severity: string;
  urgency_hours: number;
  safety_concerns: string[];
  trade_required: string;
  repair_steps: string[];
  materials_needed: string[];
  estimated_labor_minutes: number;
  estimated_material_cost: number;
};

type FinalDiagnosisResult = {
  diagnoses: FinalDiagnosisItem[];
};

type PricingBreakdown = {
  currency: string;
  labour_minutes_estimated: number;
  labour_cost_estimated: number;
  materials_cost_estimated: number;
  materials_with_buffer: number;
  materials_with_markup: number;
  subtotal_before_markup: number;
  job_markup_percent: number;
  job_markup_amount: number;
  final_recommended_price: number;
  notes: string;
};

export default function FullWorkflowWorkspace({
  caseData,
}: {
  caseData: any;
}) {
  // Case content
  const [description] = useState(caseData.description || "");
  const [triage, setTriage] = useState<TriageResult | null>(
    caseData.triage || null
  );
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [tenantText, setTenantText] = useState("");

  // Vision
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [media, setMedia] = useState<MediaItem[]>(caseData.media || []);
  const [visionContext, setVisionContext] = useState(
    `Job description: ${caseData.description || ""}\n\nDescribe what is visible in the images with full objectivity.`
  );
  const [visionRecon, setVisionRecon] = useState<VisionRecon | null>(
    caseData.vision || null
  );
  const [visionRaw, setVisionRaw] = useState(
    caseData.vision ? JSON.stringify(caseData.vision, null, 2) : ""
  );

  // Final diagnosis
  const [finalDiag, setFinalDiag] = useState<FinalDiagnosisResult | null>(
    caseData.diagnosis || null
  );
  const [selectedDiag, setSelectedDiag] = useState<number | null>(null);

  // Pricing
  const [pricingMap, setPricingMap] = useState<
    Record<number, PricingBreakdown>
  >({});

  // Expand/collapse flags (multi-open)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    triage: true,
    checklist: true,
    vision: true,
    finalDiagnosis: true,
  });

  const toggle = (id: string) =>
    setOpenSections((prev) => ({ ...prev, [id]: !prev[id] }));

  // ----------------------------------------------------
  // TRIAGE
  // ----------------------------------------------------

  const runTriage = async () => {
    const res = await fetch("/api/triage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description }),
    });

    const data = await res.json();
    if (!res.ok) return alert("Error: " + data.error);

    setTriage(data);

    await supabase
      .from("cases")
      .update({ triage: data, status: "triaged" })
      .eq("id", caseData.id);
  };

  // ----------------------------------------------------
  // CHECKLIST → GENERATE TENANT MESSAGE
  // ----------------------------------------------------

  const generateTenantMessage = (questions: QuestionItem[]) => {
    const unanswered = questions.filter((q) => {
      const ans = answers[q.id];
      return !ans || ans === "I_DONT_KNOW";
    });

    if (unanswered.length === 0) return "Nothing needed.";

    return (
      "Hi, could you please clarify the following:\n\n" +
      unanswered.map((q) => `• ${q.question}`).join("\n") +
      "\n\nThank you!"
    );
  };

  const tenantMessage =
    triage?.questions_checklist?.length
      ? generateTenantMessage(triage.questions_checklist)
      : "";

  // ----------------------------------------------------
  // MEDIA UPLOAD
  // ----------------------------------------------------

  const uploadFiles = async (files: FileList | null) => {
    if (!files) return;
    const newItems: MediaItem[] = [];

    for (const f of Array.from(files)) {
      const res = await fetch(
        `/api/upload?filename=${encodeURIComponent(f.name)}`,
        { method: "POST", body: f }
      );
      const data = await res.json();
      if (!res.ok) continue;
      newItems.push({ url: data.url, contentType: data.contentType });
    }

    const merged = [...media, ...newItems];
    setMedia(merged);

    await supabase.from("cases").update({ media: merged }).eq("id", caseData.id);
  };

  // ----------------------------------------------------
  // VISION ANALYSIS (Gemini)
  // ----------------------------------------------------

  const runVision = async () => {
    const res = await fetch("/api/vision/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ context: visionContext, media }),
    });

    const data = await res.json();
    if (!res.ok) return alert("Vision error");

    setVisionRecon(data);
    setVisionRaw(JSON.stringify(data, null, 2));

    await supabase
      .from("cases")
      .update({ vision: data, status: "visioned" })
      .eq("id", caseData.id);
  };

  // ----------------------------------------------------
  // FINAL DIAGNOSIS
  // ----------------------------------------------------

  const runFinalDiagnosis = async () => {
    const res = await fetch("/api/triage/final-diagnosis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description,
        triage,
        answers,
        tenant_text: tenantText,
        vision_recon_raw: visionRaw,
      }),
    });

    const data = await res.json();
    if (!res.ok) return alert("Diagnosis failed");

    setFinalDiag(data);
    setSelectedDiag(0);

    await supabase
      .from("cases")
      .update({ diagnosis: data, status: "diagnosed" })
      .eq("id", caseData.id);
  };

  // ----------------------------------------------------
  // PRICING
  // ----------------------------------------------------

  const runPricing = async (idx: number) => {
    const diag = finalDiag?.diagnoses?.[idx];
    if (!diag) return;

    const res = await fetch("/api/triage/pricing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ diagnosis: diag, description }),
    });

    const data = await res.json();
    if (!res.ok) return alert("Pricing failed");

    setPricingMap((prev) => ({ ...prev, [idx]: data.price_recommendation }));

    await supabase
      .from("cases")
      .update({ pricing: data, status: "priced" })
      .eq("id", caseData.id);
  };

  // ----------------------------------------------------
  // RENDER
  // ----------------------------------------------------

  return (
    <div className="space-y-8 p-4">

      {/* ---------------- TRIAGE ---------------- */}
      <section className="bg-white p-5 border rounded-xl shadow-sm">
        <button
          onClick={() => toggle("triage")}
          className="w-full text-left text-xl font-semibold mb-3"
        >
          Step 1 — AI Triage
        </button>

        {openSections.triage && (
          <div className="space-y-3">
            <button
              onClick={runTriage}
              className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm"
            >
              Run Triage
            </button>

            {triage && (
              <div className="space-y-3 mt-3">
                <p className="font-medium">Category: {triage.category}</p>
                <p>Summary: {triage.summary}</p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ---------------- CHECKLIST ---------------- */}
      <section className="bg-white p-5 border rounded-xl shadow-sm">
        <button
          onClick={() => toggle("checklist")}
          className="w-full text-left text-xl font-semibold mb-3"
        >
          Step 2 — Information Checklist
        </button>

        {openSections.checklist && triage?.questions_checklist && (
          <div className="space-y-4">
            {triage.questions_checklist.map((q) => (
              <div key={q.id} className="border p-3 rounded-md bg-gray-50">
                <p className="text-sm font-medium">{q.question}</p>
                <input
                  className="mt-1 w-full border rounded p-2 text-sm"
                  value={answers[q.id] || ""}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                  }
                />
                <button
                  onClick={() =>
                    setAnswers((prev) => ({ ...prev, [q.id]: "I_DONT_KNOW" }))
                  }
                  className="text-xs text-blue-600 underline mt-1"
                >
                  I don’t know
                </button>
              </div>
            ))}

            <div>
              <h3 className="text-sm font-semibold">Tenant Message</h3>
              <textarea
                readOnly
                value={tenantMessage}
                className="w-full mt-2 border p-3 rounded bg-gray-50 text-sm"
                rows={4}
              />
            </div>

            <div>
              <h3 className="text-sm font-semibold">Tenant Reply Notes</h3>
              <textarea
                value={tenantText}
                onChange={(e) => setTenantText(e.target.value)}
                className="w-full mt-2 border p-3 rounded text-sm"
                rows={3}
              />
            </div>
          </div>
        )}
      </section>

      {/* ---------------- VISION ---------------- */}
      <section className="bg-white p-5 border rounded-xl shadow-sm">
        <button
          onClick={() => toggle("vision")}
          className="w-full text-left text-xl font-semibold mb-3"
        >
          Step 3 — Vision Recon
        </button>

        {openSections.vision && (
          <div className="space-y-4">

            {/* Upload */}
            <div
              className="border-dashed border-2 p-6 rounded-md text-center cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <p className="text-sm">Upload images</p>
              <input
                type="file"
                multiple
                ref={fileInputRef}
                className="hidden"
                accept="image/*"
                onChange={(e) => uploadFiles(e.target.files)}
              />
            </div>

            {media.length > 0 && (
              <ul className="text-xs text-blue-600">
                {media.map((m, i) => (
                  <li key={i}>
                    <a
                      href={m.url}
                      target="_blank"
                      className="underline"
                    >
                      Image {i + 1}
                    </a>
                  </li>
                ))}
              </ul>
            )}

            <textarea
              value={visionContext}
              onChange={(e) => setVisionContext(e.target.value)}
              className="w-full border p-2 rounded text-sm"
              rows={4}
            />

            <button
              onClick={runVision}
              className="bg-purple-600 text-white px-4 py-2 rounded-md text-sm"
            >
              Run Vision Recon
            </button>

            {visionRecon && (
              <textarea
                value={visionRaw}
                onChange={(e) => setVisionRaw(e.target.value)}
                className="w-full bg-gray-50 border p-3 rounded font-mono text-xs"
                rows={10}
              />
            )}
          </div>
        )}
      </section>

      {/* ---------------- FINAL DIAGNOSIS ---------------- */}
      <section className="bg-white p-5 border rounded-xl shadow-sm">
        <button
          onClick={() => toggle("finalDiagnosis")}
          className="w-full text-left text-xl font-semibold mb-3"
        >
          Step 4 — Final Diagnosis
        </button>

        {openSections.finalDiagnosis && (
          <div className="space-y-4">
            <button
              onClick={runFinalDiagnosis}
              className="bg-slate-900 text-white px-4 py-2 rounded-md text-sm"
            >
              Run Final Diagnosis
            </button>

            {finalDiag?.diagnoses && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {finalDiag.diagnoses.map((d, idx) => (
                  <div
                    key={idx}
                    className="border rounded-lg p-4 bg-gray-50 hover:bg-white hover:shadow-sm cursor-pointer"
                    onClick={() => setSelectedDiag(idx)}
                  >
                    <h4 className="text-sm font-semibold">{d.title}</h4>
                    <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                      {d.description}
                    </p>
                  </div>
                ))}
              </div>
            )}

            {selectedDiag !== null &&
              finalDiag?.diagnoses?.[selectedDiag] && (
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h3 className="text-sm font-semibold">
                    {finalDiag.diagnoses[selectedDiag].title}
                  </h3>

                  <p className="text-xs mt-2">
                    {finalDiag.diagnoses[selectedDiag].description}
                  </p>

                  <button
                    onClick={() => runPricing(selectedDiag)}
                    className="mt-4 bg-green-600 text-white px-3 py-2 rounded-md text-sm"
                  >
                    Calculate Price
                  </button>

                  {pricingMap[selectedDiag] && (
                    <div className="mt-3 text-xs bg-white p-3 rounded border">
                      <p className="font-semibold">
                        Final price: {pricingMap[selectedDiag].currency}{" "}
                        {pricingMap[selectedDiag].final_recommended_price.toFixed(
                          2
                        )}
                      </p>
                    </div>
                  )}
                </div>
              )}
          </div>
        )}
      </section>
    </div>
  );
}
