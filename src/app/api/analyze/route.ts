import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from '@supabase/supabase-js';
import { withGeminiRetry, QUOTA_EXCEEDED_MESSAGE } from "@/lib/gemini";

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

    // Fetch real source details from Supabase for context
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    let sourceContext = `Source IDs: ${sourceIds.join(', ')}.`;

    if (supabaseUrl && supabaseAnonKey) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data: sources } = await supabase
        .from('sources')
        .select('id, name, type, meta')
        .in('id', sourceIds);
      if (sources && sources.length > 0) {
        sourceContext = sources.map((s) => {
          const metaStr = s.meta ? ` (meta: ${JSON.stringify(s.meta)})` : '';
          return `- ${s.name} [${s.type}]${metaStr}`;
        }).join('\n');
      }
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const model = genAI.getGenerativeModel({ model: modelName });

    const prompt = `You are a product management assistant. The user has selected the following real sources (customer interviews, reviews, documents):

${sourceContext}

Generate 4 insights based on these sources. For each insight provide:
1. summary: one short sentence (concise, actionable, suitable as a ticket title).
2. description: 1-3 sentences with more detail, data, or context (for use in ticket description).

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
