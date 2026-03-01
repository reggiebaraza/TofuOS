import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from '@supabase/supabase-js';
import { withGeminiRetry, QUOTA_EXCEEDED_MESSAGE } from "@/lib/gemini";

export async function POST(req: Request) {
  try {
    const { message, sourceIds, history, projectContext } = await req.json();

    if (!message) {
      return NextResponse.json({ message: 'Message is required' }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    
    // Require API key - no mock data
    if (!apiKey) {
      return NextResponse.json(
        { message: "GOOGLE_GEMINI_API_KEY is not set. Add your Gemini API key to enable chat." },
        { status: 503 }
      );
    }

    // Fetch source details from Supabase for context
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    let context = "No specific sources selected.";
    if (projectContext && typeof projectContext === 'string' && projectContext.trim()) {
      context = `Project context (use this to align answers): ${projectContext.trim()}\n\n`;
    }

    if (supabaseUrl && supabaseAnonKey && sourceIds && sourceIds.length > 0) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey);
      const { data: sources } = await supabase
        .from('sources')
        .select('name, type, meta')
        .in('id', sourceIds);
      
      if (sources && sources.length > 0) {
        context += `The user has selected the following sources for this conversation:\n${sources.map(s => `- ${s.name} (${s.type})`).join('\n')}\n\nPlease use this context to answer questions accurately. If the user asks for details about these sources, use your knowledge as a product manager to provide insights based on their types and names.`;
      }
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const model = genAI.getGenerativeModel({ model: modelName });

    const chat = model.startChat({
      history: (history || []).map((h: { role: string; content: string }) => ({
        role: h.role === "assistant" ? "model" : "user",
        parts: [{ text: h.content }],
      })),
      generationConfig: {
        maxOutputTokens: 8192,
      },
    });

    const fullPrompt = `Context:\n${context}\n\nUser Question: ${message}`;

    const content = await withGeminiRetry(async () => {
      const result = await chat.sendMessage(fullPrompt);
      const response = await result.response;
      return response.text();
    });
    
    return NextResponse.json({ content });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const isQuota = message.includes("429") || message.includes("quota") || message.includes("Too Many Requests") || message.includes("Quota exceeded");
    console.error('Gemini Chat Error:', error);
    if (isQuota) {
      return NextResponse.json({ message: QUOTA_EXCEEDED_MESSAGE }, { status: 429 });
    }
    return NextResponse.json({ message }, { status: 500 });
  }
}
