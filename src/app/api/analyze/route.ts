import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateWithFallback, QUOTA_EXCEEDED_MESSAGE } from "@/lib/ai";

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

    const hasGemini = !!process.env.GOOGLE_GEMINI_API_KEY?.trim();
    const hasGroq = !!process.env.GROQ_API_KEY?.trim();
    if (!hasGemini && !hasGroq) {
      return NextResponse.json(
        { message: "Set GOOGLE_GEMINI_API_KEY or GROQ_API_KEY in .env.local to enable analysis." },
        { status: 503 }
      );
    }

    // Fetch source details and content from Supabase
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    let sourceContext = `Source IDs: ${sourceIds.join(', ')}.`;

    if (supabaseUrl && supabaseAnonKey) {
      const authHeader = req.headers.get('Authorization');
      const token = authHeader?.replace(/^Bearer\s+/i, '').trim();
      const supabase = createClient(supabaseUrl, supabaseAnonKey, token
        ? { global: { headers: { Authorization: `Bearer ${token}` } } }
        : undefined
      );
      const { data: sources } = await supabase
        .from('sources')
        .select('id, name, type, meta, content')
        .in('id', sourceIds);
      if (sources && sources.length > 0) {
        sourceContext = buildSourceContextWithContent(sources);
      }
    }

    const prompt = `You are a senior product manager and strategist. The user has selected the following sources (interviews, docs, reviews, etc.). Below is the actual content extracted from each source. Your job is to produce REAL INSIGHTS and ACTIONABLE ITEMS—not generic summaries.

What you must NOT do:
- Do not just summarise what the sources say.
- Do not state the obvious (e.g. "Users want better features").
- Do not give one-size-fits-all advice that could apply to any product.

What you MUST do:
- Infer patterns, tensions, risks, and opportunities from the evidence.
- Tie every insight to specific evidence (quotes, data points, or concrete examples from the sources).
- End each insight with a clear, concrete ACTION the team can take (e.g. "Run a 1-week test with power users", "Add a discovery interview with segment X", "Prioritise fixing Y before Q2 launch", "Define success metric Z and baseline it").
- Base insights on what is actually in the text; if something is ambiguous, say so and recommend a follow-up.

${sourceContext}

Generate exactly 4 insights. For each insight provide:
1. summary: One short, specific finding or opportunity (suitable as a ticket or initiative title). Must be concrete, not generic.
2. description: 2–4 sentences that (a) state the insight clearly, (b) cite specific evidence from the sources (quote or refer to a named source), and (c) end with a concrete, actionable next step (who does what, by when or in what format).
3. sourceNames: Array of the exact source names from the "Source: ..." headers above that this insight is based on.
4. evidence: 1–2 sentences with a direct quote or specific fact from the source(s) that support this insight.

Return a valid JSON object with a single key "insights" containing an array of 4 objects, each with keys "summary", "description", "sourceNames", and "evidence".
Example: {"insights": [{"summary": "Discovery gap: no direct access to end customers", "description": "Stefan (PO) reports having to make hypotheses from Germany about users in US/Indonesia with no way to validate. He relies on secondhand input from market managers. Evidence: 'Finding those customers in a big corporation is super complicated.' Action: Schedule 2–3 discovery interviews per market with real end users within the next sprint; assign an owner.", "sourceNames": ["Stefan.pdf"], "evidence": "Direct quote from Stefan on customer access."}, ...]}`;

    const text = await generateWithFallback([{ role: "user", content: prompt }]);
    const cleanedText = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(cleanedText);
    const rawInsights = Array.isArray(parsed.insights) ? parsed.insights : [];
    const data = {
      insights: rawInsights.map((item: { summary?: string; description?: string; sourceNames?: string[]; evidence?: string }) => ({
        summary: item.summary ?? "",
        description: item.description ?? "",
        sourceNames: Array.isArray(item.sourceNames) ? item.sourceNames : [],
        evidence: typeof item.evidence === "string" ? item.evidence : "",
      })),
    };

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
