import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const MCP_SERVER_URL = process.env.MCP_SERVER_URL ?? "http://localhost:4100/mcp";

let clientSingleton: Client | null = null;

/**
 * This is the piece that makes the "simulated Alexa+" front end an actual
 * MCP client rather than a shortcut that imports Guardian's tool functions
 * directly. The agent negotiates the MCP protocol, discovers tools at
 * runtime, and calls them exactly the way a real Alexa+ integration would.
 */
export async function getMcpClient(): Promise<Client> {
  if (clientSingleton) return clientSingleton;

  const client = new Client({ name: "guardian-agent-gateway", version: "0.1.0" });
  const transport = new StreamableHTTPClientTransport(new URL(MCP_SERVER_URL));
  await client.connect(transport);
  clientSingleton = client;
  return client;
}

export interface DiscoveredTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export async function listMcpTools(): Promise<DiscoveredTool[]> {
  const client = await getMcpClient();
  const { tools } = await client.listTools();
  return tools.map((t) => ({
    name: t.name,
    description: t.description ?? "",
    inputSchema: (t.inputSchema as Record<string, unknown>) ?? { type: "object", properties: {} },
  }));
}

export async function callMcpTool(name: string, args: Record<string, unknown>): Promise<string> {
  const client = await getMcpClient();
  const result = await client.callTool({ name, arguments: args });
  const content = result.content as Array<{ type: string; text?: string }> | undefined;
  return content?.map((c) => c.text ?? "").join("\n") ?? "(tool returned no content)";
}
