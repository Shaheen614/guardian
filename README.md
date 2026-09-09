# Guardian

Guardian is a household agent for the **Alexa+ track** of the Amazon Developer
Hackathon. It's a self-hosted MCP server that watches a Ring front door
camera, uses Google Gemini (free tier, multimodal) to describe what it sees,
notices when a household has gone unusually quiet, and can loop in a
caregiver — all reachable through natural conversation, the way you'd talk
to Alexa+.

> "Who was at the door this morning?" → Guardian checks Ring, looks at the
> snapshot with Gemini, and tells you: a delivery, a visitor, or nothing to
> worry about — and flags it if the pattern looks off.

**A note on cost:** this project runs entirely on free tiers — Ring's
Developer Playground and Google Gemini's free API tier — so it costs
nothing to build, run, or demo. The trade-off, made deliberately: this
version does **not** use any AWS service, so it is **not** entered in the
AWS Builder mini challenge, only the Alexa+ track and the Open Source mini
challenge. If you'd rather compete for that $5,000 mini challenge too, an
earlier revision of this project used AWS Bedrock for the vision call
instead of Gemini for well under $5 of real usage — see git history / ask
for that version back if priorities change.

## Why this exists

Most caregiving/monitoring tools are dashboards you have to remember to
check. Guardian is meant to be asked, in passing, the way you'd ask a
person who was watching the house for you — and to speak up on its own when
something's worth a check-in, without needing you to open an app first.

## Architecture

```
┌─────────────────┐     Streamable HTTP (MCP)     ┌───────────────────┐
│  packages/       │ ─────────────────────────────▶│  packages/         │
│  agent-gateway    │◀───────────────────────────── │  mcp-server         │
│  (simulated       │        tool calls/results      │  ("Guardian")       │
│  Alexa+ agent)    │                                 │                     │
└───────▲───────────┘                                 │  ┌───────────────┐ │
        │ /chat (HTTP)                                 │  │ Ring API /     │ │
        │                                               │  │ mock generator │ │
┌───────┴───────────┐                                   │  └───────────────┘ │
│  packages/         │                                   │  ┌───────────────┐ │
│  web-client         │                                   │  │ Gemini vision  │ │
│  (voice/chat UI,    │                                   │  │ (free tier)    │ │
│  plays the Echo     │                                   │  └───────────────┘ │
│  device role)       │                                   │  ┌───────────────┐ │
└─────────────────────┘                                   │  │ Anomaly engine │ │
                                                            │  └───────────────┘ │
                                                            └────────────────────┘
```

- **`packages/mcp-server`** — the actual Alexa+ deliverable: an MCP server
  over Streamable HTTP exposing tools to read Ring events, get a Gemini
  vision read on a snapshot, list recent activity, check activity against a
  household baseline, and notify a caregiver.
- **`packages/agent-gateway`** — a real MCP *client* (not a shortcut import)
  that connects to the MCP server, discovers its tools at runtime, and runs
  a Gemini tool-calling loop. This plays the role Alexa+ itself would play
  in production — it's the "simulated Alexa+ experience" the hackathon rules
  explicitly allow for teams without direct device/Preview access.
- **`packages/web-client`** — a voice/chat front end (Web Speech API) styled
  as a front-door console, standing in for the Echo device.

## Getting this onto GitHub

The repo is already git-initialized with one commit. To publish it:

```bash
# Create a new empty repo on github.com first (no README/license — you
# already have both), then:
git branch -M main
git remote add origin https://github.com/<your-username>/guardian.git
git push -u origin main
```

Afterward, on the repo's GitHub page, open the gear icon next to "About"
(top right) and set the license there too — the hackathon requires the
license visible in the About section specifically, not just as a file in
the code.

## Recording the demo

See `DEMO_SCRIPT.md` for a shot-by-shot script timed to fit the 3-minute
cap. Before recording, run:

```bash
npm run demo:seed
```

This seeds the baseline so `check_household_activity_pattern` reliably
returns "unusually quiet" the moment you ask, regardless of what time you
actually record — see the script's comments for how.

## Submission materials

- `SUBMISSION.md` — a draft of the Devpost project description and the
  required product-feedback answers, ready to personalize with your actual
  experience.
- `FRICTION_LOG.md` — a template for the optional friction log (worth up
  to a 10% judging bonus) — fill it in live as you hit real setup snags.
- `DEMO_SCRIPT.md` — the video script above.

## Verifying your setup

After `npm install` and setting up `.env`, run:

```bash
npm run smoke-test
```

This starts both services, waits for them to come up, sends a couple of
real requests through the full pipeline (web-client's role → agent-gateway
→ MCP client → MCP server → Ring/mock → Gemini), and prints a clear
pass/fail for each stage — so a broken step is obvious immediately instead
of you guessing why the web client shows nothing.

## Quickstart (mock mode — no Ring account needed)

```bash
npm install
cp .env.example .env
npm run seed:baseline      # generates 14 days of mock activity for anomaly detection
npm run dev:mcp            # terminal 1
npm run dev:agent          # terminal 2
```

Then open `packages/web-client/index.html` in a browser (or serve it with
any static file server) and try:

- "Who was at the door?"
- "Has it been quieter than usual this morning?"
- "Tell my mom I'm on my way if anything looks off." (Guardian will use
  `notify_caregiver`, which logs to the agent-gateway/mcp-server consoles in
  this v1 rather than actually sending an SMS — see "What's mocked" below.)

## Connecting the real Ring API

Set `RING_MODE=real` in `.env`, then get a refresh token one of two ways:

1. **Fastest for a hackathon demo — Ring Developer Playground.** Ring's
   Playground sandbox lets you test device, media, and account APIs without
   creating an app or having an active subscription, and includes one-click
   OAuth token generation plus simulated Package/Vehicle/Motion events — use
   that token as `RING_REFRESH_TOKEN`.
2. **For a real camera** — run `npx -p ring-client-api ring-auth-cli` and
   follow the prompts (this is what `packages/mcp-server/src/services/ring.ts`
   is built against). Note that Ring now watermarks every snapshot delivered
   through its API with the device ID and timestamp — Gemini is prompted to
   ignore this when describing the scene.

No other code changes are needed — every MCP tool calls the mode-aware
functions in `services/ring.ts`, so flipping `RING_MODE` is the only step.

## Connecting Google Gemini (free tier)

Get a free API key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey)
— no billing account or credit card required — and set `GEMINI_API_KEY` in
`.env`. It's used in two places: `packages/mcp-server/src/services/geminiVision.ts`
(the door-snapshot analysis) and `packages/agent-gateway/src/agentLoop.ts`
(the tool-calling loop that plays the Alexa+ agent role), so one key covers
the whole project. Both default to `gemini-2.0-flash`; you can point
`GEMINI_VISION_MODEL` / `AGENT_MODEL` at a different Gemini model if you
want to compare quality, but flash is the one to use to stay comfortably
inside the free tier's rate limits during a demo.

## What's mocked in this v1 (and the honest reason why)

- **Environment loading** (`packages/*/src/env.ts`) resolves `.env` relative
  to its own file location rather than relying on the process's working
  directory, because npm workspace scripts run with `cwd` set to the
  package folder, not the repo root — a plain `dotenv/config` would
  silently miss your `.env`. This must stay the first import in any
  entrypoint file; see the comment in `env.ts` for why.
- **`notify_caregiver`** sends a real, free push notification via
  [ntfy.sh](https://ntfy.sh) if `NTFY_TOPIC` is set in `.env`, otherwise
  falls back to logging locally. No account or card needed either way —
  see `.env.example` for setup. Pick a hard-to-guess topic name, since
  ntfy topics aren't private by name, just by obscurity.
- **Quiet hours** (`QUIET_HOURS_START` / `QUIET_HOURS_END` in `.env`) let
  you mark a window (e.g. overnight) that's never evaluated for anomalies,
  regardless of what the baseline says.
- **Anomaly baseline** starts empty on a fresh checkout. `npm run
  seed:baseline` fills in 14 days of plausible mock activity so
  `check_household_activity_pattern` has something to compare against
  immediately; in real use it fills in naturally after a few days of real
  events.
- **Mock Ring events reuse the "latest" event for a couple of minutes**
  rather than fabricating a brand-new random visitor on every single
  question. This matters for two reasons: repeated questions in one
  conversation get a consistent answer, and — more importantly — it stops
  every tool call from silently inflating that hour's logged event count,
  which would otherwise defeat the anomaly baseline the demo scenario
  depends on. Real mode is unaffected; it always reflects Ring's actual
  latest event.
- **Mock-mode vision analysis is grounded in a text scene description, not
  the placeholder image's pixels.** The mock snapshot is a meaningless 1×1
  blank PNG (see below) — asking Gemini to describe its actual content
  produces weak, incoherent answers, which is the last thing you want on
  camera in a demo. `describe_door_snapshot` detects mock mode and calls
  `analyzeMockScene()` instead of `analyzeDoorSnapshot()`: it still makes a
  real Gemini call, just grounded in a short, honest scene description
  (`mockData.ts`'s `SCENE_HINTS`) instead of uninformative image bytes.
  Real mode always analyzes actual snapshot pixels.
- **Mock Ring events** use a 1x1 placeholder image for the "snapshot" so the
  Gemini vision call path is exercised end-to-end even without a camera —
  switch to `RING_MODE=real` to see it work on an actual doorbell image.

## Hackathon requirements checklist

- **Primary track: Alexa+.** The repo's core deliverable calls the MCP SDK
  directly (`@modelcontextprotocol/sdk`, Streamable HTTP transport) — see
  `packages/mcp-server/src/index.ts`. The web client is the allowed
  simulated-Alexa+ path, with its own source code included.
- **AWS Builder mini challenge: not entered by this version.** This build
  deliberately uses Gemini instead of AWS Bedrock to keep running cost at
  zero, which means it isn't eligible for the AWS Builder mini challenge
  (that requires a documented AWS service integration). If that trade-off
  changes, swapping `services/geminiVision.ts` back to a Bedrock
  `ConverseCommand` call is a same-shaped, contained change.
- **Open Source mini challenge:** MIT license at the top of this repo's About
  section (`LICENSE`), full source included.
- **Keeping the MCP spec version current:** the hackathon requires spec
  2025-11-25 or later. Protocol version negotiation is handled by
  `@modelcontextprotocol/sdk` — before submitting, run `npm ls
  @modelcontextprotocol/sdk` and update to the latest release to make sure
  the negotiated version clears the bar.

## Roadmap for the next revision

- Real push/SMS notifications for `notify_caregiver`.
- Multi-camera households (currently treats all cameras as one household
  stream for baseline purposes).
- A "quiet hours" config so expected-quiet periods (e.g. overnight) aren't
  ever flagged regardless of baseline math.
- Trusted-face allowlist so Gemini's `category: resident` classification
  can be corrected/taught over time instead of guessed per snapshot.

## License

MIT — see `LICENSE`.
