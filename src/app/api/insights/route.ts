import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { getSession } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { interviewId } = await req.json();

    const supabase = await createClient();
    const { data: interviewRow, error: interviewError } = await supabase
      .from("interviews")
      .select("*")
      .eq("id", interviewId)
      .eq("user_id", session.user.id)
      .single();

    if (interviewError || !interviewRow) {
      return NextResponse.json(
        { error: "Interview not found" },
        { status: 404 }
      );
    }

    const { data: personaRow } = await supabase
      .from("personas")
      .select("name, role, company")
      .eq("id", interviewRow.persona_id)
      .single();

    const { data: messageRows } = await supabase
      .from("messages")
      .select("role, content, created_at")
      .eq("interview_id", interviewId)
      .order("created_at", { ascending: true });

    const messages = messageRows || [];
    const transcript = messages
      .map(
        (m) =>
          `${m.role === "user" ? "Interviewer" : personaRow?.name}: ${m.content}`
      )
      .join("\n\n");

    const { text } = await generateText({
      model: google(process.env.GEMINI_MODEL || "gemini-2.0-flash"),
      prompt: `Analyze this interview transcript with ${personaRow?.name} (${personaRow?.role}${personaRow?.company ? ` at ${personaRow.company}` : ""}).

Extract the following in JSON format:
{
  "summary": "A 2-3 sentence summary of the interview",
  "painPoints": ["Array of specific pain points mentioned or implied"],
  "themes": ["Array of recurring themes/topics"],
  "keyQuotes": ["Array of notable direct quotes from the interviewee"],
  "recommendations": ["Array of follow-up questions or areas to explore in future interviews"]
}

Transcript:
${transcript}`,
    });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json(
        { error: "Failed to parse insights" },
        { status: 500 }
      );
    }

    const insights = JSON.parse(jsonMatch[0]);

    await supabase
      .from("interviews")
      .update({
        status: "completed",
        summary: insights.summary,
        insights: JSON.stringify(insights),
        updated_at: new Date().toISOString(),
      })
      .eq("id", interviewId)
      .eq("user_id", session.user.id);

    return NextResponse.json(insights);
  } catch {
    return NextResponse.json(
      { error: "Failed to generate insights" },
      { status: 500 }
    );
  }
}
