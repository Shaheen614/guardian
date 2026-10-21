import { GoogleGenAI, type Content, type FunctionDeclaration } from "@google/genai";
import { listMcpTools, callMcpTool } from "./mcpClient.js";
import { generateWithFallback, modelChain } from "./geminiRetry.js";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const PRIMARY_MODEL = process.env.AGENT_MODEL ?? "gemini-3.8-flash";
// Tried in order if the primary model is overloaded (503) or retired (404).
const MODELS = modelChain(PRIMARY_MODEL, process.env.AGENT_MODEL_FALLBACKS ?? "gemini-3.5-flash,gemini-flash-latest");

// Documented last-resort value from Google's thought-signature docs, used
// only if a functionCall part comes back without a signature we can replay.
const BYPASS_THOUGHT_SIGNATURE = "skip_thought_signature_validator";

const SYSTEM_PROMPT = `You are Guardian, a calm, concise voice agent that helps someone keep an eye
on their front door and household activity — the kind of thing they'd ask
Alexa+ while their hands are full. You have tools for checking the latest
doorbell event, describing what a camera saw, listing recent activity,
checking whether things have been quieter than usual, and notifying a
caregiver.

Speak the way a helpful person would over a voice assistant: short sentences,
no markdown, no bullet points, nothing that doesn't read naturally out loud.
If a tool result suggests something is worth flagging to a caregiver, offer
to notify them rather than doing it silently.`;

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/**
 * Strips schema keywords that the MCP SDK's zod-generated JSON Schema
 * includes but Gemini's function-calling schema (an OpenAPI-style subset)
 * doesn't recognize. Without this, tool declarations round-trip fine for
 * simple tools but can be rejected once a tool has defaults or a $schema
 * marker attached.
 */
function sanitizeSchema(schema: unknown): Record<string, unknown> {
  if (schema === null || typeof schema !== "object") return {};
  const clone: Record<string, unknown> = { ...(schema as Record<string, unknown>) };
  delete clone.$schema;
  delete clone.additionalProperties;
  delete clone.default;
  if (clone.properties && typeof clone.properties === "object") {
    const props = clone.properties as Record<string, unknown>;
    clone.properties = Object.fromEntries(
      Object.entries(props).map(([key, value]) => [key, sanitizeSchema(value)])
    );
  }
  return clone;
}

async function buildFunctionDeclarations(): Promise<FunctionDeclaration[]> {
  const mcpTools = await listMcpTools();
  return mcpTools.map((t) => ({
    name: t.name,
    description: t.description,
    parameters: sanitizeSchema(t.inputSchema) as FunctionDeclaration["parameters"],
  }));
}

/**
 * Runs one turn of the tool-calling loop against Gemini: send the
 * conversation + live MCP tool declarations, execute any function calls
 * Gemini requests against the real MCP server, feed the results back as
 * functionResponse parts, and repeat until Gemini answers in plain text.
 * Architecturally identical to a production Alexa+ agent loop — only the
 * model provider changed (Gemini's free tier instead of a paid API) to
 * keep this project's running cost at zero.
 */
export async function runAgentTurn(history: ChatTurn[]): Promise<string> {
  const functionDeclarations = await buildFunctionDeclarations();

  const contents: Content[] = history.map((turn) => ({
    role: turn.role === "assistant" ? "model" : "user",
    parts: [{ text: turn.content }],
  }));

  // Once a model answers, keep using it for the rest of this turn: thought
  // signatures belong to the model that produced them.
  let modelsToTry = MODELS;

  for (let iteration = 0; iteration < 6; iteration++) {
    const { response, model: usedModel } = await generateWithFallback(ai, modelsToTry, {
      contents,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        tools: [{ functionDeclarations }],
        // Gemini 3 models spend part of this budget on internal reasoning,
        // so 500 can truncate the visible answer mid-sentence.
        maxOutputTokens: 2048,
      },
    });
    modelsToTry = [usedModel, ...MODELS.filter((m) => m !== usedModel)];

    const calls = response.functionCalls ?? [];
    if (calls.length === 0) {
      return (response.text ?? "").trim() || "I looked into that but don't have a clear answer.";
    }

    // Record the model's function-call turn VERBATIM. Gemini 3 attaches an
    // encrypted "thought signature" to the first functionCall part and
    // rejects the next request with a 400 if it isn't sent back unchanged,
    // so we push the model's own content object rather than rebuilding it.
    const modelContent = response.candidates?.[0]?.content;
    if (modelContent?.parts) {
      const callParts = modelContent.parts.filter((p) => p.functionCall);
      const first = callParts[0] as (typeof callParts)[number] & { thoughtSignature?: string };
      if (first && !first.thoughtSignature) {
        // The SDK dropped (or the model omitted) the signature. Use Google's
        // documented bypass so the loop still works, at some cost to quality.
        first.thoughtSignature = BYPASS_THOUGHT_SIGNATURE;
      }
      contents.push(modelContent);
    } else {
      // Fallback: rebuild from the parsed calls (should be rare).
      contents.push({
        role: "model",
        parts: calls.map((call, i) => ({
          functionCall: { name: call.name, args: call.args },
          ...(i === 0 ? { thoughtSignature: BYPASS_THOUGHT_SIGNATURE } : {}),
        })) as Content["parts"],
      });
    }

    // All function responses go back together in ONE user turn, in the same
    // order as the calls (interleaving call/response pairs causes a 400).
    const responseParts: Array<{ functionResponse: { name: string | undefined; response: { result: string } } }> = [];
    for (const call of calls) {
      let resultText: string;
      try {
        resultText = await callMcpTool(call.name ?? "", (call.args as Record<string, unknown>) ?? {});
      } catch (err) {
        resultText = `Tool error: ${(err as Error).message}`;
      }
      responseParts.push({
        functionResponse: {
          name: call.name,
          response: { result: resultText },
        },
      });
    }
    contents.push({ role: "user", parts: responseParts });
  }

  return "I looked into that but couldn't finish in time — try asking again.";
}
