import "./env.js";
import express from "express";
import cors from "cors";
import { runAgentTurn, type ChatTurn } from "./agentLoop.js";

const PORT = parseInt(process.env.AGENT_GATEWAY_PORT ?? "4200", 10);

const app = express();
app.use(cors());
app.use(express.json());

// In-memory per-session history. Fine for a hackathon demo with one
// household; swap for a real session store before you have more than one
// concurrent user.
const sessions = new Map<string, ChatTurn[]>();

app.post("/chat", async (req, res) => {
  const { sessionId = "default", message } = req.body ?? {};
  if (typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "message is required" });
  }

  // Work on a copy: if this turn fails, the stored history must not keep a
  // dangling user message (consecutive user turns confuse the model).
  const history = [...(sessions.get(sessionId) ?? [])];
  history.push({ role: "user", content: message });

  try {
    const reply = await runAgentTurn(history);
    history.push({ role: "assistant", content: reply });
    sessions.set(sessionId, history.slice(-20)); // bound memory per session
    res.json({ reply });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Guardian ran into a problem answering that." });
  }
});

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`Guardian agent gateway (simulated Alexa+) listening on http://localhost:${PORT}`);
});
