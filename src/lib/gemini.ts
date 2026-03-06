/**
 * Call a Gemini API function with retry on 429 (rate limit).
 * Supports fallback to alternative Gemini models when one hits quota.
 * Optional throttling keeps requests under free-tier RPM (e.g. 10 for 2.5 Flash).
 */
import type { GoogleGenerativeAI } from "@google/generative-ai";

const RATE_LIMIT_RETRY_DELAY_MS = 60_000; // 1 minute so per-minute quota can reset
const MAX_RETRIES = 2;

/** Default model list: Flash-Lite first (15 RPM, 1000 RPD), then Flash (10 RPM, 250 RPD). */
export const GEMINI_FALLBACK_MODELS = [
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
] as const;

/** Throttle: max Gemini requests per 60s (0 = disabled). Free tier is 10 RPM for 2.5 Flash, 15 for Flash-Lite. */
function getThrottleRPM(): number {
  const val = process.env.GEMINI_THROTTLE_RPM;
  if (val === undefined || val === "") return 8;
  const n = parseInt(val, 10);
  return Number.isNaN(n) || n < 0 ? 8 : n;
}

const requestTimestamps: number[] = [];

async function throttleGemini(): Promise<void> {
  const rpm = getThrottleRPM();
  if (rpm <= 0) return;
  const now = Date.now();
  const windowMs = 60_000;
  while (requestTimestamps.length > 0 && requestTimestamps[0] < now - windowMs) {
    requestTimestamps.shift();
  }
  if (requestTimestamps.length >= rpm) {
    const waitMs = requestTimestamps[0] + windowMs - now;
    if (waitMs > 0) {
      console.warn(`[Gemini] Throttle: waiting ${Math.round(waitMs / 1000)}s to stay under ${rpm} RPM.`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
  const after = Date.now();
  while (requestTimestamps.length > 0 && requestTimestamps[0] < after - windowMs) {
    requestTimestamps.shift();
  }
  requestTimestamps.push(after);
}

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
    message.includes("Quota exceeded") ||
    message.includes("503") ||
    message.includes("Service Unavailable") ||
    message.includes("high demand")
  );
}

function isModelNotFoundError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes("404") || message.includes("not found") || message.includes("is not supported");
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
 * tried with withGeminiRetry (retries after 60s delay) before falling back.
 * Optional throttling keeps requests under free-tier RPM.
 */
export async function withGeminiModelFallback<T>(
  genAI: GoogleGenerativeAI,
  modelNames: string[],
  fn: (model: GenerativeModel) => Promise<T>
): Promise<T> {
  await throttleGemini();
  let lastError: unknown;
  for (const modelName of modelNames) {
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      return await withGeminiRetry(() => fn(model));
    } catch (error) {
      lastError = error;
      const rateLimited = isRateLimitError(error);
      const notFound = isModelNotFoundError(error);
      if (rateLimited) {
        console.warn(`[Gemini] Rate limit on model "${modelName}", trying next model.`);
      } else if (notFound) {
        console.warn(`[Gemini] Model "${modelName}" not found or not supported, trying next model.`);
      } else {
        throw error;
      }
    }
  }
  throw lastError;
}

export const QUOTA_EXCEEDED_MESSAGE =
  "Gemini API rate limit or quota exceeded. " +
  "Wait a few minutes or check your plan and billing at https://ai.google.dev/gemini-api/docs/rate-limits. " +
  "Free tier has limited requests per minute and per day.";
