import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  const body = await req.json();
  const { id, updates } = body;

  if (!id || !updates) {
    return new Response(
      JSON.stringify({ error: "Missing id or updates" }),
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("cases")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500
    });
  }

  return new Response(JSON.stringify(data), { status: 200 });
}
