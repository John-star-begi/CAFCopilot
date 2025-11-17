export default async function HomePage() {
  const { data: cases } = await supabase
    .from("cases")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div className="max-w-3xl">
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Cases</h1>

        <Link
          href="/cases/new"
          className="bg-blue-600 text-white px-3 py-2 rounded-md text-sm hover:bg-blue-700"
        >
          + New Case
        </Link>
      </header>

      <div className="space-y-3">
        {cases?.map((c) => (
          <Link
            key={c.id}
            href={`/cases/${c.id}`}
            className="block border rounded-lg p-4 bg-white hover:bg-gray-50 shadow-sm"
          >
            <h2 className="font-semibold">{c.title || "Untitled case"}</h2>
            <p className="text-sm text-gray-600">EACO: {c.eaco_id || "N/A"}</p>
            <p className="text-xs text-gray-500 mt-1">
              {new Date(c.created_at).toLocaleString()}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
