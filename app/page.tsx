// app/page.tsx
import { supabase } from "@/lib/supabase";
import Link from "next/link";

export const revalidate = 0;

export default async function HomePage() {
  const { data: cases } = await supabase
    .from("cases")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="p-10 max-w-5xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Cases</h1>
      <p className="text-slate-600">A complete list of CAF triage cases.</p>

      <Link
        href="/cases/new"
        className="inline-block bg-slate-900 text-white px-4 py-2 rounded-md text-sm hover:bg-black"
      >
        + New Case
      </Link>

      <div className="mt-6 space-y-3">
        {cases && cases.length > 0 ? (
          cases.map((c) => (
            <Link
              key={c.id}
              href={`/cases/${c.id}`}
              className="block bg-white p-4 rounded-lg border hover:shadow-sm transition"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">
                  {c.title || "Untitled Case"}
                </h2>
                <span className="text-xs text-slate-500">
                  {new Date(c.created_at).toLocaleDateString()}
                </span>
              </div>

              <p className="text-xs text-slate-600 mt-1">
                EACO: {c.eaco_id || "N/A"}
              </p>
            </Link>
          ))
        ) : (
          <p className="text-slate-500 text-sm">No cases yet.</p>
        )}
      </div>
    </div>
  );
}
