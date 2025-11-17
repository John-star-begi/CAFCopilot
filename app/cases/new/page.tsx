"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function NewCasePage() {
  const router = useRouter();
  const [eacoId, setEacoId] = useState("");
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<
    "full" | "diagnosis" | "vision" | "pricing" | null
  >(null);

  const createCase = async () => {
    if (!eacoId.trim()) {
      alert("Please enter an EACO job number.");
      return;
    }
    if (!mode) {
      alert("Please pick a tool mode.");
      return;
    }

    setLoading(true);

    const { data, error } = await supabase
      .from("cases")
      .insert([
        {
          eaco_id: eacoId,
          title: null,
          description: "",
          triage: null,
          vision: null,
          diagnosis: null,
          pricing: null,
          media: [],
          status: "new",
        },
      ])
      .select()
      .single();

    if (error || !data) {
      console.error(error);
      alert("Error creating case");
      setLoading(false);
      return;
    }

    // Redirect based on mode
    const id = data.id;

    if (mode === "full") router.push(`/cases/${id}/workspace`);
    if (mode === "diagnosis") router.push(`/cases/${id}/diagnosis`);
    if (mode === "vision") router.push(`/cases/${id}/vision`);
    if (mode === "pricing") router.push(`/cases/${id}/pricing`);

    setLoading(false);
  };

  return (
    <main className="max-w-xl mx-auto p-8 space-y-6">
      <h1 className="text-3xl font-bold text-slate-900 mb-4">
        Create New Case
      </h1>

      <div className="space-y-4 bg-white border p-6 rounded-xl shadow-sm">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-slate-700">
            EACO Job Number
          </label>
          <input
            type="text"
            value={eacoId}
            onChange={(e) => setEacoId(e.target.value)}
            className="w-full border p-3 rounded-md text-sm"
            placeholder="Enter job number..."
          />
        </div>

        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-700">
            What do you need?
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              onClick={() => setMode("full")}
              className={`p-4 border rounded-lg text-sm font-medium ${
                mode === "full" ? "bg-blue-600 text-white" : "bg-gray-100"
              }`}
            >
              Full Workflow
            </button>

            <button
              onClick={() => setMode("diagnosis")}
              className={`p-4 border rounded-lg text-sm font-medium ${
                mode === "diagnosis" ? "bg-blue-600 text-white" : "bg-gray-100"
              }`}
            >
              Diagnosis Only
            </button>

            <button
              onClick={() => setMode("vision")}
              className={`p-4 border rounded-lg text-sm font-medium ${
                mode === "vision" ? "bg-blue-600 text-white" : "bg-gray-100"
              }`}
            >
              Vision Only
            </button>

            <button
              onClick={() => setMode("pricing")}
              className={`p-4 border rounded-lg text-sm font-medium ${
                mode === "pricing" ? "bg-blue-600 text-white" : "bg-gray-100"
              }`}
            >
              Pricing Only
            </button>
          </div>
        </div>

        <button
          disabled={loading}
          onClick={createCase}
          className="w-full bg-slate-900 text-white p-3 rounded-md text-sm font-medium hover:bg-black"
        >
          {loading ? "Creating..." : "Create Case"}
        </button>
      </div>
    </main>
  );
}
