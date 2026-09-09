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

