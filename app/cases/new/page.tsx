"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewCasePage() {
  const router = useRouter();

  const [eacoId, setEacoId] = useState("");
  const [description, setDescription] = useState("");
  const [toolMode, setToolMode] = useState<null | string>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const createCase = async () => {
    if (!description.trim()) {
      setErrorMsg("Please enter a case description.");
      return;
    }
    if (!toolMode) {
      setErrorMsg("Please choose a tool mode.");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    const res = await fetch("/api/cases/create", {
      method: "POST",
      body: JSON.stringify({
        eaco_id: eacoId || null,
        description,
        tool_mode: toolMode,
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setErrorMsg(data.error || "Failed to create case.");
      return;
    }

    // redirect to the new case workspace
    router.push(`/cases/${data.id}`);
  };

  return (
    <main className="p-8 max-w-xl mx-auto space-y-8">
      <button
        onClick={() => router.push("/")}
        className="text-sm text-blue-600 underline"
      >
        ← Back to list
      </button>

      <h1 className="text-2xl font-bold">Create New Case</h1>

      {/* EACO ID */}
      <div className="space-y-1">
        <label className="text-sm font-medium">EACO Number</label>
        <input
          value={eacoId}
          onChange={(e) => setEacoId(e.target.value)}
          placeholder="Optional"
          className="w-full p-2 border rounded-md"
        />
      </div>

      {/* Description */}
      <div className="space-y-1">
        <label className="text-sm font-medium">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe the issue..."
          className="w-full p-3 border rounded-md min-h-[120px]"
        />
      </div>

      {/* TOOL MODE BUTTON GRID */}
      <div className="grid grid-cols-2 gap-4">
        <button
          className={`p-4 rounded-xl border ${
            toolMode === "full" ? "bg-blue-600 text-white" : "bg-gray-100"
          }`}
          onClick={() => setToolMode("full")}
        >
          Full Workflow
        </button>

        <button
          className={`p-4 rounded-xl border ${
            toolMode === "diagnosis" ? "bg-blue-600 text-white" : "bg-gray-100"
          }`}
          onClick={() => setToolMode("diagnosis")}
        >
          Diagnosis Only
        </button>

        <button
          className={`p-4 rounded-xl border ${
            toolMode === "vision" ? "bg-blue-600 text-white" : "bg-gray-100"
          }`}
          onClick={() => setToolMode("vision")}
        >
          Vision Only
        </button>

        <button
          className={`p-4 rounded-xl border ${
            toolMode === "pricing" ? "bg-blue-600 text-white" : "bg-gray-100"
          }`}
          onClick={() => setToolMode("pricing")}
        >
          Pricing Only
        </button>
      </div>

      {/* Error */}
      {errorMsg && <p className="text-red-600 text-sm">{errorMsg}</p>}

      {/* Create Button */}
      <button
        onClick={createCase}
        disabled={loading}
        className="w-full bg-slate-900 text-white py-3 rounded-md font-semibold hover:bg-black disabled:bg-gray-500"
      >
        {loading ? "Creating..." : "Create Case"}
      </button>
    </main>
  );
}
