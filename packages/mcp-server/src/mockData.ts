import type { DoorEvent, DoorEventType } from "./services/store.js";

// A tiny 1x1 transparent PNG. Stands in for a real Ring snapshot in mock
// mode so the Gemini vision call path (base64 -> inlineData image part)
// exercises the same code as real mode without requiring a camera.
// Swap RING_MODE=real to see this replaced with an actual doorbell snapshot.
export const MOCK_SNAPSHOT_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

const CAMERAS = ["Front Door", "Driveway"];
const TYPES: DoorEventType[] = ["motion", "doorbell_press", "package", "vehicle"];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

let mockCounter = 0;

export function generateMockEvent(atHour?: number): DoorEvent {
  mockCounter += 1;
  const timestamp = new Date();
  if (typeof atHour === "number") {
    timestamp.setHours(atHour, Math.floor(Math.random() * 60), 0, 0);
  }
  return {
    id: `mock-${Date.now()}-${mockCounter}`,
    type: randomFrom(TYPES),
    cameraName: randomFrom(CAMERAS),
    timestamp: timestamp.toISOString(),
    snapshotBase64: MOCK_SNAPSHOT_BASE64,
  };
}

/**
 * Generates a plausible day of household activity so anomaly detection has
 * something to compare against on a fresh checkout, before any real history
 * has accumulated. Mirrors a typical "someone's home" pattern: a cluster of
 * events in the morning, a quiet midday, and an evening cluster.
 */
export function generateMockDay(date: Date): DoorEvent[] {
  const weighted = [
    ...Array(3).fill(7),
    ...Array(4).fill(8),
    ...Array(2).fill(9),
    ...Array(2).fill(12),
    ...Array(3).fill(17),
    ...Array(4).fill(18),
    ...Array(2).fill(19),
  ];
  return weighted.map((hour) => {
    const ts = new Date(date);
    ts.setHours(hour, Math.floor(Math.random() * 60), 0, 0);
    mockCounter += 1;
    return {
      id: `mock-hist-${ts.getTime()}-${mockCounter}`,
      type: randomFrom(TYPES),
      cameraName: randomFrom(CAMERAS),
      timestamp: ts.toISOString(),
      snapshotBase64: MOCK_SNAPSHOT_BASE64,
    };
  });
}
