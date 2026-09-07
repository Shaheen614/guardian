# Guardian — Devpost submission draft

Copy/adapt the sections below directly into the Devpost submission form.
Anything in [brackets] needs a real answer from your actual setup/testing —
don't submit those as-is.

---

## Project description (what it does, how it works)

Guardian is a household agent for the Alexa+ track: a self-hosted MCP
server that watches a Ring front door camera, uses Google Gemini
(multimodal) to describe what it sees, and notices when a household has
gone unusually quiet compared to its own history — all reachable through
natural conversation, the way you'd talk to Alexa+.

Ask "who was at the door this morning?" and Guardian checks the latest
Ring event, looks at the snapshot with Gemini, and tells you in plain
language whether it was a delivery, a visitor, or nothing to worry about.
Ask "has it been quieter than usual?" and it compares this hour's activity
against a rolling per-hour baseline it builds from real household history,
and can proactively suggest notifying a caregiver if something looks off.

**How it works:** the MCP server (`packages/mcp-server`) exposes six tools
— reading Ring events, running Gemini vision analysis on a snapshot,
listing recent activity, checking today's activity against the household's
baseline, sending a caregiver notification, and reporting connection
status — over Streamable HTTP. A separate agent gateway
(`packages/agent-gateway`) acts as a genuine MCP *client*: it connects to
the server, discovers its tools at runtime, and runs a Gemini
function-calling loop to decide which tools to call for a given request —
architecturally identical to how a production Alexa+ integration would
work. A voice/chat web client stands in for the Echo device, using the Web
Speech API so you can actually talk to it and hear it answer back.

Everything runs on free tiers (Ring's Developer Playground, Gemini's free
API tier) — genuinely zero cost to build, run, or demo.

---

## Product feedback (per tool/API/SDK used)

Fill in the specifics after your first real setup — the structure below is
ready, the content needs your actual experience.

### Model Context Protocol TypeScript SDK (`@modelcontextprotocol/sdk`)
- **What we used it for:** the core Alexa+ deliverable — a Streamable HTTP
  MCP server exposing Guardian's tools, and an MCP client in the agent
  gateway that discovers and calls those tools at runtime.
- **What worked well:** [fill in — e.g. tool registration API, schema
  validation via zod, transport setup]
- **What needs work:** [fill in — e.g. any friction getting Streamable HTTP
  configured correctly, documentation gaps you hit]
- **Onboarding:** [fill in — how long from "clone the SDK docs" to "first
  working tool call"]
- **Would you build with it again:** [fill in]

### Ring API / Ring Developer Playground / ring-client-api
- **What we used it for:** fetching real doorbell/motion events and camera
  snapshots for the vision-analysis pipeline.
- **What worked well:** [fill in — e.g. Playground's no-account sandbox,
  simulated event types]
- **What needs work:** [fill in — e.g. the mandatory snapshot watermark
  added in June 2026, any auth friction]
- **Onboarding:** [fill in]
- **Would you build with it again:** [fill in]

### Google Gemini API (`@google/genai`)
- **What we used it for:** multimodal analysis of door snapshots, and the
  tool-calling loop that drives the whole agent.
- **What worked well:** [fill in — e.g. free tier being genuinely usable
  for a full hackathon project, function-calling ergonomics]
- **What needs work:** [fill in — e.g. any schema compatibility friction
  between MCP's JSON Schema output and Gemini's function-declaration
  format — we had to strip a few JSON Schema keywords Gemini didn't
  recognize; note whether that was still necessary for you]
- **Onboarding:** [fill in]
- **Would you build with it again:** [fill in]

---

## Track & mini challenge selection

- Primary track: **Alexa+**
- Mini challenge: **Open Source** (MIT license, full source in the public
  repo)
- Not entered: AWS Builder (this build deliberately avoids AWS to stay at
  zero cost — see README for the reasoning)

## If your project existed before the hackathon

N/A — Guardian was built entirely during the hackathon window. Delete this
section if not applicable, or replace with what changed if you continue
iterating on it before the deadline in a way that matters for judging.

---

## Optional: feature requests

[Fill in only if you actually hit a real limitation you'd want the
Alexa+/Ring/Gemini teams to fix — genuine requests read much better to
judges than invented ones.]

## Optional: friction log

See `FRICTION_LOG.md` in the repo root — fill that in as you go during
your first real setup, then summarize the entries here (or link the file)
for the judging bonus.
