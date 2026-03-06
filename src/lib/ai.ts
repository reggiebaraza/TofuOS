/**
 * Unified AI layer: Gemini first, Groq fallback on rate limit.
 * Set GROQ_API_KEY in env to enable free Groq fallback when Gemini is limited.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  withGeminiModelFallback,
  getGeminiModelList,
} from "@/lib/gemini";

export const QUOTA_EXCEEDED_MESSAGE =
  "AI rate limit or quota exceeded. If you set GROQ_API_KEY in .env.local, the app will automatically use Groq when Gemini is limited. Otherwise wait a few minutes and try again.";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

function isRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("429") ||
    message.includes("Too Many Requests") ||
    message.includes("quota") ||
    message.includes("Quota exceeded") ||
    message.includes("503") ||
    message.includes("Service Unavailable") ||
    message.includes("high demand")
  );
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

async function callGroq(messages: ChatMessage[]): Promise<string> {
  const key = process.env.GROQ_API_KEY?.trim();
  if (!key) throw new Error("GROQ_API_KEY is not set");
  const body = {
    model: GROQ_MODEL,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    max_tokens: 8192,
  };
  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq API ${res.status}: ${err}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data?.choices?.[0]?.message?.content;
  if (text == null) throw new Error("Groq API returned no content");
  return text;
}

async function callGemini(messages: ChatMessage[]): Promise<string> {
  const key = process.env.GOOGLE_GEMINI_API_KEY?.trim();
  if (!key) throw new Error("GOOGLE_GEMINI_API_KEY is not set");
  const genAI = new GoogleGenerativeAI(key);

  return withGeminiModelFallback(genAI, getGeminiModelList(), async (model) => {
    if (messages.length === 0) throw new Error("No messages");

    const last = messages[messages.length - 1];
    const promptContent = last.content;

    if (messages.length === 1) {
      const result = await model.generateContent(promptContent);
      return result.response.text();
    }

    const history = messages.slice(0, -1).map((m) => ({
      role: (m.role === "assistant" ? "model" : "user") as "user" | "model",
      parts: [{ text: m.content }],
    }));
    const chat = model.startChat({
      history,
      generationConfig: { maxOutputTokens: 8192 },
    });
    const result = await chat.sendMessage(promptContent);
    return result.response.text();
  });
}

/**
 * Generate a completion from a list of messages. Tries Gemini first;
 * if Gemini returns a rate-limit/503 error and GROQ_API_KEY is set, uses Groq.
 */
export async function generateWithFallback(messages: ChatMessage[]): Promise<string> {
  const geminiKey = process.env.GOOGLE_GEMINI_API_KEY?.trim();
  const groqKey = process.env.GROQ_API_KEY?.trim();

  if (!geminiKey && !groqKey) {
    throw new Error(
      "Set GOOGLE_GEMINI_API_KEY or GROQ_API_KEY in your environment (e.g. .env.local)."
    );
  }

  if (geminiKey) {
    try {
      return await callGemini(messages);
    } catch (e) {
      if (!isRateLimitError(e) || !groqKey) throw e;
      console.warn("[AI] Gemini rate limited or unavailable, falling back to Groq.");
      return await callGroq(messages);
    }
  }

  return await callGroq(messages);
}
