"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

type Diagnosis = {
  title: string;
  description: string;
  trade_required?: string;
  subbie_quote_incl_gst?: number;
  estimated_labor_minutes?: number;
  estimated_material_cost?: number;
  materials_needed?: string[];
  safety_concerns?: string[];
};

type PricingResponse = {
  currency: string;
  market_lower_bound: number;
  market_upper_bound: number;
  subcontractor_quote_incl_gst: number;
  position_vs_market:
    | "below_range"
    | "lower_mid_range"
    | "mid_range"
    | "upper_mid_range"
    | "above_range"
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
    | string;
  should_negotiate_or_change_subbie: boolean;
  reasoning_summary: string;
};

export default function PricingOnlyWorkspace({ caseData }: { caseData: any }) {
  const [diagnoses, setDiagnoses] = useState<Diagnosis[]>(
    Array.isArray(caseData.diagnoses) ? caseData.diagnoses : []
  );

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [selectedDiag, setSelectedDiag] = useState<Diagnosis | null>(null);

  const [pricing, setPricing] = useState<PricingResponse | null>(null);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [pricingError, setPricingError] = useState<string | null>(null);

  const [manualDiagJSON, setManualDiagJSON] = useState(
    JSON.stringify(
      caseData.diagnoses && Array.isArray(caseData.diagnoses)
        ? caseData.diagnoses
        : [
            {
              title: "Example tap replacement",
              description:
                "Supply and install new basin mixer tap. Remove old tap, fit new mid range mixer, test operation.",
              trade_required: "plumber",
              subbie_quote_incl_gst: 100,
              estimated_labor_minutes: 60,
              estimated_material_cost: 70,
              materials_needed: ["basin mixer tap", "plumbers tape"],
            },
          ],
      null,
      2
    )
  );

  const safeArr = (v: any) => (Array.isArray(v) ? v : []);

  // Load manual diagnosis JSON
  const loadManualDiagnosis = () => {
    try {
      const parsed = JSON.parse(manualDiagJSON);
      if (!Array.isArray(parsed)) {
        throw new Error("Diagnosis must be an array.");
      }
      setDiagnoses(parsed);
      setSelectedDiag(null);
      setSelectedIndex(null);
      setPricing(null);
      alert("Diagnosis loaded successfully.");
    } catch (e: any) {
      alert("Invalid JSON: " + e.message);
    }
  };

  // Run Pricing Brain
  const runPricing = async () => {
    if (!selectedDiag) {
      alert("Select a diagnosis first.");
      return;
    }

    if (
      selectedDiag.subbie_quote_incl_gst === undefined ||
      selectedDiag.subbie_quote_incl_gst === null
    ) {
      alert("Selected diagnosis is missing subcontractor quote (incl GST).");
      return;
    }

    setPricingLoading(true);
    setPricingError(null);
    setPricing(null);

    try {
      const res = await fetch("/api/triage/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selectedDiag),
      });

      const data = await res.json();

      if (!res.ok) {
        setPricingError(data.error || "Pricing failed.");
        return;
      }

      setPricing(data);

      await supabase
        .from("cases")
        .update({
          pricing: data,
          status: "priced",
        })
        .eq("id", caseData.id);
    } catch (err: any) {
      setPricingError(err?.message || "Unknown pricing error.");
    } finally {
      setPricingLoading(false);
    }
  };

  const formatPosition = (value: string) => {
    switch (value) {
      case "below_range":
        return "Below market range";
      case "lower_mid_range":
        return "Lower mid market";
      case "mid_range":
        return "Mid market";
      case "upper_mid_range":
        return "Upper mid market";
      case "above_range":
        return "Above market range";
      default:
        return value;
    }
  };

  return (
    <section className="mt-6 border rounded-xl p-6 bg-white space-y-6">
      <h2 className="text-xl font-semibold">Pricing Brain (Quote Checker)</h2>
      <p className="text-sm text-gray-600">
        Load or paste diagnoses that include the subcontractor quote, then let
        the Pricing Brain compare it to the Melbourne market and suggest a CAF
        sell price.
      </p>

      {/* Diagnosis source */}
      <div className="p-4 border rounded-lg bg-gray-50 space-y-2">
        <h3 className="text-sm font-semibold mb-1">Diagnosis Source</h3>
        <p className="text-xs text-gray-600">
          Paste an array of diagnoses. Each item should include at least a
          description and a field like{" "}
          <code className="font-mono text-[11px]">
            subbie_quote_incl_gst
          </code>{" "}
          for the subcontractor quote including GST.
        </p>

        <textarea
          value={manualDiagJSON}
          onChange={(e) => setManualDiagJSON(e.target.value)}
          rows={8}
          className="w-full border rounded p-2 text-xs font-mono"
        />

        <button
          onClick={loadManualDiagnosis}
          className="mt-2 bg-gray-800 text-white px-3 py-1.5 rounded text-xs hover:bg-black"
        >
          Load Diagnosis From JSON
        </button>
      </div>

      {/* Diagnosis list */}
      <div>
        <h3 className="text-sm font-semibold mb-2">Choose a Diagnosis</h3>

        {diagnoses.length === 0 && (
          <p className="text-xs text-red-500">
            No diagnoses available. Paste JSON above.
          </p>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {diagnoses.map((d, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setSelectedIndex(i);
                setSelectedDiag(d);
                setPricing(null);
              }}
              className={`text-left border rounded-lg p-4 bg-gray-50 hover:bg-white hover:shadow transition ${
                selectedIndex === i ? "ring-2 ring-slate-900" : ""
              }`}
            >
              <h4 className="font-semibold text-sm text-gray-900">
                {d.title || `Diagnosis ${i + 1}`}
              </h4>
              <p className="text-xs mt-1 text-gray-700 line-clamp-2">
                {d.description}
              </p>

              <p className="text-xs text-gray-500 mt-2">
                Trade: {d.trade_required || "N/A"}
              </p>
              <p className="text-xs text-gray-500">
                Subbie quote (incl GST):{" "}
                {d.subbie_quote_incl_gst !== undefined
                  ? `AUD ${d.subbie_quote_incl_gst}`
                  : "Not set"}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Selected diagnosis */}
      {selectedDiag && (
        <div className="p-4 border rounded-lg space-y-3 bg-gray-50">
          <h3 className="text-sm font-semibold">Selected Diagnosis</h3>

          <p className="text-sm text-gray-800">{selectedDiag.description}</p>

          <div className="text-xs text-gray-600 space-y-1">
            <p>
              Trade: {selectedDiag.trade_required || "N/A"}
            </p>
            <p>
              Subcontractor quote (incl GST):{" "}
              {selectedDiag.subbie_quote_incl_gst !== undefined
                ? `AUD ${selectedDiag.subbie_quote_incl_gst}`
                : "Not set"}
            </p>
            <p>
              Estimated labour:{" "}
              {selectedDiag.estimated_labor_minutes || "N/A"} minutes
            </p>
            <p>
              Estimated materials: $
              {selectedDiag.estimated_material_cost || 0}
            </p>

            {safeArr(selectedDiag.materials_needed).length > 0 && (
              <div className="mt-2">
                <p className="font-semibold mb-1">Materials needed:</p>
                <ul className="list-disc list-inside">
                  {selectedDiag.materials_needed!.map((m, i) => (
                    <li key={i}>{m}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          <button
            onClick={runPricing}
            disabled={pricingLoading}
            className="bg-purple-700 text-white px-4 py-2 rounded-md text-sm hover:bg-purple-800 disabled:bg-gray-400"
          >
            {pricingLoading ? "Calculating..." : "Calculate CAF Pricing"}
          </button>

          {pricingError && (
            <p className="text-sm text-red-600">{pricingError}</p>
          )}
        </div>
      )}

      {/* Pricing output */}
      {pricing && (
        <div className="border-t pt-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">
            Pricing Suggestion (AI)
          </h3>

          <div className="bg-gray-100 p-4 rounded-lg text-sm space-y-2">
            <p>
              <span className="font-semibold">Market range: </span>
              {pricing.currency}{" "}
              {pricing.market_lower_bound.toFixed(2)} to{" "}
              {pricing.currency}{" "}
              {pricing.market_upper_bound.toFixed(2)}
            </p>

            <p>
              <span className="font-semibold">
                Subbie quote position:
              </span>{" "}
              {formatPosition(pricing.position_vs_market)} (
              {pricing.currency}{" "}
              {pricing.subcontractor_quote_incl_gst.toFixed(2)})
            </p>

            <p>
              <span className="font-semibold">
                Recommended markup:
              </span>{" "}
              {pricing.recommended_markup_percent}% (
              {pricing.currency}{" "}
              {pricing.recommended_markup_amount.toFixed(2)})
            </p>

            <p>
              <span className="font-semibold">
                CAF recommended sell price:
              </span>{" "}
              {pricing.currency}{" "}
              {pricing.caf_recommended_sell_price.toFixed(2)}{" "}
              <span className="text-xs text-gray-600">
                ({formatPosition(pricing.caf_position_after_markup)})
              </span>
            </p>

            <p>
              <span className="font-semibold">Action: </span>
              {pricing.should_negotiate_or_change_subbie
                ? "Consider negotiating or changing subcontractor."
                : "Subbie quote is acceptable with this markup."}
            </p>

            <p className="text-xs text-gray-700 mt-2">
              <span className="font-semibold">Reasoning: </span>
              {pricing.reasoning_summary}
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
