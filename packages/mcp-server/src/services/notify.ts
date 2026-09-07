const NTFY_TOPIC = process.env.NTFY_TOPIC;
const NTFY_BASE_URL = process.env.NTFY_BASE_URL ?? "https://ntfy.sh";

export interface NotifyResult {
  delivered: boolean;
  channel: "ntfy" | "console";
  detail: string;
}

/**
 * Sends a caregiver notification. If NTFY_TOPIC is set in .env, this posts
 * a real push notification via ntfy.sh — a free, no-account, no-card
 * notification service: anyone who has subscribed to that topic in the
 * ntfy app or web UI gets it instantly. If NTFY_TOPIC isn't set, this
 * falls back to logging, so the project still runs with zero setup.
 *
 * ntfy topics are unauthenticated by default — treat the topic name itself
 * as the secret (e.g. "guardian-alerts-x7f2q1", not "guardian-alerts") so
 * a stranger can't guess it and subscribe to your household's alerts.
 */
export async function sendCaregiverNotification(
  message: string,
  caregiverName: string
): Promise<NotifyResult> {
  if (!NTFY_TOPIC) {
    console.log(`[Guardian notification -> ${caregiverName}] ${message}`);
    return {
      delivered: true,
      channel: "console",
      detail: "NTFY_TOPIC not set — logged locally instead of sent. See README to enable real push.",
    };
  }

  try {
    const res = await fetch(`${NTFY_BASE_URL}/${NTFY_TOPIC}`, {
      method: "POST",
      headers: {
        Title: `Guardian: ${caregiverName}`,
        Priority: "default",
        Tags: "house,camera",
      },
      body: message,
    });

    if (!res.ok) {
      throw new Error(`ntfy responded with HTTP ${res.status}`);
    }

    return {
      delivered: true,
      channel: "ntfy",
      detail: `Pushed to ntfy.sh/${NTFY_TOPIC}`,
    };
  } catch (err) {
    // Never let a notification failure break the tool call — fall back to
    // logging so the agent still has something true to tell the user.
    console.error("ntfy delivery failed, falling back to console log:", err);
    console.log(`[Guardian notification -> ${caregiverName}] ${message}`);
    return {
      delivered: false,
      channel: "console",
      detail: `ntfy delivery failed (${(err as Error).message}) — logged locally instead.`,
    };
  }
}
