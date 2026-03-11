import { NextRequest } from "next/server";
import { streamText } from "ai";
import { google } from "@ai-sdk/google";
import { getSession } from "@/lib/supabase/server";
import { createClient } from "@/lib/supabase/server";

interface UIMessageInput {
  role: string;
  content?: string;
  parts?: Array<{ type: string; text?: string }>;
}

function extractText(msg: UIMessageInput): string {
  if (msg.parts) {
    return msg.parts
      .filter((p): p is { type: string; text: string } => p.type === "text" && typeof p.text === "string")
      .map((p) => p.text)
      .join("");
  }
  return msg.content || "";
}

function toStandardMessages(msgs: UIMessageInput[]): Array<{ role: "user" | "assistant"; content: string }> {
  return msgs
    .filter((m) => m.role === "user" || m.role === "assistant")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: extractText(m),
    }))
    .filter((m) => m.content.length > 0);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await req.json();
  const rawMessages: UIMessageInput[] = body.messages || [];
  const interviewId = body.interviewId;

  const supabase = await createClient();
  const { data: interviewRow, error: interviewError } = await supabase
    .from("interviews")
    .select("*, persona:personas(*)")
    .eq("id", interviewId)
    .eq("user_id", session.user.id)
    .single();

  if (interviewError || !interviewRow) {
    return new Response("Interview not found", { status: 404 });
  }

  const persona = (interviewRow as { persona: Record<string, unknown> }).persona;
  const systemPrompt = persona?.system_prompt as string;

  const lastUserMessage = rawMessages[rawMessages.length - 1];
  if (lastUserMessage?.role === "user") {
    const textContent = extractText(lastUserMessage);
    if (textContent) {
      await supabase.from("messages").insert({
        interview_id: interviewId,
        role: "user",
        content: textContent,
      });
    }
  }

  const standardMessages = toStandardMessages(rawMessages);

  const result = streamText({
    model: google(process.env.GEMINI_MODEL || "gemini-2.0-flash"),
    system: systemPrompt,
    messages: standardMessages,
    onFinish: async ({ text }) => {
      if (text) {
        await supabase.from("messages").insert({
          interview_id: interviewId,
          role: "assistant",
          content: text,
        });
      }
      await supabase
        .from("interviews")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", interviewId)
        .eq("user_id", session.user.id);
    },
  });

  return result.toUIMessageStreamResponse();
}
