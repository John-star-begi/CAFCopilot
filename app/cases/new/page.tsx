"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewCasePage() {
  const router = useRouter();

  const [eacoId, setEacoId] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  async function createCase(mode: "full" | "diagnosis" | "vision" | "pricing") {
    if (!description.trim()) {
      alert("Please enter a description.");
      return;
    }

    setLoading(true);

    try {
      const res = await fetch("/api/cases/create", {
        method: "POST",
        body: JSON.stringify({
          eaco_id: eacoId.trim(),
          description: description.trim(),
          tool_mode: mode,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        console.error(data);
        alert("Failed to create case.");
        return;
      }

      const newId = data.id;

      // Redirect based on selected tool
      switch (mode) {
        case "full":
          router.push(`/cases/${newId}`);
          break;
        case "diagnosis":
          router.push(`/cases/${newId}?tool=diagnosis`);
          break;
        case "vision":
          router.push(`/cases/${newId}?tool=vision`);
          break;
        case "pricing":
          router.push(`/cases/${newId}?tool=pricing`);
          break;
      }
    } catch (e) {
      console.error(e);
      alert("Error creating case.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="p-8 max-w-xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold">Create New Case</h1>

      {/* EACO NUMBER */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-gray-700">
          EACO Job Number
        </label>
        <input
          type="text"
          placeholder="Optional"
          value={eacoId}
          onChange={(e) => setEacoId(e.target.value)}
          className="w-full border p-3 rounded-md text-sm"
        />
      </div>

      {/* DESCRIPTION */}
      <div className="space-y-2">
        <label className="text-sm font-semibold text-gray-700">
          Job Description
        </label>
        <textarea
          placeholder="Paste job description from EACO"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={5}
          className="w-full border p-3 rounded-md text-sm"
        />
      </div>

      {/* TOOL MODE BUTTONS */}
      <div className="space-y-4">
        <p className="text-sm text-gray-600">
          Choose the tool mode you want to use:
        </p>

        <div className="grid grid-cols-1 gap-3">
          <button
            onClick={() => createCase("full")}
            disabled={loading}
            className="w-full bg-black text-white px-4 py-3 rounded-md hover:bg-gray-900 disabled:bg-gray-400"
          >
            Full Workflow (Triage → Vision → Diagnosis → Pricing)
          </button>

          <button
            onClick={() => createCase("diagnosis")}
            disabled={loading}
            className="w-full bg-blue-600 text-white px-4 py-3 rounded-md hover:bg-blue-700 disabled:bg-gray-400"
          >
            Diagnosis Only
          </button>

          <button
            onClick={() => createCase("vision")}
            disabled={loading}
            className="w-full bg-purple-600 text-white px-4 py-3 rounded-md hover:bg-purple-700 disabled:bg-gray-400"
          >
            Vision Analysis Only
          </button>

          <button
            onClick={() => createCase("pricing")}
            disabled={loading}
            className="w-full bg-emerald-600 text-white px-4 py-3 rounded-md hover:bg-emerald-700 disabled:bg-gray-400"
          >
            Pricing Only
          </button>
        </div>
      </div>
    </main>
  );
}
