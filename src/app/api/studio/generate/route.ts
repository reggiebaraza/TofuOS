import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from '@supabase/supabase-js';
import { withGeminiRetry, QUOTA_EXCEEDED_MESSAGE } from "@/lib/gemini";

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

const DOCUMENT_PROMPTS: Record<string, string> = {
  prd: `Write a Product Requirements Document (PRD). Include: problem statement, goals, user personas, functional requirements, success metrics, and out-of-scope. Use the sources as evidence. Output in clear sections with headers.`,
  "coding-rules": `Create AI Coding Rules & Standards for the project. Include: code style, naming conventions, file structure, testing expectations, and any framework-specific rules. Base recommendations on the types of sources (e.g. app reviews, docs) where relevant.`,
  "api-docs": `Generate API Documentation structure and sample content. Include: overview, authentication, endpoints with request/response examples, and error codes. Infer plausible API surface from the sources.`,
  accessibility: `Write an Accessibility Compliance checklist and recommendations. Include: WCAG alignment, keyboard/screen reader support, contrast and focus states, and testing steps. Reference the sources for product context.`,
  architecture: `Create an App Architecture Plan. Include: high-level diagram description, core modules, data flow, tech stack suggestions, and deployment approach. Use the sources to infer product scope.`,
  "bug-fix": `Produce a Bug Investigation & Fix Plan. Include: how to reproduce, likely root causes, step-by-step fix plan, testing steps, and prevention. Use the sources as context for the product.`,
  competitive: `Write a Competitive Analysis Report. Include: competitor overview, feature comparison, strengths/weaknesses, and recommendations. Use the sources to ground the analysis.`,
  "journey-map": `Create a Customer Journey Map. Include: stages (awareness, consideration, use, support), touchpoints, pain points, and opportunities. Base it on the described sources (e.g. reviews, interviews).`,
  "db-schema": `Propose a Database Schema Design. Include: main entities, relationships, key tables and columns, and indexing notes. Infer domain from the sources.`,
  "feature-spec": `Write a Feature Implementation Spec. Include: scope, acceptance criteria, technical approach, and rough task breakdown. Use the sources to define the feature.`,
  gtm: `Create a Go-to-Market Plan. Include: target audience, positioning, channels, launch phases, and success metrics. Use the sources for product and market context.`,
};

export async function POST(req: Request) {
  try {
    const { documentType, sourceIds } = await req.json();

    if (!documentType || typeof documentType !== 'string') {
      return NextResponse.json({ message: 'documentType is required' }, { status: 400 });
    }

    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { message: "GOOGLE_GEMINI_API_KEY is not set. Add your Gemini API key to enable Studio." },
        { status: 503 }
      );
    }

    const instruction = DOCUMENT_PROMPTS[documentType];
    if (!instruction) {
      return NextResponse.json({ message: `Unknown document type: ${documentType}` }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    let sourceContext = "No sources selected.";

    if (supabaseUrl && supabaseAnonKey && sourceIds && Array.isArray(sourceIds) && sourceIds.length > 0) {
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

    const prompt = `You are a product and engineering assistant. The user has selected these sources. Below is the actual content extracted from each source (where available). Use this content to generate the document.

${sourceContext}

Task: ${instruction}

Generate the full document. Use markdown for structure (headers, lists, code blocks where appropriate). Base your output on the source content above. Do not include meta-commentary; just output the document.`;

    const content = await withGeminiRetry(async () => {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    });

    return NextResponse.json({ content });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    const isQuota = message.includes("429") || message.includes("quota") || message.includes("Too Many Requests") || message.includes("Quota exceeded");
    console.error('Studio Generate Error:', error);
    if (isQuota) {
      return NextResponse.json({ message: QUOTA_EXCEEDED_MESSAGE }, { status: 429 });
    }
    return NextResponse.json({ message }, { status: 500 });
  }
}
