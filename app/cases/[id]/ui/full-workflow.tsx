"use client";

import { useState, useRef } from "react";
import { supabase } from "@/lib/supabase";

type MediaItem = {
  url: string;
  contentType?: string;
};

type TriageResult = {
  category?: string;
  summary?: string;
  hazards?: string[];
  questions?: string[];
  questions_dispatcher?: string[];
  questions_tenant?: string[];
};

type QuestionTarget = "dispatcher" | "tenant" | "general";

type QuestionItem = {
  id: string;
  question: string;
  target: QuestionTarget;
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
  estimated_labor_minutes: number;
  estimated_material_cost: number;
};

type FinalDiagnosisResult = {
  diagnoses: FinalDiagnosisItem[];
};

type PricingResponse = {
  currency: string;

  fair_range_low: number;
  fair_range_high: number;

  subcontractor_quote_incl_gst: number | null;
  position_vs_market:
    | "below_range"
    | "lower_mid_range"
    | "mid_range"
    | "upper_mid_range"
    | "above_range"
    | "n/a"
    | string;

  recommended_markup_percent: number;
  recommended_markup_amount: number;
  caf_recommended_sell_price: number;
  caf_position_after_markup:
    | "below_range"
    | "lower_mid_range"
    | "mid_range"
    | "upper_mid_range"
    | "above_range"
    | "n/a"
    | string;

  should_negotiate_or_change_subbie: boolean;

  breakdown: {
    scope_summary: string;
    baseline_costs: {
      item: string;
      estimated_cost_ex_gst: number;
      notes: string;
    }[];
    market_benchmarks: string[];
    comparison_summary: string;
    markup_strategy: string;
  };
};

type LoadingState = {
  triage: boolean;
  vision: boolean;
  finalDiagnosis: boolean;
  pricing: boolean;
};

export default function FullWorkflowWorkspace({ caseData }: { caseData: any }) {
  // Case core
  const [description] = useState<string>(caseData.description || "");
  const [triage, setTriage] = useState<TriageResult | null>(
    caseData.triage || null
  );
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [tenantText, setTenantText] = useState<string>("");

  // Vision
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [media, setMedia] = useState<MediaItem[]>(caseData.media || []);
  const [visionContext, setVisionContext] = useState<string>(
    caseData.vision_context ||
      `Job description: ${caseData.description || ""}\n\nDescribe what is visible in the images with full objectivity. No diagnosis, no assumptions.`
  );
  const [visionRecon, setVisionRecon] = useState<VisionRecon | null>(
    caseData.vision || null
  );
  const [visionRaw, setVisionRaw] = useState<string>(
    caseData.vision ? JSON.stringify(caseData.vision, null, 2) : ""
  );

  // Final diagnosis
  const [finalDiag, setFinalDiag] = useState<FinalDiagnosisResult | null>(
    caseData.diagnosis || null
  );
  const [selectedDiagIndex, setSelectedDiagIndex] = useState<number | null>(
    null
  );

  // Pricing (single latest pricing object, same as pricing only tool)
  const [pricing, setPricing] = useState<PricingResponse | null>(
    caseData.pricing || null
  );

  // UI
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    triage: true,
    vision: true,
    diagnosis: true,
    summary: true,
  });

  const [loading, setLoading] = useState<LoadingState>({
    triage: false,
    vision: false,
    finalDiagnosis: false,
    pricing: false,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ------------ Helpers ------------

  const buildQuestionsFromTriage = (t: TriageResult): QuestionItem[] => {
    const items: QuestionItem[] = [];

    (t.questions || []).forEach((q, idx) => {
      items.push({
        id: `general_${idx}`,
        question: q,
        target: "general",
      });
    });

    (t.questions_dispatcher || []).forEach((q, idx) => {
      items.push({
        id: `dispatcher_${idx}`,
        question: q,
        target: "dispatcher",
      });
    });

    (t.questions_tenant || []).forEach((q, idx) => {
      items.push({
        id: `tenant_${idx}`,
        question: q,
        target: "tenant",
      });
    });

    return items;
  };

  const buildInitialAnswers = (qs: QuestionItem[]): Record<string, string> => {
    const a: Record<string, string> = {};
    qs.forEach((q) => {
      a[q.id] = "";
    });
    return a;
  };

  const generateTenantMessage = (qs: QuestionItem[]): string => {
    const tenantQs = qs.filter((q) => q.target === "tenant");
    if (tenantQs.length === 0) return "Nothing needed from tenant.";

    const unanswered = tenantQs.filter((q) => {
      const ans = answers[q.id];
      return !ans || ans === "I_DONT_KNOW";
    });

    if (unanswered.length === 0) {
      return "Nothing needed from tenant.";
    }

    return [
      "Hi, could you please clarify the following:",
      "",
      ...unanswered.map((q) => `• ${q.question}`),
      "",
      "Thank you.",
    ].join("\n");
  };

  const tenantMessage =
    questions.length > 0 ? generateTenantMessage(questions) : "";

  // ------------ Step 1: Triage ------------

  const runTriage = async () => {
    try {
      setLoading((prev) => ({ ...prev, triage: true }));
      const res = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Triage failed");
        return;
      }

      const triageResult: TriageResult = {
        category: data.category,
        summary: data.summary,
        hazards: data.hazards || [],
        questions: data.questions || [],
        questions_dispatcher: data.questions_dispatcher || [],
        questions_tenant: data.questions_tenant || [],
      };

      setTriage(triageResult);

      const qs = buildQuestionsFromTriage(triageResult);
      setQuestions(qs);
      setAnswers(buildInitialAnswers(qs));

      await supabase
        .from("cases")
        .update({ triage: triageResult, status: "triaged" })
        .eq("id", caseData.id);
    } catch (err: any) {
      console.error("TRIAGE ERROR", err);
      alert(err?.message || "Triage error");
    } finally {
      setLoading((prev) => ({ ...prev, triage: false }));
    }
  };

  // ------------ Media upload + Vision ------------

  const uploadFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const uploaded: MediaItem[] = [];

    for (const file of Array.from(files)) {
      try {
        const res = await fetch(
          `/api/upload?filename=${encodeURIComponent(file.name)}`,
          {
            method: "POST",
            body: file,
          }
        );

        const data = await res.json();
        if (!res.ok) {
          console.warn("Upload failed for file", file.name, data?.error);
          continue;
        }

        uploaded.push({
          url: data.url,
          contentType: data.contentType || file.type,
        });
      } catch (err) {
        console.error("Upload error for file", file.name, err);
      }
    }

    if (uploaded.length === 0) return;

    const merged = [...media, ...uploaded];
    setMedia(merged);

    await supabase
      .from("cases")
      .update({ media: merged })
      .eq("id", caseData.id);
  };

  const runVision = async () => {
    try {
      setLoading((prev) => ({ ...prev, vision: true }));

      const res = await fetch("/api/vision/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context: visionContext, media }),
      });

      const data = await res.json();
      if (!res.ok) {
        console.error("VISION ERROR", data);
        alert(data.error || "Vision analysis failed");
        return;
      }

      setVisionRecon(data);
      setVisionRaw(JSON.stringify(data, null, 2));

      await supabase
        .from("cases")
        .update({
          vision: data,
          vision_context: visionContext,
          media,
          status: "visioned",
        })
        .eq("id", caseData.id);
    } catch (err: any) {
      console.error("VISION ERROR", err);
      alert(err?.message || "Vision error");
    } finally {
      setLoading((prev) => ({ ...prev, vision: false }));
    }
  };

  // ------------ Step 3: Final diagnosis ------------

  const runFinalDiagnosis = async () => {
    if (!triage) {
      alert("Run triage first.");
      return;
    }

    try {
      setLoading((prev) => ({ ...prev, finalDiagnosis: true }));
      setFinalDiag(null);
      setSelectedDiagIndex(null);

      // Split answers into dispatcher / tenant based on question target
      const dispatcher_answers: Record<string, string> = {};
      const tenant_answers: Record<string, string> = {};

      questions.forEach((q) => {
        const value = answers[q.id];
        if (!value) return;

        if (q.target === "tenant") {
          tenant_answers[q.question] = value;
        } else {
          dispatcher_answers[q.question] = value;
        }
      });

      if (tenantText.trim()) {
        tenant_answers["free_text"] = tenantText.trim();
      }

      const res = await fetch("/api/triage/final-diagnosis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          dispatcher_answers,
          tenant_answers,
          triage,
          vision: visionRecon,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        console.error("FINAL DIAG ERROR", data);
        alert(data.error || "Final diagnosis failed");
        return;
      }

      const diagResult: FinalDiagnosisResult = data;
      setFinalDiag(diagResult);
      if (diagResult.diagnoses && diagResult.diagnoses.length > 0) {
        setSelectedDiagIndex(0);
      }

      const triageWithAnswers = {
        ...triage,
        _answers: answers,
        _tenant_text: tenantText,
      };

      await supabase
        .from("cases")
        .update({
          triage: triageWithAnswers,
          diagnosis: diagResult,
          status: "diagnosed",
        })
        .eq("id", caseData.id);
    } catch (err: any) {
      console.error("FINAL DIAG ERROR", err);
      alert(err?.message || "Final diagnosis error");
    } finally {
      setLoading((prev) => ({ ...prev, finalDiagnosis: false }));
    }
  };

  // ------------ Step 4: Pricing ------------

  const runPricingForDiagnosis = async (idx: number) => {
    if (!finalDiag || !finalDiag.diagnoses || !finalDiag.diagnoses[idx]) {
      alert("No diagnosis selected for pricing.");
      return;
    }

    const diag = finalDiag.diagnoses[idx];

    try {
      setLoading((prev) => ({ ...prev, pricing: true }));
      setPricing(null);

      const res = await fetch("/api/triage/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: diag.title,
          description: diag.description,
          trade_required: diag.trade_required,
          estimated_labor_minutes: diag.estimated_labor_minutes,
          estimated_material_cost: diag.estimated_material_cost,
          severity: diag.severity,
          urgency_hours: diag.urgency_hours,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        console.error("PRICING ERROR", data);
        alert(data.error || "Pricing failed");
        return;
      }

      setPricing(data as PricingResponse);
      setSelectedDiagIndex(idx);

      await supabase
        .from("cases")
        .update({ pricing: data, status: "priced" })
        .eq("id", caseData.id);
    } catch (err: any) {
      console.error("PRICING ERROR", err);
      alert(err?.message || "Pricing error");
    } finally {
      setLoading((prev) => ({ ...prev, pricing: false }));
    }
  };

  // ------------ Render helpers ------------

  const renderHazardBadges = (hazards?: string[]) => {
    if (!hazards || hazards.length === 0) return null;
    return (
      <div className="flex flex-wrap gap-1 mt-1">
        {hazards.map((h) => (
          <span
            key={h}
            className="inline-block rounded-full bg-red-50 text-red-700 text-xs px-2 py-0.5"
          >
            {h}
          </span>
        ))}
      </div>
    );
  };

  const selectedDiagnosis =
    selectedDiagIndex != null && finalDiag?.diagnoses
      ? finalDiag.diagnoses[selectedDiagIndex]
      : null;

  // ------------ UI ------------

  return (
    <div className="space-y-8">
      {/* Case header */}
      <section className="bg-white p-5 border rounded-xl shadow-sm">
        <h1 className="text-xl font-semibold mb-1">Full Workflow</h1>
        <p className="text-sm text-gray-600">
          EACO: {caseData.eaco_id || "N/A"}
        </p>
        <p className="mt-2 text-sm whitespace-pre-wrap">
          {caseData.description}
        </p>
      </section>

      {/* Step 1: Triage */}
      <section className="bg-white p-5 border rounded-xl shadow-sm space-y-4">
        <button
          type="button"
          onClick={() => toggleSection("triage")}
          className="w-full text-left text-lg font-semibold"
        >
          Step 1 — AI Triage
        </button>

        {openSections.triage && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={runTriage}
              disabled={loading.triage}
              className="bg-slate-900 text-white text-sm px-4 py-2 rounded-md disabled:opacity-60"
            >
              {loading.triage ? "Running triage..." : "Run Triage"}
            </button>

            {triage && (
              <div className="border rounded-md p-3 bg-gray-50 text-sm space-y-1">
                <p>
                  <span className="font-semibold">Category:</span>{" "}
                  {triage.category || "Unknown"}
                </p>
                {triage.summary && (
                  <p>
                    <span className="font-semibold">Summary:</span>{" "}
                    {triage.summary}
                  </p>
                )}
                {triage.hazards && triage.hazards.length > 0 && (
                  <div>
                    <span className="font-semibold">Hazards:</span>
                    {renderHazardBadges(triage.hazards)}
                  </div>
                )}
              </div>
            )}

            {questions.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Clarification questions</h3>

                {questions.map((q) => (
                  <div
                    key={q.id}
                    className="border p-3 rounded-md bg-gray-50 space-y-1"
                  >
                    <div className="flex items-center justify_between gap-2">
                      <p className="text-sm font-medium">{q.question}</p>
                      <span className="text-xs text-gray-500">
                        {q.target}
                      </span>
                    </div>
                    <input
                      className="mt-1 w-full border rounded p-2 text-sm"
                      value={answers[q.id] || ""}
                      placeholder="Type answer or leave blank"
                      onChange={(e) =>
                        setAnswers((prev) => ({
                          ...prev,
                          [q.id]: e.target.value,
                        }))
                      }
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setAnswers((prev) => ({
                          ...prev,
                          [q.id]: "I_DONT_KNOW",
                        }))
                      }
                      className="text-xs text-blue-600 underline mt-1"
                    >
                      I don't know
                    </button>
                  </div>
                ))}

                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Tenant message</h4>
                  <textarea
                    readOnly
                    value={tenantMessage}
                    className="w-full mt-1 border p-3 rounded bg-gray-50 text-xs"
                    rows={4}
                  />
                  <label className="text-xs text-gray-500 block mt-2">
                    Tenant reply or extra context
                  </label>
                  <textarea
                    value={tenantText}
                    onChange={(e) => setTenantText(e.target.value)}
                    className="w-full mt-1 border p-3 rounded text-sm"
                    rows={3}
                    placeholder="Paste tenant reply here when you have it."
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Step 2: Vision */}
      <section className="bg-white p-5 border rounded-xl shadow-sm space-y-4">
        <button
          type="button"
          onClick={() => toggleSection("vision")}
          className="w_full text_left text-lg font-semibold"
        >
          Step 2 — Vision Recon
        </button>

        {openSections.vision && (
          <div className="space-y-4">
            <div
              className="border-2 border-dashed rounded-md p-6 text-center cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
            >
              <p className="text-sm text-gray-600">
                Click or drop images to attach to this case.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => uploadFiles(e.target.files)}
              />
            </div>

            {media.length > 0 && (
              <ul className="text-xs text-blue-600">
                {media.map((m, idx) => (
                  <li key={idx}>
                    <a
                      href={m.url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      Image {idx + 1}
                    </a>
                  </li>
                ))}
              </ul>
            )}

            <div>
              <label className="text-sm font-semibold">
                Vision context (sent to Gemini)
              </label>
              <textarea
                className="w-full mt-1 border rounded p-3 text-sm"
                rows={4}
                value={visionContext}
                onChange={(e) => setVisionContext(e.target.value)}
              />
            </div>

            <button
              type="button"
              onClick={runVision}
              disabled={loading.vision}
              className="bg-slate-900 text-white text-sm px-4 py-2 rounded-md disabled:opacity-60"
            >
              {loading.vision ? "Running vision..." : "Run Vision Recon"}
            </button>

            {visionRecon && (
              <div className="border rounded-md p-3 bg-gray-50 text-xs space-y-1">
                {visionRecon.vision_summary && (
                  <p>
                    <span className="font-semibold">Summary:</span>{" "}
                    {visionRecon.vision_summary}
                  </p>
                )}
                {visionRecon.hazards && visionRecon.hazards.length > 0 && (
                  <div>
                    <span className="font-semibold">Hazards:</span>
                    {renderHazardBadges(visionRecon.hazards)}
                  </div>
                )}
                {visionRecon.objects && visionRecon.objects.length > 0 && (
                  <p>
                    <span className="font-semibold">Objects:</span>{" "}
                    {visionRecon.objects.join(", ")}
                  </p>
                )}
              </div>
            )}

            <div>
              <label className="text-xs font-semibold">
                Raw vision JSON (editable if needed)
              </label>
              <textarea
                className="w-full mt-1 border rounded p-2 text-xs font-mono"
                rows={10}
                value={visionRaw}
                onChange={(e) => setVisionRaw(e.target.value)}
              />
            </div>
          </div>
        )}
      </section>

      {/* Step 3: Final diagnosis + Step 4: Pricing */}
      <section className="bg-white p-5 border rounded-xl shadow-sm space-y-4">
        <button
          type="button"
          onClick={() => toggleSection("diagnosis")}
          className="w-full text-left text-lg font-semibold"
        >
          Step 3 — Final diagnosis and pricing
        </button>

        {openSections.diagnosis && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={runFinalDiagnosis}
              disabled={loading.finalDiagnosis}
              className="bg-slate-900 text-white text-sm px-4 py-2 rounded-md disabled:opacity-60"
            >
              {loading.finalDiagnosis
                ? "Generating diagnosis..."
                : "Generate final diagnosis"}
            </button>

            {finalDiag?.diagnoses && finalDiag.diagnoses.length > 0 && (
              <div className="space-y-4 mt-4">
                {finalDiag.diagnoses.map((diag, idx) => {
                  const isSelected = selectedDiagIndex === idx;

                  return (
                    <div
                      key={idx}
                      className={`border rounded-md p-4 bg-gray-50 space-y-2 ${
                        isSelected ? "border-slate-700" : ""
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold">
                          {idx + 1}. {diag.title}
                        </h3>
                        <span className="text-xs text-gray-600">
                          {diag.severity} — {diag.urgency_hours} hours
                        </span>
                      </div>

                      <p className="text-xs text-gray-700">
                        {diag.description}
                      </p>

                      <p className="text-xs text-gray-500">
                        Confidence: {Math.round(diag.confidence * 100)}%
                      </p>

                      <p className="text-xs">
                        <span className="font-semibold">Trade:</span>{" "}
                        {diag.trade_required}
                      </p>

                      {diag.safety_concerns &&
                        diag.safety_concerns.length > 0 && (
                          <p className="text-xs">
                            <span className="font-semibold">Safety:</span>{" "}
                            {diag.safety_concerns.join(", ")}
                          </p>
                        )}

                      <details className="mt-2 text-xs">
                        <summary className="cursor-pointer">
                          Repair steps and estimates
                        </summary>
                        <div className="mt-2 space-y-1">
                          <div>
                            <span className="font-semibold">Steps:</span>
                            <ul className="list-disc ml-5">
                              {diag.repair_steps.map((s, i) => (
                                <li key={i}>{s}</li>
                              ))}
                            </ul>
                          </div>
                          <p>
                            Estimated labour: {diag.estimated_labor_minutes} min
                          </p>
                          <p>
                            Estimated materials cost:{" "}
                            {diag.estimated_material_cost.toFixed(2)} AUD
                          </p>
                        </div>
                      </details>

                      <div className="mt-3 flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => runPricingForDiagnosis(idx)}
                          disabled={loading.pricing}
                          className="bg-green-600 text-white text-xs px-3 py-2 rounded-md disabled:opacity-60"
                        >
                          {loading.pricing && isSelected
                            ? "Calculating price..."
                            : "Calculate CAF price"}
                        </button>
                        {isSelected && pricing && (
                          <span className="text-xs text-gray-600">
                            Last priced diagnosis
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {pricing && selectedDiagnosis && (
              <div className="mt-6 border rounded-md p-4 bg-gray-50 text-xs space-y-2">
                <p className="text-sm font-semibold">
                  CAF recommended sell price: {pricing.currency}{" "}
                  {pricing.caf_recommended_sell_price.toFixed(2)}
                </p>
                <p>
                  Market range: {pricing.currency}{" "}
                  {pricing.fair_range_low.toFixed(2)} to{" "}
                  {pricing.fair_range_high.toFixed(2)}
                </p>
                {typeof pricing.subcontractor_quote_incl_gst === "number" && (
                  <p>
                    Subbie quote (incl GST): {pricing.currency}{" "}
                    {pricing.subcontractor_quote_incl_gst.toFixed(2)}
                  </p>
                )}
                <p>Position vs market: {pricing.position_vs_market}</p>
                <p>
                  CAF position after markup: {pricing.caf_position_after_markup}
                </p>
                <p>
                  Recommended markup:{" "}
                  {pricing.recommended_markup_percent.toFixed(1)}% (
                  {pricing.currency}{" "}
                  {pricing.recommended_markup_amount.toFixed(2)})
                </p>
                {pricing.should_negotiate_or_change_subbie && (
                  <p className="text-red-600 font-semibold">
                    Suggest negotiating or changing subcontractor.
                  </p>
                )}

                <details className="mt-2">
                  <summary className="cursor-pointer">
                    Pricing breakdown
                  </summary>
                  <div className="mt-2 space-y-2">
                    <p>{pricing.breakdown.scope_summary}</p>
                    <div>
                      <p className="font-semibold text-xs">Baseline costs</p>
                      <ul className="list-disc ml-5">
                        {pricing.breakdown.baseline_costs.map((item, i) => (
                          <li key={i}>
                            {item.item}: {pricing.currency}{" "}
                            {item.estimated_cost_ex_gst.toFixed(2)}{" "}
                            {item.notes && (
                              <span className="text-gray-500">
                                {" "}
                                ({item.notes})
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="font-semibold text-xs">
                        Market benchmarks
                      </p>
                      <ul className="list-disc ml-5">
                        {pricing.breakdown.market_benchmarks.map((mb, i) => (
                          <li key={i}>{mb}</li>
                        ))}
                      </ul>
                    </div>
                    <p>{pricing.breakdown.comparison_summary}</p>
                    <p>{pricing.breakdown.markup_strategy}</p>
                  </div>
                </details>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Summary */}
      <section className="bg-white p-5 border rounded-xl shadow-sm space-y-2">
        <button
          type="button"
          onClick={() => toggleSection("summary")}
          className="w-full text-left text-lg font-semibold"
        >
          Summary
        </button>

        {openSections.summary && (
          <div className="mt-3 text-sm space-y-1">
            <p>
              <span className="font-semibold">Triage:</span>{" "}
              {triage?.summary || "Not run yet"}
            </p>
            <p>
              <span className="font-semibold">Vision:</span>{" "}
              {visionRecon?.vision_summary || "Not run yet"}
            </p>
            <p>
              <span className="font-semibold">Diagnoses:</span>{" "}
              {finalDiag?.diagnoses
                ? `${finalDiag.diagnoses.length} options`
                : "Not generated yet"}
            </p>
            <p>
              <span className="font-semibold">Pricing:</span>{" "}
              {pricing
                ? `${pricing.currency} ${pricing.caf_recommended_sell_price.toFixed(
                    2
                  )}`
                : "Not priced yet"}
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
