"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

type Diagnosis = {
  title?: string;
  description?: string;
  trade_required?: string;
  subbie_quote_incl_gst?: number;
  [key: string]: any;
};

type BaselineCostItem = {
  item: string;
  estimated_cost_ex_gst: number;
  notes: string;
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
    baseline_costs: BaselineCostItem[];
    market_benchmarks: string[];
    comparison_summary: string;
    markup_strategy: string;
  };
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
      diagnoses.length
        ? diagnoses
        : [
            {
              title: "Replace kitchen tap",
              description:
                "Replace existing kitchen tap with a new standard mixer tap, including removal, install and test.",
              trade_required: "plumber",
              // Optional: if you already have a subbie price, include:
              // subbie_quote_incl_gst: 150
            },
          ],
      null,
      2
    )
  );

  const safeArr = (v: any) => (Array.isArray(v) ? v : []);

  const formatMoney = (value: number | null | undefined, currency: string) => {
    if (value === null || value === undefined || Number.isNaN(value)) {
      return "N/A";
    }
    return `${currency} ${value.toFixed(2)}`;
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
      case "n/a":
        return "Not applicable";
      default:
        return value;
    }
  };

  const positionBadgeClass = (value: string) => {
    switch (value) {
      case "below_range":
        return "bg-green-100 text-green-800";
      case "lower_mid_range":
      case "mid_range":
        return "bg-blue-100 text-blue-800";
      case "upper_mid_range":
        return "bg-amber-100 text-amber-800";
      case "above_range":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

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

  return (
    <section className="mt-6 border rounded-xl p-6 bg-white space-y-6">
      <h2 className="text-xl font-semibold">Pricing Brain</h2>
      <p className="text-sm text-gray-600">
        Paste simple descriptions (e.g. &quot;Replace kitchen tap&quot;) or
        full subcontractor quotes. Select a diagnosis and let the Pricing Brain
        estimate fair market pricing and a CAF sell price.
      </p>

      {/* Diagnosis source */}
      <div className="p-4 border rounded-lg bg-gray-50 space-y-2">
        <h3 className="text-sm font-semibold mb-1">Diagnosis Source</h3>
        <p className="text-xs text-gray-600">
          Paste an array of diagnosis objects. Each item can be as simple as a
          description, or can include a{" "}
          <code className="font-mono text-[11px]">
            subbie_quote_incl_gst
          </code>{" "}
          field if you already have a subcontractor price.
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
                {d.description || ""}
              </p>

              <p className="text-xs text-gray-500 mt-2">
                Trade: {d.trade_required || "N/A"}
              </p>
              <p className="text-xs text-gray-500">
                Subbie quote (incl GST):{" "}
                {d.subbie_quote_incl_gst !== undefined &&
                d.subbie_quote_incl_gst !== null
                  ? `AUD ${d.subbie_quote_incl_gst}`
                  : "Not provided"}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Selected diagnosis */}
      {selectedDiag && (
        <div className="p-4 border rounded-lg space-y-3 bg-gray-50">
          <h3 className="text-sm font-semibold">Selected Diagnosis</h3>

          <p className="text-sm text-gray-800">
            {selectedDiag.description || selectedDiag.title || ""}
          </p>

          <div className="text-xs text-gray-600 space-y-1">
            <p>Trade: {selectedDiag.trade_required || "N/A"}</p>
            <p>
              Subcontractor quote (incl GST):{" "}
              {selectedDiag.subbie_quote_incl_gst !== undefined &&
              selectedDiag.subbie_quote_incl_gst !== null
                ? `AUD ${selectedDiag.subbie_quote_incl_gst}`
                : "Not provided (direct CAF pricing case)"}
            </p>
          </div>

          <button
            onClick={runPricing}
            disabled={pricingLoading}
            className="bg-purple-700 text-white px-4 py-2 rounded-md text-sm hover:bg-purple-800 disabled:bg-gray-400"
          >
            {pricingLoading ? "Calculating..." : "Run Pricing Brain"}
          </button>

          {pricingError && (
            <p className="text-sm text-red-600">{pricingError}</p>
          )}
        </div>
      )}

      {/* Pricing output */}
      {pricing && (
        <div className="border-t pt-4 space-y-4">
          {/* Summary card */}
          <div className="bg-gray-900 text-gray-100 rounded-lg p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-gray-400">
                  CAF Recommended Sell Price
                </p>
                <p className="text-2xl font-semibold">
                  {formatMoney(
                    pricing.caf_recommended_sell_price,
                    pricing.currency
                  )}
                </p>
              </div>

              <div className="text-right">
                <p className="text-xs uppercase tracking-wide text-gray-400">
                  Fair Market Range (incl GST)
                </p>
                <p className="text-sm">
                  {formatMoney(pricing.fair_range_low, pricing.currency)} –{" "}
                  {formatMoney(pricing.fair_range_high, pricing.currency)}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 mt-2">
              <div>
                <p className="text-xs text-gray-400">
                  Subbie quote (incl GST)
                </p>
                <p className="text-sm">
                  {pricing.subcontractor_quote_incl_gst !== null
                    ? formatMoney(
                        pricing.subcontractor_quote_incl_gst,
                        pricing.currency
                      )
                    : "None – direct CAF pricing"}
                </p>
              </div>

              <div className="flex flex-col items-end text-xs">
                <span className="mb-1">CAF position after markup</span>
                <span
                  className={
                    "inline-flex items-center rounded-full px-2 py-1 text-[11px] font-medium " +
                    positionBadgeClass(pricing.caf_position_after_markup)
                  }
                >
                  {formatPosition(pricing.caf_position_after_markup)}
                </span>
              </div>
            </div>
          </div>

          {/* Markup block */}
          <div className="bg-gray-50 border rounded-lg p-4 text-sm space-y-1">
            <h3 className="text-sm font-semibold text-gray-800 mb-1">
              Markup & Action
            </h3>
            <p>
              <span className="font-semibold">Recommended markup: </span>
              {pricing.recommended_markup_percent.toFixed(1)} %
            </p>
            <p>
              <span className="font-semibold">Markup amount: </span>
              {formatMoney(
                pricing.recommended_markup_amount,
                pricing.currency
              )}
            </p>
            <p>
              <span className="font-semibold">CAF sell price: </span>
              {formatMoney(
                pricing.caf_recommended_sell_price,
                pricing.currency
              )}
            </p>
            <p>
              <span className="font-semibold">Subbie position: </span>
              {formatPosition(pricing.position_vs_market)}
            </p>
            <p>
              <span className="font-semibold">Recommended action: </span>
              {pricing.should_negotiate_or_change_subbie
                ? "Consider negotiating the subcontractor price or sourcing another subcontractor."
                : "Subcontractor pricing is workable with this markup."}
            </p>
          </div>

          {/* Breakdown cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Scope + comparison */}
            <div className="border rounded-lg p-4 bg-white space-y-3">
              <div>
                <h4 className="text-sm font-semibold mb-1">Scope Summary</h4>
                <p className="text-xs text-gray-700">
                  {pricing.breakdown.scope_summary}
                </p>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-1">
                  Comparison Summary
                </h4>
                <p className="text-xs text-gray-700">
                  {pricing.breakdown.comparison_summary}
                </p>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-1">
                  Markup Strategy
                </h4>
                <p className="text-xs text-gray-700">
                  {pricing.breakdown.markup_strategy}
                </p>
              </div>
            </div>

            {/* Baseline + benchmarks */}
            <div className="border rounded-lg p-4 bg-white space-y-3">
              <div>
                <h4 className="text-sm font-semibold mb-1">
                  Baseline Cost Build-Up (ex-GST)
                </h4>
                <div className="border rounded-md overflow-hidden">
                  <table className="w-full text-[11px]">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="text-left px-2 py-1">Item</th>
                        <th className="text-right px-2 py-1">Est. ex-GST</th>
                      </tr>
                    </thead>
                    <tbody>
                      {safeArr(
                        pricing.breakdown.baseline_costs
                      ).map((row: BaselineCostItem, idx: number) => (
                        <tr
                          key={idx}
                          className={
                            idx % 2 === 0 ? "bg-white" : "bg-gray-50"
                          }
                        >
                          <td className="px-2 py-1 align-top">
                            <div className="font-medium">
                              {row.item || "Item"}
                            </div>
                            {row.notes && (
                              <div className="text-[10px] text-gray-500">
                                {row.notes}
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-1 text-right align-top">
                            {row.estimated_cost_ex_gst !== undefined &&
                            row.estimated_cost_ex_gst !== null
                              ? formatMoney(
                                  row.estimated_cost_ex_gst,
                                  pricing.currency
                                )
                              : "N/A"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-1">
                  Market Benchmarks (Melbourne)
                </h4>
                <ul className="list-disc list-inside text-[11px] text-gray-700 space-y-0.5">
                  {safeArr(
                    pricing.breakdown.market_benchmarks
                  ).map((line: string, idx: number) => (
                    <li key={idx}>{line}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
