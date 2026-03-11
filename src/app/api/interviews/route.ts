import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { interviewRowToJson, personaRowToJson } from "@/lib/supabase/map";

export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("interviews")
    .select("*")
    .eq("user_id", session.user.id)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const interviews = (rows || []).map(interviewRowToJson);
  const personaIds = [...new Set(interviews.map((i) => i.personaId))];

  const { data: personaRows } = await supabase
    .from("personas")
    .select("id, name, avatar_emoji, role, company")
    .in("id", personaIds);
  const personaMap = new Map(
    (personaRows || []).map((p) => [
      p.id,
      { name: p.name, avatarEmoji: p.avatar_emoji, role: p.role, company: p.company },
    ])
  );

  const interviewIds = interviews.map((i) => i.id);
  const { data: messageRows } = await supabase
    .from("messages")
    .select("interview_id")
    .in("interview_id", interviewIds);
  const messageCountByInterview: Record<string, number> = {};
  for (const m of messageRows || []) {
    const id = m.interview_id as string;
    messageCountByInterview[id] = (messageCountByInterview[id] || 0) + 1;
  }

  const result = interviews.map((i) => ({
    ...i,
    persona: personaMap.get(i.personaId as string) ?? null,
    _count: { messages: messageCountByInterview[i.id as string] ?? 0 },
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { personaId, title } = await req.json();

    if (!personaId) {
      return NextResponse.json(
        { error: "Persona ID is required" },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const { data: persona, error: personaError } = await supabase
      .from("personas")
      .select("*")
      .eq("id", personaId)
      .eq("user_id", session.user.id)
      .single();

    if (personaError || !persona) {
      return NextResponse.json(
        { error: "Persona not found" },
        { status: 404 }
      );
    }

    const { data: interview, error } = await supabase
      .from("interviews")
      .insert({
        user_id: session.user.id,
        persona_id: personaId,
        title: title || `Interview with ${persona.name}`,
        status: "active",
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const out = {
      ...interviewRowToJson(interview!),
      persona: personaRowToJson(persona),
    };
    return NextResponse.json(out, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create interview" },
      { status: 500 }
    );
  }
}
