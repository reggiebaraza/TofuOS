import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from '@supabase/supabase-js';
import { withGeminiRetry, QUOTA_EXCEEDED_MESSAGE } from "@/lib/gemini";

const MAX_CONTEXT_PER_SOURCE = 28000;  // chars per source to stay within context
const MAX_CONTEXT_TOTAL = 120000;      // total chars across all sources

function buildSourceContextWithContent(sources: { name: string; type: string; meta?: unknown; content?: string | null }[]): string {
  let total = 0;
  const parts: string[] = [];
  for (const s of sources) {
    const content = s.content?.trim();
    const text = content
      ? content.length > MAX_CONTEXT_PER_SOURCE
        ? content.slice(0, MAX_CONTEXT_PER_SOURCE) + '\n\n[... truncated ...]'
        : content
      : '(No extracted text for this source. Add a PDF or text file to include its content.)';
    const block = `--- Source: ${s.name} [${s.type}] ---\n${text}`;
    if (total + block.length > MAX_CONTEXT_TOTAL) {
      parts.push(block.slice(0, MAX_CONTEXT_TOTAL - total) + '\n\n[... more sources omitted for length ...]');
      break;
    }
    parts.push(block);
    total += block.length;
  }
  return parts.join('\n\n');
}

export async function POST(req: Request) {
  try {
    const { sourceIds } = await req.json();

    if (!sourceIds || sourceIds.length === 0) {
      return NextResponse.json({ insights: [] });
    }

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    
    // Require API key - no mock data
    if (!apiKey) {
      return NextResponse.json(
        { message: "GOOGLE_GEMINI_API_KEY is not set. Add your Gemini API key to enable analysis." },
        { status: 503 }
      );
    }

    // Fetch source details and content from Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    let sourceContext = `Source IDs: ${sourceIds.join(', ')}.`;

    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data: sources } = await supabase
        .from('sources')
        .select('id, name, type, meta, content')
        .in('id', sourceIds);
      if (sources && sources.length > 0) {
        sourceContext = buildSourceContextWithContent(sources);
      }
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const model = genAI.getGenerativeModel({ model: modelName });

    const prompt = `You are a product management assistant. The user has selected the following sources. Below is the actual content extracted from each source (where available). Use this content to derive concrete, evidence-based insights.

${sourceContext}

Generate 4 insights based on the content above. For each insight provide:
1. summary: one short sentence (concise, actionable, suitable as a ticket title).
2. description: 1-3 sentences with more detail, citing specific evidence from the sources where possible.

Return a valid JSON object with a single key 'insights' containing an array of 4 objects, each with keys "summary" and "description".
Example: {"insights": [{"summary": "Short title", "description": "Longer detail here."}, ...]}`;

    const data = await withGeminiRetry(async () => {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      const cleanedText = text.replace(/```json|```/g, "").trim();
      return JSON.parse(cleanedText);
    });

    const suggestedPrompts = [
      "Prioritise these insights and suggest what to build first.",
      "Turn the first insight into a short PRD outline.",
    ];
    return NextResponse.json({ ...data, suggestedPrompts });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const isQuota = message.includes("429") || message.includes("quota") || message.includes("Too Many Requests") || message.includes("Quota exceeded");
    console.error('Gemini Analysis Error:', error);
    if (isQuota) {
      return NextResponse.json({ message: QUOTA_EXCEEDED_MESSAGE }, { status: 429 });
    }
    return NextResponse.json({ message }, { status: 500 });
  }
}
