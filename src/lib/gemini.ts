/**
 * Call a Gemini API function with retry on 429 (rate limit).
 * Supports fallback to alternative Gemini models when one hits quota.
 */
import type { GoogleGenerativeAI } from "@google/generative-ai";

const RATE_LIMIT_RETRY_DELAY_MS = 30_000; // 30 seconds
const MAX_RETRIES = 1;

/** Default model list: primary first, then fallbacks (separate quotas per model). */
export const GEMINI_FALLBACK_MODELS = [
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-1.5-flash",
] as const;

export function getGeminiModelList(): string[] {
  const env = process.env.GEMINI_MODEL?.trim();
  if (env) {
    const rest = GEMINI_FALLBACK_MODELS.filter((m) => m !== env);
    return [env, ...rest];
  }
  return [...GEMINI_FALLBACK_MODELS];
}

function isRateLimitError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("429") ||
    message.includes("Too Many Requests") ||
    message.includes("quota") ||
    message.includes("Quota exceeded")
  );
}

export async function withGeminiRetry<T>(
  fn: () => Promise<T>
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (isRateLimitError(error) && attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, RATE_LIMIT_RETRY_DELAY_MS));
        continue;
      }
      throw error;
    }
  }
  throw lastError;
}

type GenerativeModel = Awaited<ReturnType<GoogleGenerativeAI["getGenerativeModel"]>>;

/**
 * Run a Gemini operation with model fallback: if the primary model returns
 * a rate limit (429/quota), try the next model in the list. Each model is
 * tried with withGeminiRetry (one retry after delay) before falling back.
 */
export async function withGeminiModelFallback<T>(
  genAI: GoogleGenerativeAI,
  modelNames: string[],
  fn: (model: GenerativeModel) => Promise<T>
): Promise<T> {
  let lastError: unknown;
  for (const modelName of modelNames) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      return await withGeminiRetry(() => fn(model));
    } catch (error) {
      lastError = error;
      if (!isRateLimitError(error)) throw error;
      console.warn(`[Gemini] Rate limit on model "${modelName}", trying next model.`);
    }
  }
  throw lastError;
}

export const QUOTA_EXCEEDED_MESSAGE =
  "Gemini API rate limit or quota exceeded. " +
  "Wait a few minutes or check your plan and billing at https://ai.google.dev/gemini-api/docs/rate-limits. " +
  "Free tier has limited requests per minute and per day.";
