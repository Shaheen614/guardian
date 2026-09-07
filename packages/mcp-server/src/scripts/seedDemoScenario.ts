import "../env.js";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setBaseline, type HourlyBaseline } from "../services/store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, "..", "..", "data");
const EVENTS_FILE = path.join(DATA_DIR, "events.json");

/**
 * Seeds a baseline where the CURRENT hour (whatever time you run this) is
 * marked as normally busy, and clears logged events so this hour shows
 * zero activity so far. The result: calling check_household_activity_pattern
 * right after running this reliably returns "unusually_quiet" — regardless
 * of what hour you actually happen to be recording at.
 *
 * This is a demo aid, not a claim about real household behavior — say so
 * plainly if asked during Q&A. Run `npm run seed:baseline` instead for a
 * more realistic (but less guaranteed-dramatic) multi-hour pattern.
 */
async function main() {
  const now = new Date();
  const anchorHour = now.getHours();

  const baseline: HourlyBaseline[] = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    count: hour === anchorHour ? 10 : 3,
    meanEvents: hour === anchorHour ? 5.5 : 0.8,
  }));
  await setBaseline(baseline);

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(EVENTS_FILE, "[]", "utf-8");

  console.log(`Demo scenario ready for hour ${anchorHour}:00.`);
  console.log(
    `Baseline says this hour is normally busy (~5.5 events/hour) but the event log is now empty.`
  );
  console.log(
    `Ask Guardian something like "has it been quieter than usual this hour?" right now — ` +
      `it should come back unusually_quiet. Record within this same hour, or re-run this ` +
      `script if you cross an hour boundary before recording.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
