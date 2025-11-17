import { supabase } from "@/lib/supabase";
import Link from "next/link";

export const revalidate = 0;

export default async function CasePage({ params }: { params: { id: string } }) {
  const { id } = params;

  // Fetch case data
  const { data: c, error } = await supabase
    .from("cases")
    .select("*")
    .eq("id", id)
    .single();

  if (!c) {
    return (
      <div className="max-w-4xl mx-auto p-10">
        <p className="text-red-600 font-medium">Case not found.</p>
        <Link href="/" className="text-blue-600 underline block mt-4 text-sm">
          ← Back to list
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-10">
      {/* BACK */}
      <div>
        <Link
          href="/"
          className="text-sm text-blue-600 hover:underline inline-flex items-center gap-1"
        >
          ← Back to cases
        </Link>
      </div>

      {/* TITLE BLOCK */}
      <header className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">
          {c.title || "Case Workspace"}
        </h1>

        <div className="flex flex-col text-sm text-slate-600">
          <span>
            <strong>EACO ID:</strong> {c.eaco_id || "N/A"}
          </span>
          <span>
            <strong>Created:</strong>{" "}
            {new Date(c.created_at).toLocaleString()}
          </span>
        </div>
      </header>

      {/* DESCRIPTION BLOCK */}
      <section className="p-6 bg-white border rounded-xl shadow-sm space-y-3">
        <h2 className="text-xl font-semibold text-slate-900">Description</h2>
        <p className="text-slate-700 whitespace-pre-line leading-relaxed">
          {c.description || "No description provided."}
        </p>
      </section>

      {/* PLACEHOLDER FOR FULL WORKSPACE */}
      <section className="p-8 bg-white border rounded-xl shadow-sm text-center">
        <p className="text-slate-400 text-sm">
          The full triage workspace UI for this case will appear here.
          <br />
          <span className="text-xs">Phase 3 and Phase 4 will populate this area.</span>
        </p>
      </section>
    </div>
  );
}
