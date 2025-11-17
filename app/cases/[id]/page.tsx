import { supabase } from "@/lib/supabase";
import Link from "next/link";

export const revalidate = 0;

export default async function CasePage({ params }: any) {
  const { id } = params;

  const { data: c, error } = await supabase
    .from("cases")
    .select("*")
    .eq("id", id)
    .single();

  if (!c)
    return (
      <main className="p-10">
        <p className="text-red-600">Case not found.</p>
      </main>
    );

  return (
    <main className="p-10 max-w-4xl mx-auto space-y-6">
      <Link href="/" className="text-sm text-blue-600 underline">
        ← Back to list
      </Link>

      <h1 className="text-3xl font-bold text-slate-900">
        {c.title || "Case Workspace"}
      </h1>

      <div className="space-y-2">
        <p className="text-sm text-slate-600">
          <span className="font-semibold">EACO:</span> {c.eaco_id}
        </p>
        <p className="text-sm text-slate-600">
          <span className="font-semibold">Created:</span>{" "}
          {new Date(c.created_at).toLocaleString()}
        </p>
      </div>

      <section className="p-6 bg-white border rounded-xl shadow-sm space-y-4">
        <h2 className="text-xl font-semibold text-slate-900">
          Description
        </h2>
        <p className="text-slate-700 whitespace-pre-line">{c.description}</p>
      </section>

      <section className="p-6 bg-white border rounded-xl shadow-sm">
        <p className="text-slate-400 text-sm">
          The full triage workspace UI will be built here in Phase 3 and 4.
        </p>
      </section>
    </main>
  );
}
