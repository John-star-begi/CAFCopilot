"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Diagnosis = {
  title: string;
  description: string;
  trade_required?: string;
  estimated_labor_minutes?: number;
  estimated_material_cost?: number;
  materials_needed?: string[];
  safety_concerns?: string[];
};

type PricingResponse = {
  currency: string;
  final_recommended_price: number;
  labour_minutes_estimated: number;
  labour_cost_estimated: number;
  materials_cost_estimated: number;
  materials_with_markup: number;
  job_markup_percent: number;
  job_markup_amount: number;
  subtotal_before_markup: number;
  notes?: string;
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
      caseData.diagnoses || [
        {
          title: "",
          description: "",
          trade_required: "",
          estimated_labor_minutes: 60,
          estimated_material_cost: 0,
          materials_needed: [],
        },
      ],
      null,
      2
    )
  );

  // -----------------------------
  // Process manual JSON paste
  // -----------------------------
  const loadManualDiagnosis = () => {
    try {
      const parsed = JSON.parse(manualDiagJSON);
      if (!Array.isArray(parsed)) throw new Error("Diagnosis must be an array.");

      setDiagnoses(parsed);
      alert("Diagnosis loaded successfully.");
    } catch (e: any) {
      alert("Invalid JSON: " + e.message);
    }
  };

  // -----------------------------
  // Run Pricing
  // -----------------------------
  const runPricing = async () => {
    if (!selectedDiag) {
      alert("Select a diagnosis first.");
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

  // -----------------------------
  // Helper: Safe value
  // -----------------------------
  const safeArr = (v: any) => (Array.isArray(v) ? v : []);

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <section className="mt-6 border rounded-xl p-6 bg-white space-y-6">
      <h2 className="text-xl font-semibold">Pricing Generator Only</h2>
      <p className="text-sm text-gray-600">
        Select a diagnosis or paste one manually, then calculate pricing.
      </p>

      {/* ------------------------
          SOURCE OF DIAGNOSIS
      ------------------------ */}
      <div className="p-4 border rounded-lg bg-gray-50">
        <h3 className="text-sm font-semibold mb-2">Diagnosis Source</h3>
        <p className="text-xs text-gray-600 mb-2">
          You can use the stored diagnoses OR paste new ones.
        </p>

        <textarea
          value={manualDiagJSON}
          onChange={(e) => setManualDiagJSON(e.target.value)}
          rows={6}
          className="w-full border rounded p-2 text-xs font-mono"
        />

        <button
          onClick={loadManualDiagnosis}
          className="mt-2 bg-gray-800 text-white px-3 py-1.5 rounded text-xs hover:bg-black"
        >
          Load Diagnosis From JSON
        </button>
      </div>

      {/* ------------------------
          DIAGNOSIS LIST
      ------------------------ */}
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
            </button>
          ))}
        </div>
      </div>

      {/* ------------------------
          SHOW SELECTED DIAGNOSIS
      ------------------------ */}
      {selectedDiag && (
        <div className="p-4 border rounded-lg space-y-3 bg-gray-50">
          <h3 className="text-sm font-semibold">Selected Diagnosis</h3>

          <p className="text-sm text-gray-800">{selectedDiag.description}</p>

          <div className="text-xs text-gray-600 space-y-1">
            <p>
              Estimated Labour: {selectedDiag.estimated_labor_minutes || "N/A"}{" "}
              minutes
            </p>
            <p>
              Estimated Materials: $
              {selectedDiag.estimated_material_cost || 0}
            </p>

            {safeArr(selectedDiag.materials_needed).length > 0 && (
              <div className="mt-2">
                <p className="font-semibold mb-1">Materials Needed:</p>
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
            {pricingLoading ? "Calculating..." : "Calculate Price"}
          </button>

          {pricingError && (
            <p className="text-sm text-red-600">{pricingError}</p>
          )}
        </div>
      )}

      {/* ------------------------
          PRICING OUTPUT
      ------------------------ */}
      {pricing && (
        <div className="border-t pt-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">
            Pricing Suggestion (AI)
          </h3>

          <div className="bg-gray-100 p-4 rounded-lg text-sm space-y-2">
            <p>
              <span className="font-semibold">Final Recommended Quote: </span>
              {pricing.currency}{" "}
              {pricing.final_recommended_price.toFixed(2)}
            </p>

            <p>
              Labour Cost: {pricing.currency}{" "}
              {pricing.labour_cost_estimated.toFixed(2)}
            </p>

            <p>
              Materials (with markup): {pricing.currency}{" "}
              {pricing.materials_with_markup.toFixed(2)}
            </p>

            <p>
              Subtotal: {pricing.currency}{" "}
              {pricing.subtotal_before_markup.toFixed(2)}
            </p>

            <p>
              Markup ({pricing.job_markup_percent}%): {pricing.currency}{" "}
              {pricing.job_markup_amount.toFixed(2)}
            </p>

            {pricing.notes && (
              <p className="text-xs text-gray-600">Notes: {pricing.notes}</p>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
