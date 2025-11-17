import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  const body = await req.json();
  const { eaco_id, description } = body;

  if (!eaco_id || !description) {
    return new Response(
      JSON.stringify({ error: "Missing eaco_id or description" }),
      { status: 400 }
    );
  }

  const { data, error } = await supabase
    .from("cases")
    .insert({
      eaco_id,
      description,
      title: `Case ${eaco_id}`,
      status: "new"
    })
    .select()
    .single();

  if (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500
    });
  }

  return new Response(JSON.stringify(data), { status: 200 });
}
