import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";
import { buildPersonaSystemPrompt } from "@/lib/prompts";
import { personaRowToJson } from "@/lib/supabase/map";

export async function GET() {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = await createClient();
  const { data: rows, error } = await supabase
    .from("personas")
    .select("*")
    .eq("user_id", session.user.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const personas = (rows || []).map(personaRowToJson);

  const { data: counts } = await supabase
    .from("interviews")
    .select("persona_id")
    .eq("user_id", session.user.id);
  const countByPersona: Record<string, number> = {};
  for (const r of counts || []) {
    const pid = r.persona_id as string;
    countByPersona[pid] = (countByPersona[pid] || 0) + 1;
  }

  const personasWithCount = personas.map((p) => ({
    ...p,
    _count: { interviews: countByPersona[p.id as string] ?? 0 },
  }));

  return NextResponse.json(personasWithCount);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await req.json();
    const systemPrompt = data.systemPrompt || buildPersonaSystemPrompt(data);

    const supabase = await createClient();
    const { data: row, error } = await supabase
      .from("personas")
      .insert({
        user_id: session.user.id,
        name: data.name,
        avatar_emoji: data.avatarEmoji || "👤",
        age: data.age ? parseInt(data.age) : null,
        role: data.role,
        company: data.company || null,
        company_size: data.companySize || null,
        industry: data.industry || null,
        experience_years: data.experienceYears ? parseInt(data.experienceYears) : null,
        background: data.background || null,
        tools_used: data.toolsUsed || null,
        pain_points: data.painPoints || null,
        communication_style: data.communicationStyle || null,
        personality: data.personality || null,
        system_prompt: systemPrompt,
        is_template: false,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(personaRowToJson(row!), { status: 201 });
  } catch (e) {
    console.error("Failed to create persona:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to create persona" },
      { status: 500 }
    );
  }
}
