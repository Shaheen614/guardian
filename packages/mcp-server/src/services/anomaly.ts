import { getBaseline, listRecentEvents } from "./store.js";

export interface ActivityCheck {
  status: "normal" | "quiet" | "unusually_quiet" | "insufficient_baseline" | "quiet_hours";
  hour: number;
  eventsThisHour: number;
  expectedEventsThisHour: number | null;
  message: string;
}

function parseQuietHoursConfig(): { start: number; end: number } | null {
  const start = process.env.QUIET_HOURS_START;
  const end = process.env.QUIET_HOURS_END;
  if (start === undefined || end === undefined) return null;
  const s = parseInt(start, 10);
  const e = parseInt(end, 10);
  if (Number.isNaN(s) || Number.isNaN(e) || s < 0 || s > 23 || e < 0 || e > 23) return null;
  return { start: s, end: e };
}

/**
 * True if `hour` falls within the configured quiet-hours window. Handles
 * the overnight-wraparound case (e.g. 23 -> 6) as well as a same-day window.
 */
function isWithinQuietHours(hour: number, window: { start: number; end: number }): boolean {
  const { start, end } = window;
  if (start === end) return false; // a zero-width window quiets nothing
  if (start < end) return hour >= start && hour < end;
  return hour >= start || hour < end; // wraps past midnight
}

/**
 * Compares this hour's event count against the rolling baseline for the
 * same hour-of-day. This is intentionally a simple, explainable heuristic
 * (not a black-box model) because a caregiving feature needs to be able to
 * say *why* it's raising a flag, not just that it did.
 */
export async function checkHouseholdActivityPattern(currentHour?: number): Promise<ActivityCheck> {
  const hour = currentHour ?? new Date().getHours();

  // An explicit quiet-hours window (QUIET_HOURS_START/END in .env) always
  // wins over the baseline math — if a household says "we're always asleep
  // from 11pm-6am", that hour should never generate a flag, no matter what
  // the accumulated baseline happens to say.
  const quietWindow = parseQuietHoursConfig();
  if (quietWindow && isWithinQuietHours(hour, quietWindow)) {
    return {
      status: "quiet_hours",
      hour,
      eventsThisHour: 0,
      expectedEventsThisHour: null,
      message: `This hour is configured as quiet hours (${quietWindow.start}:00–${quietWindow.end}:00) — not evaluated for anomalies.`,
    };
  }

  const baseline = await getBaseline();
  const hourBaseline = baseline.find((b) => b.hour === hour);

  const recent = await listRecentEvents(200);
  const eventsThisHour = recent.filter((e) => new Date(e.timestamp).getHours() === hour).length;

  if (!hourBaseline || hourBaseline.count < 3) {
    return {
      status: "insufficient_baseline",
      hour,
      eventsThisHour,
      expectedEventsThisHour: null,
      message:
        "Not enough history for this hour yet — Guardian needs a few more days of " +
        "activity before it can tell normal from unusual. Run `npm run seed:baseline` " +
        "for a demo baseline, or let it run for a few real days.",
    };
  }

  const expected = hourBaseline.meanEvents;
  // A quiet hour is only worth flagging if the household is normally active
  // then; an expected-quiet hour (e.g. 3am) staying quiet is not news.
  if (expected < 0.5) {
    return {
      status: "normal",
      hour,
      eventsThisHour,
      expectedEventsThisHour: expected,
      message: `This hour is normally quiet (baseline ${expected.toFixed(1)} events) — nothing unusual.`,
    };
  }

  const ratio = eventsThisHour / expected;
  if (ratio < 0.34) {
    return {
      status: "unusually_quiet",
      hour,
      eventsThisHour,
      expectedEventsThisHour: expected,
      message:
        `Unusually quiet: ${eventsThisHour} event(s) seen so far this hour vs a typical ` +
        `${expected.toFixed(1)}. Worth a check-in if this continues.`,
    };
  }
  if (ratio < 0.7) {
    return {
      status: "quiet",
      hour,
      eventsThisHour,
      expectedEventsThisHour: expected,
      message: `Somewhat quieter than usual (${eventsThisHour} vs typical ${expected.toFixed(1)}), but not alarming yet.`,
    };
  }
  return {
    status: "normal",
    hour,
    eventsThisHour,
    expectedEventsThisHour: expected,
    message: `Activity this hour (${eventsThisHour}) is in line with the usual pattern (${expected.toFixed(1)}).`,
  };
}
