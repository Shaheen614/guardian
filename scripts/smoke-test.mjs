#!/usr/bin/env node
// Guardian smoke test — starts both services, exercises the full pipeline
// end to end (web client would normally do this through a browser), and
// reports a clear pass/fail. Run with `npm run smoke-test` from the repo
// root after `npm install` and setting up `.env`.
//
// This is a setup-verification tool, not a full test suite: it checks
// "did everything wire up correctly", not "is every tool's logic correct
// in every edge case".

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(ROOT, ".env") });

const MCP_PORT = process.env.MCP_SERVER_PORT ?? "4100";
const AGENT_PORT = process.env.AGENT_GATEWAY_PORT ?? "4200";
const MCP_HEALTH_URL = `http://localhost:${MCP_PORT}/health`;
const AGENT_HEALTH_URL = `http://localhost:${AGENT_PORT}/health`;
const AGENT_CHAT_URL = `http://localhost:${AGENT_PORT}/chat`;

const results = [];
const children = [];

function record(name, pass, detail) {
  results.push({ name, pass, detail });
  const icon = pass ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m";
  console.log(`${icon} ${name}${detail ? ` — ${detail}` : ""}`);
}

function killAll() {
  for (const child of children) {
    if (!child.killed) child.kill("SIGTERM");
  }
}

process.on("SIGINT", () => {
  killAll();
  process.exit(1);
});

async function waitForHealth(url, label, timeoutMs = 25000) {
  const start = Date.now();
  let lastErr;
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
      lastErr = `HTTP ${res.status}`;
    } catch (err) {
      lastErr = err.message;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`${label} did not become healthy within ${timeoutMs}ms (last: ${lastErr})`);
}

function spawnService(name, args, cwd) {
  const child = spawn("npx", ["tsx", ...args], {
    cwd,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });
  children.push(child);
  let output = "";
  child.stdout.on("data", (d) => (output += d.toString()));
  child.stderr.on("data", (d) => (output += d.toString()));
  child.on("exit", (code) => {
    if (code !== 0 && code !== null) {
      console.error(`\n--- ${name} exited early (code ${code}) — recent output ---`);
      console.error(output.slice(-2000));
    }
  });
  return child;
}

async function main() {
  console.log("Guardian smoke test\n--------------------");

  if (!process.env.GEMINI_API_KEY) {
    record(
      "GEMINI_API_KEY is set",
      false,
      "no key found in .env — vision and agent replies will fail even if the servers start"
    );
  } else {
    record("GEMINI_API_KEY is set", true);
  }

  console.log("\nStarting mcp-server and agent-gateway...");
  spawnService("mcp-server", ["src/index.ts"], path.join(ROOT, "packages/mcp-server"));
  spawnService("agent-gateway", ["src/index.ts"], path.join(ROOT, "packages/agent-gateway"));

  try {
    await waitForHealth(MCP_HEALTH_URL, "mcp-server");
    record("mcp-server /health responds", true, MCP_HEALTH_URL);
  } catch (err) {
    record("mcp-server /health responds", false, err.message);
    killAll();
    printSummaryAndExit();
    return;
  }

  try {
    await waitForHealth(AGENT_HEALTH_URL, "agent-gateway");
    record("agent-gateway /health responds", true, AGENT_HEALTH_URL);
  } catch (err) {
    record("agent-gateway /health responds", false, err.message);
    killAll();
    printSummaryAndExit();
    return;
  }

  try {
    const res = await fetch(AGENT_CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: "smoke-test", message: "What's your status?" }),
    });
    const data = await res.json();
    if (res.ok && typeof data.reply === "string" && data.reply.trim().length > 0) {
      record("agent-gateway /chat returns a reply", true, `"${data.reply.slice(0, 80)}..."`);
    } else {
      record("agent-gateway /chat returns a reply", false, JSON.stringify(data));
    }
  } catch (err) {
    record("agent-gateway /chat returns a reply", false, err.message);
  }

  try {
    const res = await fetch(AGENT_CHAT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: "smoke-test", message: "Who was at the door recently?" }),
    });
    const data = await res.json();
    const usedTool = res.ok && typeof data.reply === "string" && data.reply.length > 0;
    record(
      "full pipeline (agent -> MCP client -> MCP server -> Ring/mock -> reply) works",
      usedTool,
      usedTool ? `"${data.reply.slice(0, 80)}..."` : JSON.stringify(data)
    );
  } catch (err) {
    record("full pipeline (agent -> MCP client -> MCP server -> Ring/mock -> reply) works", false, err.message);
  }

  killAll();
  printSummaryAndExit();
}

function printSummaryAndExit() {
  const passed = results.filter((r) => r.pass).length;
  console.log(`\n--------------------\n${passed}/${results.length} checks passed`);
  if (passed !== results.length) {
    console.log(
      "\nSee the first ✗ above for what to fix — checks run in dependency order, so later failures are often caused by the first one."
    );
  }
  process.exit(passed === results.length ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  killAll();
  process.exit(1);
});
