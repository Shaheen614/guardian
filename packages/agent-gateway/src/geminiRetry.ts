import type { GoogleGenAI } from "@google/genai";

type GenerateParams = Parameters<GoogleGenAI["models"]["generateContent"]>[0];
type GenerateResult = Awaited<ReturnType<GoogleGenAI["models"]["generateContent"]>>;

const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 504]);
const RETRYABLE_TEXT = /UNAVAILABLE|RESOURCE_EXHAUSTED|high demand|overloaded|\b(429|500|502|503|504)\b/i;
const MODEL_GONE_TEXT = /NOT_FOUND|no longer available|\b404\b/i;

function isRetryable(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (typeof status === "number" && RETRYABLE_STATUS.has(status)) return true;
  return RETRYABLE_TEXT.test(String((err as Error)?.message ?? err));
}

function isModelGone(err: unknown): boolean {
  const status = (err as { status?: number })?.status;
  if (status === 404) return true;
  return MODEL_GONE_TEXT.test(String((err as Error)?.message ?? err));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Builds the ordered list of models to try: the primary model first, then
 * any fallbacks from `fallbackCsv` (comma separated), without duplicates.
 */
export function modelChain(primary: string, fallbackCsv?: string): string[] {
  const extras = (fallbackCsv ?? "")
    .split(",")
    .map((m) => m.trim())
    .filter(Boolean);
  return Array.from(new Set([primary, ...extras]));
}

/**
 * Calls generateContent with retry + model fallback.
 *
 * - 429/5xx/"high demand" -> retry the same model with exponential backoff
 *   (up to `attemptsPerModel`), then move on to the next model.
 * - 404/"no longer available" -> skip straight to the next model.
 * - Anything else (bad request, auth, schema errors) is a real bug and is
 *   thrown immediately — retrying would just hide it.
 *
 * Returns the model that actually answered so callers can keep using it for
 * the rest of a multi-step tool loop (thought signatures are tied to the
 * model that produced them, so switching models mid-loop is best avoided).
 */
export async function generateWithFallback(
  ai: GoogleGenAI,
  models: string[],
  params: Omit<GenerateParams, "model">,
  attemptsPerModel = 3
): Promise<{ response: GenerateResult; model: string }> {
  let lastErr: unknown;

  for (const model of models) {
    for (let attempt = 1; attempt <= attemptsPerModel; attempt++) {
      try {
        const response = await ai.models.generateContent({ ...params, model } as GenerateParams);
        return { response, model };
      } catch (err) {
        lastErr = err;
        if (isModelGone(err)) {
          console.warn(`[gemini] model "${model}" unavailable, trying next fallback`);
          break;
        }
        if (!isRetryable(err)) throw err;
        if (attempt < attemptsPerModel) {
          const delay = 800 * 2 ** (attempt - 1);
          console.warn(`[gemini] "${model}" busy (attempt ${attempt}/${attemptsPerModel}), retrying in ${delay}ms`);
          await sleep(delay);
        } else {
          console.warn(`[gemini] "${model}" still busy after ${attemptsPerModel} attempts, trying next fallback`);
        }
      }
    }
  }

  throw lastErr ?? new Error("No Gemini model could be reached.");
}
