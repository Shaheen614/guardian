# Guardian — friction log

Fill in one entry per real snag you hit, as you hit it — this reads far
better to judges captured live than reconstructed from memory afterward.
Delete the example below once you've replaced it with real entries.

Severity scale: critical (blocked entirely) / major (significant workaround
needed) / minor (annoying but quick to solve) / cosmetic (docs typo etc.)

---

### Example entry (delete this)

- **Task attempted:** Setting `RING_MODE=real` and connecting a Ring
  account for the first time.
- **Steps taken:** Ran `npx -p ring-client-api ring-auth-cli`, entered
  account email/password.
- **Expected:** A refresh token printed to the terminal.
- **Actual:** [what actually happened]
- **Severity:** [rating]
- **Workaround used:** [if any]
- **Suggestion:** [what would have made this smoother]

---

## Real entries

- **Task attempted:** Getting a Ring refresh token via `ring-auth-cli` to
  enable `RING_MODE=real`.
- **Steps taken:** Ran `npx -p ring-client-api ring-auth-cli`, entered
  Ring account email and password when prompted (tried this with two
  different accounts).
- **Expected:** A refresh token printed to the terminal.
- **Actual:** `Error: Failed to fetch oauth token from Ring. Verify that
  your email and password are correct. (error: access_denied)` on both
  attempts, with no further detail distinguishing "wrong password" from
  "this account can't authenticate this way at all."
- **Severity:** Major — blocked real-Ring testing entirely for this
  submission; we didn't have a spare hour to chase down whether the
  accounts used social sign-in (which is the likely cause) versus a
  genuine credential issue, or access to a physical Ring device to
  register a fresh account against.
- **Workaround used:** Ran the full submission in `RING_MODE=mock`
  instead — the mock generator exercises the identical code path and tool
  interface, so the architecture is fully demonstrated either way.
- **Suggestion:** A more specific error message (e.g. distinguishing
  "these credentials are wrong" from "this account uses social sign-in and
  has no native password") would save real time for developers hitting
  this on their first attempt.


- **Task attempted:** Getting the agent's Gemini tool-calling loop working
  for the first time on a fresh machine.
- **Steps taken:** Followed the code as written (default model
  `gemini-2.0-flash`), then moved through the models Google's errors
  pointed to.
- **Expected:** A normal tool-calling round trip.
- **Actual:** Three separate failures in a row: (1) `404 ... no longer
  available to new users` for `gemini-2.5-flash` (it still appeared in the
  `models.list` response for the same key, so the list was misleading);
  (2) `503 ... high demand` on `gemini-3.8-flash`; (3) `400 ... Function call
  is missing a thought_signature` once Gemini 3 tool calls started
  working.
- **Severity:** Major for (3), minor for (1) and (2). (3) stopped all tool
  use until the loop was changed to replay the model's response unchanged.
- **Workaround used:** Model fallback chain + retry with backoff for
  404/503; replay the model's full response content and use the documented
  `skip_thought_signature_validator` value if a signature is missing;
  upgrade `@google/genai` to a current major version.
- **Suggestion:** Have `models.list` exclude models that return "no longer
  available" for the calling key, and make the SDK's tool-calling examples
  show the thought-signature requirement up front — hand-built tool loops
  hit it on the very first call.
