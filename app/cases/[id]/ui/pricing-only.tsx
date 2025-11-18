"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

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

export default function PricingOnlyWorkspace({ caseData }: { caseData: any }) {
  const [inputText, setInputText] = useState(
    caseData.description || "Enter subcontractor quote or job description..."
  );

  const [pricing, setPricing] = useState<PricingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const badgeClass = (value: string) => {
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

  const runPricing = async () => {
    if (!inputText.trim()) {
      alert("Enter a description or subcontractor quote.");
      return;
    }

    setLoading(true);
    setError(null);
    setPricing(null);

    try {
      const res = await fetch("/api/triage/pricing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(inputText),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Pricing failed.");
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
      setError(err?.message || "Unknown pricing error.");
    } finally {
      setLoading(false);
    }
  };

  const safeArr = (v: any) => (Array.isArray(v) ? v : []);

  return (
    <section className="mt-6 p-6 border rounded-xl bg-white space-y-6">
      <h2 className="text-xl font-semibold">Pricing Brain</h2>

      <p className="text-sm text-gray-600">
        Paste a subcontractor quote or a plain job description.  
        The Pricing Brain will auto-detect pricing, scope, market ranges and markup.
      </p>

      {/* Text input */}
      <div className="border rounded-lg bg-gray-50 p-4">
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          rows={8}
          className="w-full p-3 text-sm border rounded-lg font-mono"
        />

        <button
          onClick={runPricing}
          disabled={loading}
          className="mt-3 bg-purple-700 text-white px-4 py-2 rounded-md text-sm hover:bg-purple-800 disabled:bg-gray-400"
        >
          {loading ? "Calculating..." : "Run Pricing Brain"}
        </button>

        {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      </div>

      {/* Results */}
      {pricing && (
        <div className="space-y-6 border-t pt-6">
          {/* Summary */}
          <div className="bg-gray-900 text-gray-100 rounded-lg p-4 space-y-2">
            <p className="text-xs uppercase tracking-wide text-gray-400">
              CAF Recommended Sell Price
            </p>
            <p className="text-3xl font-semibold">
              {formatMoney(pricing.caf_recommended_sell_price, pricing.currency)}
            </p>

            {/* Fair Range + Subbie */}
            <div className="flex justify-between text-sm mt-2">
              <div>
                <p className="text-xs text-gray-400">Fair Market Range</p>
                <p>
                  {formatMoney(pricing.fair_range_low, pricing.currency)} –{" "}
                  {formatMoney(pricing.fair_range_high, pricing.currency)}
                </p>
              </div>

              <div className="text-right">
                <p className="text-xs text-gray-400">Subbie Quote</p>
                <p>
                  {pricing.subcontractor_quote_incl_gst
                    ? formatMoney(
                        pricing.subcontractor_quote_incl_gst,
                        pricing.currency
                      )
                    : "None entered"}
                </p>
              </div>
            </div>

            {/* Market Position */}
            <div className="flex justify-end">
              <span
                className={
                  "px-3 py-1 rounded-full text-xs font-medium " +
                  badgeClass(pricing.caf_position_after_markup)
                }
              >
                {formatPosition(pricing.caf_position_after_markup)}
              </span>
            </div>
          </div>

          {/* Markup Block */}
          <div className="bg-gray-50 p-4 border rounded-lg space-y-1">
            <h3 className="text-sm font-semibold">Markup Recommendation</h3>
            <p>
              <span className="font-semibold">Recommended markup: </span>
              {pricing.recommended_markup_percent.toFixed(1)}%
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
              <span className="font-semibold">Action: </span>
              {pricing.should_negotiate_or_change_subbie
                ? "Consider negotiating or changing subcontractor."
                : "Subbie pricing acceptable with markup."}
            </p>
          </div>

          {/* Breakdown Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left column */}
            <div className="border rounded-lg p-4 bg-white space-y-4">
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

            {/* Right column */}
            <div className="border rounded-lg p-4 bg-white space-y-4">
              <div>
                <h4 className="text-sm font-semibold mb-1">
                  Baseline Cost Build-Up (ex GST)
                </h4>
                <table className="w-full text-[11px] border rounded">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="text-left px-2 py-1">Item</th>
                      <th className="text-right px-2 py-1">Cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {safeArr(pricing.breakdown.baseline_costs).map(
                      (row: any, index: number) => (
                        <tr
                          key={index}
                          className={index % 2 ? "bg-gray-50" : "bg-white"}
                        >
                          <td className="px-2 py-1">
                            <div className="font-medium">{row.item}</div>
                            {row.notes && (
                              <div className="text-[10px] text-gray-500">
                                {row.notes}
                              </div>
                            )}
                          </td>
                          <td className="px-2 py-1 text-right">
                            {formatMoney(row.estimated_cost_ex_gst, "AUD")}
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>

              <div>
                <h4 className="text-sm font-semibold mb-1">
                  Market Benchmarks
                </h4>
                <ul className="list-disc list-inside text-[11px] text-gray-700">
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
