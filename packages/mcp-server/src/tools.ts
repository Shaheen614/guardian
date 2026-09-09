import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fetchLatestDoorbellEvent, fetchRecentEvents, isRealMode } from "./services/ring.js";
import { analyzeDoorSnapshot, analyzeMockScene } from "./services/geminiVision.js";
import { checkHouseholdActivityPattern } from "./services/anomaly.js";
import { sendCaregiverNotification } from "./services/notify.js";
import { appendEvent, listRecentEvents, type DoorEvent } from "./services/store.js";

function textResult(text: string) {
  return { content: [{ type: "text" as const, text }] };
}

/**
 * Registers every Guardian tool on the given MCP server instance. Kept in
 * one place so the tool surface — what an Alexa+ agent is actually allowed
 * to do — is easy to audit at a glance.
 */
export function registerGuardianTools(server: McpServer) {
  server.tool(
    "get_latest_doorbell_event",
    "Fetches the most recent doorbell/motion event from the front door camera, " +
      "including a snapshot when one is available. Use this when the person asks " +
      "something like 'who was at the door' or 'did anyone come by'.",
    {},
    async () => {
      const event = await fetchLatestDoorbellEvent();
      if (!event) return textResult("No recent door events found.");
      await appendEvent(event);
      return textResult(
        `${event.type} at ${event.cameraName}, ${new Date(event.timestamp).toLocaleString()}. ` +
          (event.snapshotBase64
            ? "A snapshot is available — call describe_door_snapshot with this event's data for details."
            : "No snapshot was available for this event.") +
          `\nevent_id=${event.id}`
      );
    }
  );

  server.tool(
    "describe_door_snapshot",
    "Uses Gemini (multimodal, free tier) to look at the most recent doorbell " +
      "snapshot and describe who/what is there, classify the visit, and suggest " +
      "an action. In mock mode, analyzes a simulated scene description instead " +
      "of pixel data (see README) since the placeholder image has no real " +
      "content to see. Call get_latest_doorbell_event first if you don't " +
      "already have a snapshot in hand.",
    {},
    async () => {
      const event = await fetchLatestDoorbellEvent();
      if (!event?.snapshotBase64) {
        return textResult(
          "No snapshot is available to analyze right now (battery cameras can't " +
            "always snapshot mid-recording)."
        );
      }
      const analysis = isRealMode()
        ? await analyzeDoorSnapshot(event.snapshotBase64, {
            cameraName: event.cameraName,
            eventType: event.type,
            timestamp: event.timestamp,
          })
        : await analyzeMockScene(event.mockSceneHint ?? "a routine event at the front door", {
            cameraName: event.cameraName,
            eventType: event.type,
            timestamp: event.timestamp,
          });
      const enriched: DoorEvent = { ...event, description: analysis.description };
      await appendEvent(enriched);
      return textResult(
        `${analysis.description}\nCategory: ${analysis.category}\nSuggested action: ${analysis.suggestedAction}`
      );
    }
  );

  server.tool(
    "list_recent_door_events",
    "Lists the last N door/camera events with timestamps and cameras, oldest to " +
      "newest excluded (most recent first). Use this for questions like 'what " +
      "happened at the door today' or 'how many times did the camera trigger this morning'.",
    { limit: z.number().int().min(1).max(50).default(10) },
    async ({ limit }) => {
      const fresh = await fetchRecentEvents(limit);
      for (const e of fresh) await appendEvent(e);
      const events = await listRecentEvents(limit);
      if (events.length === 0) return textResult("No door events logged yet.");
      const lines = events.map(
        (e) => `- ${new Date(e.timestamp).toLocaleString()} · ${e.cameraName} · ${e.type}`
      );
      return textResult(lines.join("\n"));
    }
  );

  server.tool(
    "check_household_activity_pattern",
    "Compares the current hour's door/camera activity against the household's " +
      "historical baseline for that hour, to answer questions like 'has it been " +
      "quieter than usual today' or to proactively flag an unusually quiet morning. " +
      "Requires a seeded or accumulated baseline (see README).",
    { hour: z.number().int().min(0).max(23).optional() },
    async ({ hour }) => {
      const result = await checkHouseholdActivityPattern(hour);
      return textResult(result.message);
    }
  );

  server.tool(
    "notify_caregiver",
    "Sends a notification to the configured caregiver contact — a real free " +
      "push notification via ntfy.sh if NTFY_TOPIC is set in .env, otherwise " +
      "logs it locally. Call this when check_household_activity_pattern or " +
      "describe_door_snapshot suggests a caregiver should be alerted.",
    { message: z.string().min(1) },
    async ({ message }) => {
      const caregiver = process.env.CAREGIVER_CONTACT_NAME ?? "the caregiver";
      const result = await sendCaregiverNotification(message, caregiver);
      return textResult(
        `Notified ${caregiver} via ${result.channel}: "${message}" (${result.detail})`
      );
    }
  );

  server.tool(
    "guardian_status",
    "Reports whether Guardian is running against the real Ring API or the " +
      "built-in mock data generator. Useful for confirming setup during the demo.",
    {},
    async () => textResult(isRealMode() ? "Connected to the real Ring API." : "Running in mock data mode.")
  );
}
