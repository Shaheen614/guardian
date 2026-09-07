const AGENT_URL = window.GUARDIAN_AGENT_URL || "http://localhost:4200";
const sessionId = crypto.randomUUID();

const orbButton = document.getElementById("orbButton");
const orbHint = document.getElementById("orbHint");
const typeForm = document.getElementById("typeForm");
const typeInput = document.getElementById("typeInput");
const logList = document.getElementById("logList");
const statusDot = document.getElementById("statusDot");
const statusLabel = document.getElementById("statusLabel");

function addLogEntry(role, message) {
  const li = document.createElement("li");
  li.className = `log-entry ${role}`;
  const time = document.createElement("span");
  time.className = "log-time";
  time.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const text = document.createElement("span");
  text.className = "log-message";
  text.textContent = message;
  li.append(time, text);
  logList.prepend(li);
}

function setStatus(state, label) {
  statusDot.className = `status-dot ${state}`;
  statusLabel.textContent = label;
}

async function checkHealth() {
  try {
    const res = await fetch(`${AGENT_URL}/health`);
    if (res.ok) setStatus("online", "connected");
    else throw new Error("bad status");
  } catch {
    setStatus("alert", "agent gateway unreachable — is it running?");
  }
}
checkHealth();

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1.02;
  orbButton.classList.add("speaking");
  utterance.onend = () => orbButton.classList.remove("speaking");
  window.speechSynthesis.speak(utterance);
}

async function sendMessage(message) {
  if (!message.trim()) return;
  addLogEntry("user", message);
  orbHint.textContent = "Guardian is checking…";

  try {
    const res = await fetch(`${AGENT_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId, message }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "request failed");
    addLogEntry("assistant", data.reply);
    speak(data.reply);
  } catch (err) {
    const failMsg = "I couldn't reach the household agent just now.";
    addLogEntry("assistant", failMsg);
    console.error(err);
  } finally {
    orbHint.textContent = "Tap to talk, or type below";
  }
}

typeForm.addEventListener("submit", (e) => {
  e.preventDefault();
  const value = typeInput.value;
  typeInput.value = "";
  sendMessage(value);
});

// --- Voice input (Web Speech API) -----------------------------------
// This is what lets the console act like a real Alexa+ device rather than
// a plain chat box — press the orb, speak, and Guardian both transcribes
// and answers out loud. Falls back gracefully to typing on browsers
// without SpeechRecognition support (e.g. Firefox).
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognizer = null;
let isListening = false;

if (SpeechRecognition) {
  recognizer = new SpeechRecognition();
  recognizer.lang = "en-US";
  recognizer.interimResults = false;
  recognizer.maxAlternatives = 1;

  recognizer.onstart = () => {
    isListening = true;
    orbButton.classList.add("listening");
    orbHint.textContent = "Listening…";
  };

  recognizer.onend = () => {
    isListening = false;
    orbButton.classList.remove("listening");
  };

  recognizer.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    sendMessage(transcript);
  };

  recognizer.onerror = () => {
    orbHint.textContent = "Didn't catch that — try typing instead";
  };

  orbButton.addEventListener("click", () => {
    if (isListening) {
      recognizer.stop();
    } else {
      recognizer.start();
    }
  });
} else {
  orbHint.textContent = "Voice input isn't supported in this browser — type below";
  orbButton.disabled = true;
}
