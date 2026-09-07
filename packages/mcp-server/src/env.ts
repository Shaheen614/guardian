import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

// npm workspaces run package scripts with cwd set to the package directory,
// not the repo root, so a plain `import "dotenv/config"` would miss the
// root .env silently. This resolves the path relative to this file's own
// location instead, which is stable regardless of who imports it or what
// the current working directory is.
//
// IMPORTANT: this must be the *first* import in any entrypoint that uses
// it (index.ts, scripts/*.ts) — ES module import declarations evaluate in
// source order before the importing module's own code runs, so if this
// isn't first, modules imported earlier (like services/ring.ts, which
// reads process.env.RING_MODE at module load time) would already have run
// with an unloaded environment.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
