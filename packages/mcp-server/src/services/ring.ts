import type { DoorEvent } from "./store.js";
import { generateMockEvent, MOCK_SNAPSHOT_BASE64 } from "../mockData.js";

const RING_MODE = (process.env.RING_MODE ?? "mock").toLowerCase();

/**
 * We lazily import ring-client-api only when RING_MODE=real so that the
 * whole project still boots (and the mock demo still runs) for anyone who
 * hasn't installed a Ring account / refresh token yet.
 *
 * Swap-in path to the official Ring Partner API / Ring MCP Server:
 * ring-client-api talks to Ring's consumer cloud API directly, which is the
 * fastest way to pull *real* events for a hackathon demo. If you have Ring
 * Partner API / Appstore credentials instead, replace the two functions
 * below with calls to your Partner API base URL — the DoorEvent shape
 * returned to the rest of the app stays identical either way.
 */
let ringApiSingleton: import("ring-client-api").RingApi | null = null;

async function getRingApi() {
  if (ringApiSingleton) return ringApiSingleton;
  const { RingApi } = await import("ring-client-api");
  const refreshToken = process.env.RING_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error(
      "RING_MODE=real but RING_REFRESH_TOKEN is not set. Generate one with " +
        "`npx -p ring-client-api ring-auth-cli`, or via the Ring Developer " +
        "Playground's one-click OAuth token flow, and put it in your .env."
    );
  }
  ringApiSingleton = new RingApi({ refreshToken });
  return ringApiSingleton;
}

async function bufferToBase64(buf: Buffer): Promise<string> {
  return buf.toString("base64");
}

export async function getLatestDoorbellEventReal(): Promise<DoorEvent | undefined> {
  const ringApi = await getRingApi();
  const locations = await ringApi.getLocations();
  for (const location of locations) {
    for (const camera of location.cameras) {
      const history = await camera.getEvents({ limit: 1 });
      const latest = history.events?.[0];
      if (!latest) continue;

      let snapshotBase64: string | undefined;
      try {
        const snapshot = await camera.getSnapshot();
        snapshotBase64 = await bufferToBase64(snapshot);
      } catch {
        // Battery-powered cameras can't snapshot mid-recording — that's a
        // known Ring limitation, not a bug in this integration. We still
        // return the event without a snapshot rather than failing the tool.
      }

      return {
        id: String(latest.ding_id_str ?? latest.id ?? Date.now()),
        type: latest.kind === "ding" ? "doorbell_press" : "motion",
        cameraName: camera.name,
        timestamp: new Date(latest.created_at ?? Date.now()).toISOString(),
        snapshotBase64,
      };
    }
  }
  return undefined;
}

export async function listRecentRingEventsReal(limit: number): Promise<DoorEvent[]> {
  const ringApi = await getRingApi();
  const locations = await ringApi.getLocations();
  const events: DoorEvent[] = [];
  for (const location of locations) {
    for (const camera of location.cameras) {
      const history = await camera.getEvents({ limit });
      for (const evt of history.events ?? []) {
        events.push({
          id: String(evt.ding_id_str ?? evt.id ?? `${Date.now()}-${events.length}`),
          type: evt.kind === "ding" ? "doorbell_press" : "motion",
          cameraName: camera.name,
          timestamp: new Date(evt.created_at ?? Date.now()).toISOString(),
        });
      }
    }
  }
  return events
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}

// ---- Public, mode-aware API -------------------------------------------
// Every MCP tool calls these two functions and never touches RING_MODE
// directly, so flipping real/mock is a one-line .env change.

export async function fetchLatestDoorbellEvent(): Promise<DoorEvent | undefined> {
  if (RING_MODE === "real") return getLatestDoorbellEventReal();
  return generateMockEvent();
}

export async function fetchRecentEvents(limit = 10): Promise<DoorEvent[]> {
  if (RING_MODE === "real") return listRecentRingEventsReal(limit);
  return Array.from({ length: limit }, () => generateMockEvent());
}

export function isRealMode(): boolean {
  return RING_MODE === "real";
}

export { MOCK_SNAPSHOT_BASE64 };
