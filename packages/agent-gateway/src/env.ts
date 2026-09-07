import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

// See packages/mcp-server/src/env.ts for the full explanation — same fix,
// same reason: npm workspace scripts run with cwd set to this package
// directory, not the repo root, and this must stay the *first* import in
// any entrypoint that uses it.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
