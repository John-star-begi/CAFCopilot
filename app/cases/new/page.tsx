"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export default function NewCasePage() {
  const router = useRouter();
  const [description, setDescription] = useState("");
  const [eacoId, setEacoId] = useState("");
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!description.trim() || !eacoId.trim()) {
      alert("Please fill both fields.");
      return;
    }

    setLoading(true);

    const res = await fetch("/api/cases/create", {
      method: "POST",
      body: JSON.stringify({
        eaco_id: eacoId.trim(),
        description: description.trim()
      })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || "Error creating case");
      setLoading(false);
      return;
    }

    router.push(`/cases/${data.id}`);
  };

  return (
    <main className="max-w-xl mx-auto p-10 space-y-8">
      <h1 className="text-2xl font-bold text-slate-900">Create New Case</h1>

      <div className="space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-700">
            EACO Job Number
          </label>
          <input
            className="w-full border rounded-lg p-3 mt-1"
            placeholder="Enter EACO job number…"
            value={eacoId}
            onChange={(e) => setEacoId(e.target.value)}
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-700">
            Job Description
          </label>
          <textarea
            className="w-full border rounded-lg p-3 mt-1"
            rows={6}
            placeholder="Paste the job description from EACO…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>

      <Button onClick={handleCreate} disabled={loading} className="w-full">
        {loading ? "Creating…" : "Create Case"}
      </Button>

      <Button
        variant="outline"
        className="w-full mt-2"
        onClick={() => router.push("/")}
      >
        Cancel
      </Button>
    </main>
  );
}
