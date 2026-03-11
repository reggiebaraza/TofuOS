import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { buildPersonaSystemPrompt } from "@/lib/prompts";
import { personaRowToJson, interviewRowToJson } from "@/lib/supabase/map";

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
  const { data: row, error } = await supabase
    .from("personas")
    .select("*")
    .eq("id", id)
    .eq("user_id", session.user.id)
    .single();

  if (error || !row) {
    return NextResponse.json({ error: "Persona not found" }, { status: 404 });
  }

  const { data: interviewRows } = await supabase
    .from("interviews")
    .select("*")
    .eq("persona_id", id)
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false })
    .limit(10);

  const persona = {
    ...personaRowToJson(row),
    interviews: (interviewRows || []).map(interviewRowToJson),
    _count: { interviews: (row as { interviews_count?: number }).interviews_count ?? interviewRows?.length ?? 0 },
  };

  const { count } = await supabase
    .from("interviews")
    .select("id", { count: "exact", head: true })
    .eq("persona_id", id)
    .eq("user_id", session.user.id);
  (persona as { _count: { interviews: number } })._count.interviews = count ?? 0;

  return NextResponse.json(persona);
}

export async function PUT(
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
    .from("personas")
    .select("*")
    .eq("id", id)
    .eq("user_id", session.user.id)
    .single();

  if (fetchError || !existing) {
    return NextResponse.json({ error: "Persona not found" }, { status: 404 });
  }

  const data = await req.json();
  const systemPrompt = buildPersonaSystemPrompt({ ...personaRowToJson(existing), ...data });

  const { data: updated, error } = await supabase
    .from("personas")
    .update({
      name: data.name ?? existing.name,
      avatar_emoji: data.avatarEmoji ?? existing.avatar_emoji,
      age: data.age !== undefined ? (data.age ? parseInt(data.age) : null) : existing.age,
      role: data.role ?? existing.role,
      company: data.company ?? existing.company,
      company_size: data.companySize ?? existing.company_size,
      industry: data.industry ?? existing.industry,
      experience_years: data.experienceYears !== undefined ? (data.experienceYears ? parseInt(data.experienceYears) : null) : existing.experience_years,
      background: data.background ?? existing.background,
      tools_used: data.toolsUsed ?? existing.tools_used,
      pain_points: data.painPoints ?? existing.pain_points,
      communication_style: data.communicationStyle ?? existing.communication_style,
      personality: data.personality ?? existing.personality,
      system_prompt: systemPrompt,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("user_id", session.user.id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(personaRowToJson(updated!));
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const supabase = await createClient();
  const { error } = await supabase
    .from("personas")
    .delete()
    .eq("id", id)
    .eq("user_id", session.user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
