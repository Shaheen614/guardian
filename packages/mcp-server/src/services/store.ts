import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "..", "data");
const EVENTS_FILE = path.join(DATA_DIR, "events.json");
const BASELINE_FILE = path.join(DATA_DIR, "baseline.json");

export type DoorEventType = "motion" | "doorbell_press" | "package" | "vehicle";

export interface DoorEvent {
  id: string;
  type: DoorEventType;
  cameraName: string;
  timestamp: string; // ISO 8601
  snapshotBase64?: string; // present when a snapshot was captured/analyzed
  description?: string; // filled in once Gemini has looked at it
  mockSceneHint?: string; // mock mode only — grounding text for vision analysis, since the placeholder image has no real content to see
}

export interface HourlyBaseline {
  // hour-of-day (0-23) -> running stats across days observed
  hour: number;
  count: number; // number of days included in the average
  meanEvents: number; // mean number of events historically seen in this hour
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const raw = await fs.readFile(file, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson(file: string, data: unknown) {
  await ensureDataDir();
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf-8");
}

export async function appendEvent(event: DoorEvent): Promise<void> {
  const events = await readJson<DoorEvent[]>(EVENTS_FILE, []);
  const last = events[events.length - 1];
  if (last && last.id === event.id) {
    // Same event as before (e.g. a cached "latest event" returned again, or
    // an enriched version with a description added after vision analysis)
    // — update it in place rather than logging a duplicate.
    events[events.length - 1] = event;
  } else {
    events.push(event);
  }
  // Keep the log bounded — this is a demo store, not a production database.
  const trimmed = events.slice(-500);
  await writeJson(EVENTS_FILE, trimmed);
}

export async function listRecentEvents(limit = 10): Promise<DoorEvent[]> {
  const events = await readJson<DoorEvent[]>(EVENTS_FILE, []);
  return events.slice(-limit).reverse();
}

export async function getLatestEvent(): Promise<DoorEvent | undefined> {
  const events = await readJson<DoorEvent[]>(EVENTS_FILE, []);
  return events[events.length - 1];
}

export async function getBaseline(): Promise<HourlyBaseline[]> {
  return readJson<HourlyBaseline[]>(BASELINE_FILE, []);
}

export async function setBaseline(baseline: HourlyBaseline[]): Promise<void> {
  await writeJson(BASELINE_FILE, baseline);
}

/**
 * Folds a fresh day of event timestamps into the rolling per-hour baseline
 * using a simple incremental mean. This is intentionally simple (no external
 * ML dependency) but is enough to answer "is this hour unusually quiet or
 * unusually busy compared to what we've seen before?".
 */
export async function foldDayIntoBaseline(dayEvents: DoorEvent[]): Promise<void> {
  const baseline = await getBaseline();
  const byHour = new Map<number, HourlyBaseline>(baseline.map((b) => [b.hour, b]));

  const countsThisDay = new Array(24).fill(0);
  for (const evt of dayEvents) {
    const hour = new Date(evt.timestamp).getHours();
    countsThisDay[hour] += 1;
  }

  for (let hour = 0; hour < 24; hour++) {
    const existing = byHour.get(hour) ?? { hour, count: 0, meanEvents: 0 };
    const newCount = existing.count + 1;
    const newMean = existing.meanEvents + (countsThisDay[hour] - existing.meanEvents) / newCount;
    byHour.set(hour, { hour, count: newCount, meanEvents: newMean });
  }

  await setBaseline(Array.from(byHour.values()).sort((a, b) => a.hour - b.hour));
}
