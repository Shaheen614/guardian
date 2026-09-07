import "./env.js";
import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { registerGuardianTools } from "./tools.js";

const PORT = parseInt(process.env.MCP_SERVER_PORT ?? "4100", 10);

function buildServer(): McpServer {
  const server = new McpServer({
    name: "guardian-mcp",
    version: "0.1.0",
    // MCP protocol version negotiation is handled by the SDK; keep the SDK
    // updated to track the hackathon's required 2025-11-25+ spec. See README
    // "Keeping the MCP spec version current".
  });
  registerGuardianTools(server);
  return server;
}

const app = express();
app.use(express.json());

app.post("/mcp", async (req, res) => {
  // A fresh server + transport per request avoids request-id collisions
  // across concurrent callers, per the MCP SDK's documented pattern for
  // stateless Streamable HTTP servers.
  const server = buildServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  res.on("close", () => {
    transport.close();
    server.close();
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, mode: process.env.RING_MODE ?? "mock" });
});

app.listen(PORT, () => {
  console.log(`Guardian MCP server listening on http://localhost:${PORT}/mcp`);
  console.log(`Mode: ${(process.env.RING_MODE ?? "mock").toUpperCase()}`);
});
