# Guardian — demo video script (target: 2:45, hard cap 3:00)

Judges aren't required to watch past 3:00 — everything that matters must
land before then. Record in this order; cut ruthlessly if you run long
rather than rushing the ending.

Before recording: run `npm run demo:seed` (see README) so the "unusually
quiet" moment is guaranteed to trigger regardless of what time you record.

---

**[0:00–0:25] The problem (25s)**
Talking head or voiceover over a simple establishing shot (your actual
front door, or the web client on screen).

> "Most home security apps are dashboards — you have to remember to check
> them. Guardian is meant to be asked, the way you'd ask a person watching
> the house for you, and to speak up on its own when something's worth a
> check-in."

**[0:25–1:55] Live demo (90s) — the core of the video**

1. (0:25–0:50) Show the web client. Ask out loud: *"Who was at the door?"*
   Let it visibly call the tool, fetch the Ring event, run Gemini vision,
   and answer. Show the description it gives.
2. (0:50–1:20) Ask: *"Has it been quieter than usual?"* — this is the
   moment `npm run demo:seed` guarantees works. Let it flag the anomaly
   and offer to notify a caregiver.
3. (1:20–1:55) Say yes to the notification offer. If you've set up
   `NTFY_TOPIC`, show the real push notification arriving on your phone —
   this is the single most convincing shot in the video, worth the extra
   setup effort if you have time.

**[1:55–2:25] Architecture (30s)**
Cut to a simple diagram (the one in the README, or draw your own) while
you talk over it:

> "Under the hood this is a real MCP server over Streamable HTTP, exposing
> six tools. The agent gateway is a genuine MCP client — it discovers
> those tools at runtime and runs a Gemini tool-calling loop, the same
> architecture a production Alexa+ integration uses. Ring supplies the
> real events, Gemini handles the vision and reasoning."

**[2:25–2:45] What's next (20s)**

> "Next: real SMS/push is already wired up via ntfy, quiet-hours
> configuration so overnight is never flagged, and a trusted-face
> allowlist so Guardian can learn who normally comes by."

---

## Notes

- **Privacy:** if any real people (delivery drivers, neighbors, family)
  appear in real Ring footage you use, consider staging the walk-up
  yourself or blurring other faces — this video becomes public.
- **No third-party trademarks or copyrighted music** per the hackathon
  rules — use royalty-free background music if you want any at all.
- Public upload to YouTube or Vimeo, in English, unlisted-but-public link
  (not private) so judges can open it without requesting access.
