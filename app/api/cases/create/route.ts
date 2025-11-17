import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

export async function POST(req: Request) {
  const body = await req.json();

  const { eaco_id, description, tool_mode } = body;

  const { data, error } = await supabase
    .from("cases")
    .insert({
      eaco_id,
      description,
      tool_mode,
    })
    .select()
    .single();

  if (error) {
    console.error(error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ id: data.id }, { status: 200 });
}
