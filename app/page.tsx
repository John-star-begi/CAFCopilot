import Link from "next/link";
import { supabase } from "@/lib/supabase";

export const revalidate = 0; // always fetch fresh data

export default async function HomePage() {
  const { data: cases, error } = await supabase
    .from("cases")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <main className="p-10 max-w-3xl mx-auto space-y-8">
      <header className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          CAF Copilot — Cases
        </h1>

        <Link
          href="/cases/new"
          className="bg-slate-900 text-white px-4 py-2 rounded-lg text-sm hover:bg-black transition"
        >
          + New Case
        </Link>
      </header>

      <div className="space-y-3 max-h-[75vh] overflow-y-auto pr-1">
        {cases && cases.length > 0 ? (
          cases.map((c) => (
            <Link
              key={c.id}
              href={`/cases/${c.id}`}
              className="block bg-white border shadow-sm rounded-xl p-4 hover:shadow-md transition"
            >
              <h2 className="text-lg font-semibold text-slate-900">
                {c.title || "Untitled Case"}
              </h2>
              <p className="text-sm text-slate-600">EACO: {c.eaco_id || "N/A"}</p>
              <p className="text-xs text-slate-400 mt-1">
                {new Date(c.created_at).toLocaleString()}
              </p>
            </Link>
          ))
        ) : (
          <p className="text-slate-500 text-sm">No cases yet.</p>
        )}
      </div>
    </main>
  );
}
