import type { DoorEvent, DoorEventType } from "./services/store.js";

// A tiny 1x1 transparent PNG. Stands in for a real Ring snapshot in mock
// mode so the Gemini vision call path (base64 -> inlineData image part)
// exercises the same code as real mode without requiring a camera.
// Swap RING_MODE=real to see this replaced with an actual doorbell snapshot.
export const MOCK_SNAPSHOT_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

const CAMERAS = ["Front Door", "Driveway"];
const TYPES: DoorEventType[] = ["motion", "doorbell_press", "package", "vehicle"];

// Grounding text for each mock event type, since the placeholder image
// above has no real visual content for Gemini to describe. Rather than
// asking Gemini to hallucinate details from a blank pixel (which produces
// weak, incoherent answers — exactly the wrong thing to have happen on
// camera in a demo), mock-mode analysis passes one of these as scene
// context and asks Gemini to phrase it naturally. Real mode ignores this
// entirely and analyzes an actual snapshot's real pixels instead.
const SCENE_HINTS: Record<DoorEventType, string[]> = {
  doorbell_press: [
    "A person in a delivery uniform presses the doorbell, holding a small package.",
    "An adult presses the doorbell and steps back, waiting, no packages visible.",
  ],
  motion: [
    "Motion is triggered by someone walking up the front path toward the door.",
    "Motion is triggered by a person briefly passing in front of the camera without stopping.",
  ],
  package: [
    "A delivery driver sets a medium-sized box on the doormat and walks away without ringing.",
    "A small package is left leaning against the front door, no one currently in frame.",
  ],
  vehicle: [
    "A delivery van pulls into the driveway and parks.",
    "A car briefly slows near the driveway, then continues on without stopping.",
  ],
};

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
  const type = randomFrom(TYPES);
  return {
    id: `mock-${Date.now()}-${mockCounter}`,
    type,
    cameraName: randomFrom(CAMERAS),
    timestamp: timestamp.toISOString(),
    snapshotBase64: MOCK_SNAPSHOT_BASE64,
    mockSceneHint: randomFrom(SCENE_HINTS[type]),
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
    const type = randomFrom(TYPES);
    return {
      id: `mock-hist-${ts.getTime()}-${mockCounter}`,
      type,
      cameraName: randomFrom(CAMERAS),
      timestamp: ts.toISOString(),
      snapshotBase64: MOCK_SNAPSHOT_BASE64,
      mockSceneHint: randomFrom(SCENE_HINTS[type]),
    };
  });
}
