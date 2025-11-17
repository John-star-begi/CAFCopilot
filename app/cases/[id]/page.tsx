import { supabase } from "@/lib/supabase";
import Link from "next/link";
import FullWorkspace from "./ui/full-workflow";
import DiagnosisOnlyWorkspace from "./ui/diagnosis-only";
import VisionOnlyWorkspace from "./ui/vision-only";
import PricingOnlyWorkspace from "./ui/pricing-only";

export const revalidate = 0;

export default async function CasePage({ params, searchParams }: any) {
  const { id } = params;
  const toolOverride = searchParams?.tool;

  const { data: c } = await supabase
    .from("cases")
    .select("*")
    .eq("id", id)
    .single();

  if (!c) {
    return (
      <main className="p-10">
        <Link href="/" className="text-sm underline text-blue-600">
          ← Back
        </Link>
        <p className="text-red-600 mt-4">Case not found.</p>
      </main>
    );
  }

  // Determine which mode to load
  const mode = toolOverride || c.tool_mode || "full";

  function renderWorkspace() {
    switch (mode) {
      case "diagnosis":
        return <DiagnosisOnlyWorkspace caseData={c} />;
      case "vision":
        return <VisionOnlyWorkspace caseData={c} />;
      case "pricing":
        return <PricingOnlyWorkspace caseData={c} />;
      default:
        return <FullWorkspace caseData={c} />;
    }
  }

  return (
    <main className="p-8 max-w-4xl mx-auto space-y-8">
      <Link href="/" className="text-sm underline text-blue-600">
        ← Back to List
      </Link>

      <header>
        <h1 className="text-3xl font-bold text-slate-900">
          {c.title || "Case Workspace"}
        </h1>

        <div className="mt-2 text-sm text-slate-600 space-y-1">
          <p>
            <span className="font-semibold">EACO:</span> {c.eaco_id || "N/A"}
          </p>
          <p>
            <span className="font-semibold">Mode:</span>{" "}
            {mode.charAt(0).toUpperCase() + mode.slice(1)}
          </p>
          <p>
            <span className="font-semibold">Created:</span>{" "}
            {new Date(c.created_at).toLocaleString()}
          </p>
        </div>
      </header>

      {/* Selected workspace */}
      <section className="border rounded-xl bg-white p-6 shadow-sm">
        {renderWorkspace()}
      </section>
    </main>
  );
}
