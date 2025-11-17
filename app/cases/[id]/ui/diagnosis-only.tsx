"use client";

import { useState } from "react";

export default function DiagnosisOnlyWorkspace({ caseData }: any) {
  const [triageLoading, setTriageLoading] = useState(false);
  const [triageError, setTriageError] = useState("");
  const [triageResult, setTriageResult] = useState<any>(null);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [finalDiagLoading, setFinalDiagLoading] = useState(false);
  const [finalDiagResult, setFinalDiagResult] = useState<any>(null);

  const [selectedDiagIndex, setSelectedDiagIndex] = useState<number | null>(null);

  const selectedDiagnosis =
    finalDiagResult?.diagnoses?.[selectedDiagIndex ?? -1] || null;

  // -------------------------
  // RUN INITIAL TRIAGE
  // -------------------------
  const runTriage = async () => {
    setTriageLoading(true);
    setTriageError("");
    setTriageResult(null);

    const res = await fetch("/api/triage", {
      method: "POST",
      body: JSON.stringify({
        description: caseData.description,
      }),
    });

    const data = await res.json();
    setTriageLoading(false);

    if (!res.ok) {
      setTriageError(data.error || "Triage failed.");
      return;
    }

    setTriageResult(data);

    // prepare blank answers
    if (data.questions) {
      const empty: any = {};
      data.questions.forEach((q: string) => (empty[q] = ""));
      setAnswers(empty);
    }
  };

  // -------------------------
  // RUN FINAL DIAGNOSIS
  // -------------------------
  const runFinalDiagnosis = async () => {
    setFinalDiagLoading(true);
    setFinalDiagResult(null);

    const res = await fetch("/api/triage/final-diagnosis", {
      method: "POST",
      body: JSON.stringify({
        description: caseData.description,
        answers,
        triage: triageResult,
      }),
    });

    const data = await res.json();
    setFinalDiagLoading(false);

    if (!res.ok) {
      alert(data.error || "Final diagnosis failed.");
      return;
    }

    setFinalDiagResult(data);
  };

  return (
    <div className="space-y-6">

      {/* SECTION 1 — Description */}
      <section className="p-6 bg-white border rounded-xl shadow-sm space-y-3">
        <h2 className="text-xl font-semibold text-slate-900">Case Description</h2>
        <p className="text-slate-700 whitespace-pre-line">
          {caseData.description}
        </p>
      </section>

      {/* SECTION 2 — Triage */}
      <section className="p-6 bg-white border rounded-xl shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-900">
            Step 1 — Run Triage
          </h2>

          <button
            onClick={runTriage}
            disabled={triageLoading}
            className="px-4 py-2 bg-slate-900 text-white rounded-md hover:bg-black disabled:bg-gray-500"
          >
            {triageLoading ? "Analyzing..." : "Run Triage"}
          </button>
        </div>

        {triageError && (
          <p className="text-red-600 text-sm">{triageError}</p>
        )}

        {triageResult && (
          <div className="border-t pt-4 space-y-3">
            <h3 className="text-lg font-semibold">Triage Summary</h3>

            <p className="text-sm">
              <span className="font-medium">Category:</span>{" "}
              {triageResult.category}
            </p>
            <p className="text-sm">
              <span className="font-medium">Summary:</span>{" "}
              {triageResult.summary}
            </p>

            {/* Checklist */}
            {triageResult.questions?.length > 0 && (
              <div className="mt-3 space-y-2">
                <h3 className="font-semibold">Questions to Answer</h3>

                <div className="space-y-3">
                  {triageResult.questions.map((q: string, i: number) => (
                    <div key={i} className="flex flex-col space-y-1">
                      <label className="text-sm font-medium">{q}</label>
                      <input
                        value={answers[q] || ""}
                        onChange={(e) =>
                          setAnswers((prev) => ({
                            ...prev,
                            [q]: e.target.value,
                          }))
                        }
                        placeholder="Answer or type: I DON'T KNOW"
                        className="border p-2 rounded-md"
                      />
                    </div>
                  ))}
                </div>

                <button
                  onClick={runFinalDiagnosis}
                  disabled={finalDiagLoading}
                  className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-500"
                >
                  {finalDiagLoading ? "Analyzing..." : "Generate Diagnosis"}
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      {/* SECTION 3 — Diagnosis Cards */}
      {finalDiagResult?.diagnoses && (
        <section className="p-6 bg-white border rounded-xl shadow-sm space-y-4">
          <h2 className="text-xl font-semibold">Diagnosis Results</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {finalDiagResult.diagnoses.map((diag: any, idx: number) => (
              <div
                key={idx}
                onClick={() => setSelectedDiagIndex(idx)}
                className="p-4 border rounded-lg bg-gray-50 hover:bg-white hover:shadow cursor-pointer"
              >
                <h3 className="font-semibold">{diag.title}</h3>
                <p className="text-sm mt-1">{diag.description}</p>
                <p className="text-xs text-gray-600 mt-2">
                  Confidence: {(diag.confidence * 100).toFixed(0)}%
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* MODAL */}
      {selectedDiagnosis && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl max-w-xl w-full space-y-4">
            <div className="flex justify-between items-start">
              <h2 className="text-lg font-semibold">{selectedDiagnosis.title}</h2>
              <button
                onClick={() => setSelectedDiagIndex(null)}
                className="text-sm text-gray-600 hover:text-black"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-gray-700">
              {selectedDiagnosis.description}
            </p>

            {selectedDiagnosis.safety_concerns?.length > 0 && (
              <div>
                <h3 className="font-semibold">Safety Concerns</h3>
                <ul className="list-disc list-inside text-sm">
                  {selectedDiagnosis.safety_concerns.map((s: string, i: number) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </div>
            )}

            {selectedDiagnosis.repair_steps?.length > 0 && (
              <div>
                <h3 className="font-semibold">Repair Steps</h3>
                <ol className="list-decimal list-inside text-sm space-y-1">
                  {selectedDiagnosis.repair_steps.map((s: string, i: number) => (
                    <li key={i}>{s}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
