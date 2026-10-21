import { GoogleGenAI } from "@google/genai";
import { generateWithFallback, modelChain } from "./geminiRetry.js";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const PRIMARY_MODEL = process.env.GEMINI_VISION_MODEL ?? "gemini-3.8-flash";
// Tried in order if the primary model is overloaded (503) or retired (404).
const MODELS = modelChain(
  PRIMARY_MODEL,
  process.env.GEMINI_VISION_MODEL_FALLBACKS ?? "gemini-3.5-flash,gemini-flash-latest"
);

export interface VisionAnalysis {
  description: string;
  category: "delivery" | "visitor" | "resident" | "vehicle" | "unclear";
  suggestedAction: string;
}

const SYSTEM_PROMPT = `You are the vision system for Guardian, a household MCP agent that watches a
front door camera on behalf of a caregiver. Given a doorbell/camera snapshot,
respond with EXACTLY three lines, no preamble, no markdown:
DESCRIPTION: <one calm, concrete sentence about what's visible>
CATEGORY: <one of: delivery, visitor, resident, vehicle, unclear>
ACTION: <one short, practical suggestion for the caregiver, or "none needed">`;

/**
 * Sends a base64-encoded snapshot to Gemini (free tier) and returns a
 * structured read on what's happening at the door. This is a drop-in
 * replacement for the earlier Bedrock-based version — same function
 * signature and return shape — so tools.ts didn't need to change, only the
 * import. Swapped in specifically to avoid any AWS Bedrock usage cost;
 * note this also means the project is no longer eligible for the AWS
 * Builder mini challenge (see README).
 */
export async function analyzeDoorSnapshot(
  snapshotBase64: string,
  context: { cameraName: string; eventType: string; timestamp: string }
): Promise<VisionAnalysis> {
  const { response } = await generateWithFallback(ai, MODELS, {
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              `Camera: ${context.cameraName}\n` +
              `Event type: ${context.eventType}\n` +
              `Timestamp: ${context.timestamp}\n\n` +
              `Note: Ring watermarks all delivered snapshots with the device ID and ` +
              `timestamp in the corner — ignore the watermark itself when describing ` +
              `the scene.`,
          },
          {
            inlineData: {
              mimeType: "image/png",
              data: snapshotBase64,
            },
          },
        ],
      },
    ],
    config: {
      systemInstruction: SYSTEM_PROMPT,
      temperature: 0.2,
      maxOutputTokens: 1024,
    },
  });

  return parseVisionResponse(response.text ?? "");
}

const MOCK_SYSTEM_PROMPT = `You are the vision system for Guardian, a household MCP agent that watches a
front door camera on behalf of a caregiver. You're given a text description
of a simulated camera event (not a real image — this is a demo/mock
scenario) instead of actual pixels. Respond with EXACTLY three lines, no
preamble, no markdown, phrased the same way you would if you'd actually
seen this in a real snapshot:
DESCRIPTION: <one calm, concrete sentence about what's visible>
CATEGORY: <one of: delivery, visitor, resident, vehicle, unclear>
ACTION: <one short, practical suggestion for the caregiver, or "none needed">`;

/**
 * Mock-mode counterpart to analyzeDoorSnapshot. The mock snapshot is a
 * meaningless placeholder image with no real visual content, so asking
 * Gemini to analyze its actual pixels produces weak, incoherent answers —
 * exactly the wrong thing to have happen on camera during a demo. Instead,
 * this grounds Gemini in a short scene description (see mockData.ts) and
 * asks it to phrase a natural caregiver-facing read on that scene. This
 * still makes a genuine Gemini API call — it's not hardcoded — just
 * grounded in known-accurate text instead of an uninformative image.
 * Real mode never calls this; it always analyzes real snapshot bytes via
 * analyzeDoorSnapshot above.
 */
export async function analyzeMockScene(
  sceneHint: string,
  context: { cameraName: string; eventType: string; timestamp: string }
): Promise<VisionAnalysis> {
  const { response } = await generateWithFallback(ai, MODELS, {
    contents: [
      {
        role: "user",
        parts: [
          {
            text:
              `Camera: ${context.cameraName}\n` +
              `Event type: ${context.eventType}\n` +
              `Timestamp: ${context.timestamp}\n` +
              `Simulated scene: ${sceneHint}`,
          },
        ],
      },
    ],
    config: {
      systemInstruction: MOCK_SYSTEM_PROMPT,
      temperature: 0.4,
      maxOutputTokens: 1024,
    },
  });

  return parseVisionResponse(response.text ?? "");
}

function parseVisionResponse(text: string): VisionAnalysis {
  const descMatch = text.match(/DESCRIPTION:\s*(.+)/i);
  const catMatch = text.match(/CATEGORY:\s*(delivery|visitor|resident|vehicle|unclear)/i);
  const actionMatch = text.match(/ACTION:\s*(.+)/i);

  return {
    description: (descMatch?.[1]?.trim() ?? text.trim()) || "Unable to describe the snapshot.",
    category: (catMatch?.[1]?.toLowerCase() as VisionAnalysis["category"]) ?? "unclear",
    suggestedAction: actionMatch?.[1]?.trim() ?? "none needed",
  };
}
