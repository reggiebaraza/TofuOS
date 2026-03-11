import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { interviewRowToJson, personaRowToJson, messageRowToJson } from "@/lib/supabase/map";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const supabase = await createClient();
  const { data: interviewRow, error: interviewError } = await supabase
    .from("interviews")
    .select("*")
    .eq("id", id)
    .eq("user_id", session.user.id)
    .single();

  if (interviewError || !interviewRow) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  const { data: personaRow } = await supabase
    .from("personas")
    .select("*")
    .eq("id", interviewRow.persona_id)
    .single();

  const { data: messageRows } = await supabase
    .from("messages")
    .select("*")
    .eq("interview_id", id)
    .order("created_at", { ascending: true });

  const interview = {
    ...interviewRowToJson(interviewRow),
    persona: personaRow ? personaRowToJson(personaRow) : null,
    messages: (messageRows || []).map(messageRowToJson),
  };

  return NextResponse.json(interview);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const supabase = await createClient();
  const { data: existing, error: fetchError } = await supabase
    .from("interviews")
    .select("*")
    .eq("id", id)
    .eq("user_id", session.user.id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Interview not found" }, { status: 404 });
  }

  const data = await req.json();

  const { data: updated, error } = await supabase
    .from("interviews")
    .update({
      status: data.status ?? existing.status,
      summary: data.summary !== undefined ? data.summary : existing.summary,
      insights: data.insights !== undefined ? data.insights : existing.insights,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", session.user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(interviewRowToJson(updated!));
}
