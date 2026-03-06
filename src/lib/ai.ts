/**
 * Unified AI layer: OpenAI (ChatGPT) first, then Groq, then Gemini on rate limit.
 * Set OPENAI_API_KEY for primary; GROQ_API_KEY and/or GOOGLE_GEMINI_API_KEY for fallbacks.
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import {
  withGeminiModelFallback,
  getGeminiModelList,
} from "@/lib/gemini";

export const QUOTA_EXCEEDED_MESSAGE =
  "AI rate limit or quota exceeded. Set OPENAI_API_KEY, GROQ_API_KEY, or GOOGLE_GEMINI_API_KEY in .env.local. With multiple keys, the app will try fallbacks automatically.";

const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";
const OPENAI_MODEL = process.env.OPENAI_CHAT_MODEL?.trim() || "gpt-4o-mini";

const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

function isRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("429") ||
    message.includes("413") ||
    message.includes("Too Many Requests") ||
    message.includes("Request too large") ||
    message.includes("rate_limit_exceeded") ||
    message.includes("insufficient_quota") ||
    message.includes("quota") ||
    message.includes("Quota exceeded") ||
    message.includes("503") ||
    message.includes("Service Unavailable") ||
    message.includes("high demand")
  );
}

export type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

async function callOpenAI(messages: ChatMessage[]): Promise<string> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  const body = {
    model: OPENAI_MODEL,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    max_tokens: 8192,
  };
  const res = await fetch(OPENAI_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI API ${res.status}: ${err}`);
  }
  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data?.choices?.[0]?.message?.content;
  if (text == null) throw new Error("OpenAI API returned no content");
  return text;
}

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
 * Generate a completion from a list of messages. Tries OpenAI (ChatGPT) first;
 * on rate limit/error falls back to Groq, then Gemini if keys are set.
 */
export async function generateWithFallback(messages: ChatMessage[]): Promise<string> {
  const openAIKey = process.env.OPENAI_API_KEY?.trim();
  const geminiKey = process.env.GOOGLE_GEMINI_API_KEY?.trim();
  const groqKey = process.env.GROQ_API_KEY?.trim();

  if (!openAIKey && !geminiKey && !groqKey) {
    throw new Error(
      "Set OPENAI_API_KEY, GOOGLE_GEMINI_API_KEY, or GROQ_API_KEY in your environment (e.g. .env.local)."
    );
  }

  if (openAIKey) {
    try {
      return await callOpenAI(messages);
    } catch (e) {
      if (!isRateLimitError(e)) throw e;
      if (groqKey) {
        try {
          console.warn("[AI] OpenAI rate limited, trying Groq.");
          return await callGroq(messages);
        } catch (e2) {
          if (!isRateLimitError(e2) || !geminiKey) throw e2;
          console.warn("[AI] Groq rate limited, falling back to Gemini.");
          return await callGemini(messages);
        }
      }
      if (geminiKey) {
        console.warn("[AI] OpenAI rate limited, falling back to Gemini.");
        return await callGemini(messages);
      }
      throw e;
    }
  }

  if (groqKey) {
    try {
      return await callGroq(messages);
    } catch (e) {
      if (!isRateLimitError(e) || !geminiKey) throw e;
      console.warn("[AI] Groq rate limited or unavailable, falling back to Gemini.");
      return await callGemini(messages);
    }
  }

  return await callGemini(messages);
}
