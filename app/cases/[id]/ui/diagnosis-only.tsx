"use client";

import { useState } from "react";

type DiagnosisOnlyProps = {
  caseData: {
    id: string;
    description: string | null;
  };
};

type TriageResult = {
  category?: string;
  summary?: string;
  hazards?: string[];
  questions?: string[];
  questions_dispatcher?: string[];
  questions_tenant?: string[];
};

type FinalDiagnosisItem = {
  title: string;
  description: string;
  confidence: number;
  safety_concerns?: string[];
  repair_steps?: string[];
};

type FinalDiagnosisResult = {
  diagnoses: FinalDiagnosisItem[];
};

export default function DiagnosisOnlyWorkspace({ caseData }: DiagnosisOnlyProps) {
  const [triageLoading, setTriageLoading] = useState(false);
  const [triageError, setTriageError] = useState("");
  const [triageResult, setTriageResult] = useState<TriageResult | null>(null);

  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [finalDiagLoading, setFinalDiagLoading] = useState(false);
  const [finalDiagResult, setFinalDiagResult] =
    useState<FinalDiagnosisResult | null>(null);

  const [selectedDiagIndex, setSelectedDiagIndex] = useState<number | null>(
    null
  );

  const selectedDiagnosis =
    finalDiagResult?.diagnoses?.[
      selectedDiagIndex != null ? selectedDiagIndex : -1
    ] || null;

  // Helper: merge all question sources into one flat array of strings
  const triageQuestions: string[] =
    triageResult
      ? [
          ...(triageResult.questions || []),
          ...(triageResult.questions_dispatcher || []),
          ...(triageResult.questions_tenant || []),
        ]
      : [];

  // -------------------------
  // RUN INITIAL TRIAGE
  // -------------------------
  const runTriage = async () => {
    if (!caseData.description || !caseData.description.trim()) {
      setTriageError("No description found on this case.");
      return;
    }

    setTriageLoading(true);
    setTriageError("");
    setTriageResult(null);
    setFinalDiagResult(null);
    setSelectedDiagIndex(null);
    setAnswers({});

    try {
      const res = await fetch("/api/triage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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

      // Build answer map for all questions (dispatcher + tenant)
      const allQs: string[] = [
        ...(data.questions || []),
        ...(data.questions_dispatcher || []),
        ...(data.questions_tenant || []),
      ];

      if (allQs.length > 0) {
        const empty: Record<string, string> = {};
        allQs.forEach((q: string) => {
          empty[q] = "";
        });
        setAnswers(empty);
      }

      // Best-effort: save triage to case (if /api/cases/update exists)
      try {
        await fetch("/api/cases/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: caseData.id,
            updates: { triage: data },
          }),
        });
      } catch {
        // non-fatal – continue even if saving fails
      }
    } catch (err: any) {
      console.error(err);
      setTriageLoading(false);
      setTriageError(err?.message || "Unexpected error during triage.");
    }
  };

  // -------------------------
  // RUN FINAL DIAGNOSIS
  // -------------------------
  const runFinalDiagnosis = async () => {
    if (!triageResult) {
      alert("Please run triage first.");
      return;
    }

    setFinalDiagLoading(true);
    setFinalDiagResult(null);
    setSelectedDiagIndex(null);

    try {
      const res = await fetch("/api/triage/final-diagnosis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description: caseData.description,
          dispatcher_answers: answers,
          tenant_answers: {}, // Diagnosis-only mode – no tenant text here yet
          vision: null, // This mode ignores vision; full workflow will supply it
        }),
      });

      const data = await res.json();
      setFinalDiagLoading(false);

      if (!res.ok) {
        alert(data.error || "Final diagnosis failed.");
        return;
      }

      setFinalDiagResult(data);
      if (data.diagnoses && data.diagnoses.length > 0) {
        setSelectedDiagIndex(0);
      }

      // Best-effort: save diagnosis to case
      try {
        await fetch("/api/cases/update", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: caseData.id,
            updates: { diagnosis: data },
          }),
        });
      } catch {
        // ignore error - non-blocking
      }
    } catch (err: any) {
      console.error(err);
      setFinalDiagLoading(false);
      alert(err?.message || "Unexpected error during final diagnosis.");
    }
  };

  return (
    <div className="space-y-6">
      {/* SECTION 1 — Description */}
      <section className="p-6 bg-white border rounded-xl shadow-sm space-y-3">
        <h2 className="text-xl font-semibold text-slate-900">
          Case Description
        </h2>
        <p className="text-slate-700 whitespace-pre-line">
          {caseData.description || "No description provided for this case."}
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
              {triageResult.category || "Unknown"}
            </p>
            <p className="text-sm">
              <span className="font-medium">Summary:</span>{" "}
              {triageResult.summary || "No summary provided."}
            </p>

            {/* Checklist */}
            {triageQuestions.length > 0 && (
              <div className="mt-3 space-y-2">
                <h3 className="font-semibold">Questions to Answer</h3>

                <div className="space-y-3">
                  {triageQuestions.map((q, i) => (
                    <div
                      key={i}
                      className="flex flex-col space-y-1"
                    >
                      <label className="text-sm font-medium">{q}</label>
                      <input
                        value={answers[q] ?? ""}
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
            {finalDiagResult.diagnoses.map((diag, idx) => (
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
              <h2 className="text-lg font-semibold">
                {selectedDiagnosis.title}
              </h2>
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

            {selectedDiagnosis.safety_concerns &&
              selectedDiagnosis.safety_concerns.length > 0 && (
                <div>
                  <h3 className="font-semibold">Safety Concerns</h3>
                  <ul className="list-disc list-inside text-sm">
                    {selectedDiagnosis.safety_concerns.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}

            {selectedDiagnosis.repair_steps &&
              selectedDiagnosis.repair_steps.length > 0 && (
                <div>
                  <h3 className="font-semibold">Repair Steps</h3>
                  <ol className="list-decimal list-inside text-sm space-y-1">
                    {selectedDiagnosis.repair_steps.map((s, i) => (
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
