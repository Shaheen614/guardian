import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const MODEL_ID = process.env.GEMINI_VISION_MODEL ?? "gemini-2.0-flash";

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
  const response = await ai.models.generateContent({
    model: MODEL_ID,
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
      maxOutputTokens: 300,
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
