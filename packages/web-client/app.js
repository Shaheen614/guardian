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

// --- Spoken replies ------------------------------------------------------
// Browsers load their voice list asynchronously and Chrome silently cuts off
// long utterances after ~15 seconds, so: pick a good English voice once it
// is available, speak one sentence at a time, and let the user mute it.
const muteButton = document.getElementById("muteButton");
let voiceEnabled = true;
try {
  voiceEnabled = localStorage.getItem("guardianVoice") !== "off";
} catch {}

function renderMute() {
  muteButton.textContent = voiceEnabled ? "Voice on" : "Voice off";
  muteButton.setAttribute("aria-pressed", String(voiceEnabled));
}
renderMute();

muteButton.addEventListener("click", () => {
  voiceEnabled = !voiceEnabled;
  try {
    localStorage.setItem("guardianVoice", voiceEnabled ? "on" : "off");
  } catch {}
  if (!voiceEnabled && "speechSynthesis" in window) window.speechSynthesis.cancel();
  orbButton.classList.remove("speaking");
  renderMute();
});

function pickVoice() {
  const voices = window.speechSynthesis.getVoices().filter((v) => /^en/i.test(v.lang));
  const prefer = [/natural/i, /google us english/i, /aria|jenny|samantha|zira/i];
  for (const re of prefer) {
    const hit = voices.find((v) => re.test(v.name));
    if (hit) return hit;
  }
  return voices.find((v) => /^en-us/i.test(v.lang)) || voices[0] || null;
}

function speak(text) {
  if (!voiceEnabled || !("speechSynthesis" in window)) return;
  const synth = window.speechSynthesis;
  synth.cancel(); // never talk over a previous answer

  const sentences = text.match(/[^.!?]+[.!?]*/g)?.map((t) => t.trim()).filter(Boolean) ?? [text];
  const voice = pickVoice();
  orbButton.classList.add("speaking");

  sentences.forEach((sentence, i) => {
    const utterance = new SpeechSynthesisUtterance(sentence);
    if (voice) utterance.voice = voice;
    utterance.lang = voice?.lang ?? "en-US";
    utterance.rate = 1.0;
    const done = () => {
      if (i === sentences.length - 1) orbButton.classList.remove("speaking");
    };
    utterance.onend = done;
    utterance.onerror = done;
    synth.speak(utterance);
  });
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
