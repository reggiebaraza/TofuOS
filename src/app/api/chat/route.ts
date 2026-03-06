import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from '@supabase/supabase-js';
import { withGeminiModelFallback, getGeminiModelList, QUOTA_EXCEEDED_MESSAGE } from "@/lib/gemini";

const MAX_CONTEXT_PER_SOURCE = 28000;
const MAX_CONTEXT_TOTAL = 120000;

function buildSourceContextWithContent(sources: { name: string; type: string; content?: string | null }[]): string {
  let total = 0;
  const parts: string[] = [];
  for (const s of sources) {
    const content = s.content?.trim();
    const text = content
      ? content.length > MAX_CONTEXT_PER_SOURCE
        ? content.slice(0, MAX_CONTEXT_PER_SOURCE) + '\n\n[... truncated ...]'
        : content
      : '(No extracted text for this source.)';
    const block = `--- Source: ${s.name} [${s.type}] ---\n${text}`;
    if (total + block.length > MAX_CONTEXT_TOTAL) {
      parts.push(block.slice(0, MAX_CONTEXT_TOTAL - total) + '\n\n[... more sources omitted ...]');
      break;
    }
    parts.push(block);
    total += block.length;
  }
  return parts.join('\n\n');
}

export async function POST(req: Request) {
  try {
    const { message, sourceIds, history, projectContext } = await req.json();

    if (!message) {
      return NextResponse.json({ message: 'Message is required' }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    
    if (!apiKey) {
      return NextResponse.json(
        { message: "GOOGLE_GEMINI_API_KEY is not set. Add your Gemini API key to enable chat." },
        { status: 503 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    let context = "No specific sources selected.";
    if (projectContext && typeof projectContext === 'string' && projectContext.trim()) {
      context = `Project context (use this to align answers): ${projectContext.trim()}\n\n`;
    }

    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim();

    if (sourceIds && sourceIds.length > 0 && supabaseUrl && supabaseAnonKey) {
      const supabase = createClient(supabaseUrl, supabaseAnonKey, token
        ? { global: { headers: { Authorization: `Bearer ${token}` } } }
        : undefined
      );
      const { data: sources } = await supabase
        .from('sources')
        .select('name, type, content')
        .in('id', sourceIds);
      
      if (sources && sources.length > 0) {
        const sourceContent = buildSourceContextWithContent(sources);
        context = (projectContext && typeof projectContext === 'string' && projectContext.trim())
          ? `Project context (use this to align answers): ${projectContext.trim()}\n\n`
          : '';
        context += `The user has selected the following sources. Use the actual content below to answer accurately. If content is missing for a source, say so and use general PM knowledge only for that part.\n\n${sourceContent}`;
        const allMissing = sources.every((s) => !s.content?.trim());
        if (allMissing) {
          context += '\n\nNote: No text was extracted from any of these sources (e.g. PDFs may have been added before extraction was enabled, or extraction failed). Suggest the user remove these sources and re-add the PDFs via Add Sources so the app can extract their content, or paste relevant excerpts.';
        }
      }
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const content = await withGeminiModelFallback(genAI, getGeminiModelList(), async (model) => {
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
      const result = await chat.sendMessage(fullPrompt);
      return result.response.text();
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
