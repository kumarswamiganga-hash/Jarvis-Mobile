const API_BASE = "https://jarvis-ai-brain.kumarswamiganga.workers.dev";
const VOICE_LANGUAGE = "en-IN";
const MEMORY_KEY = "JARVIS_CONVERSATION_MEMORY";
const CLOUD_MEMORY_KEY = "JARVIS_CLOUD_MEMORY_ID";

const chatForm = document.getElementById("chat-form");
const userInput = document.getElementById("user-input");
const chatMessages = document.getElementById("chat-messages");
const micButton = document.getElementById("mic-button");
const sendButton = document.getElementById("send-button");
const statusIndicator = document.getElementById("status-indicator");
const assistantStatus = document.getElementById("assistant-status");
const arcReactor = document.getElementById("arc-reactor");
const clearMemoryBtn = document.getElementById("clear-memory-btn");

let conversationMemory = loadLocalMemory();
let recognition = null;
let isListening = false;
let isBusy = false;

function loadLocalMemory() {
  try {
    const saved = JSON.parse(localStorage.getItem(MEMORY_KEY) || "[]");
    return Array.isArray(saved) ? saved.slice(-30) : [];
  } catch {
    return [];
  }
}

function saveLocalMemory() {
  localStorage.setItem(MEMORY_KEY, JSON.stringify(conversationMemory.slice(-30)));
}

function setStatus(message, mode = "idle") {
  if (assistantStatus) assistantStatus.textContent = message.toUpperCase();
  if (arcReactor) {
    arcReactor.classList.remove("listening", "thinking", "speaking");
    if (mode !== "idle") arcReactor.classList.add(mode);
  }
}

function renderBubble(message, sender) {
  const row = document.createElement("div");
  row.className = `message ${sender === "user" ? "user-message" : "assistant-message"}`;

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = sender === "user" ? "S" : "J";

  const content = document.createElement("div");
  content.className = "message-content";

  const name = document.createElement("span");
  name.className = "message-name";
  name.textContent = sender === "user" ? "SIR" : "JARVIS";

  const paragraph = document.createElement("p");
  paragraph.textContent = message;

  content.appendChild(name);
  content.appendChild(paragraph);

  if (sender === "user") {
    row.appendChild(content);
    row.appendChild(avatar);
  } else {
    row.appendChild(avatar);
    row.appendChild(content);
  }

  chatMessages.appendChild(row);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addMessage(message, sender) {
  renderBubble(message, sender);
  conversationMemory.push({
    role: sender === "user" ? "user" : "assistant",
    content: message,
  });
  conversationMemory = conversationMemory.slice(-30);
  saveLocalMemory();
  syncCloudMemory();
}

function buildGeminiContext() {
  return conversationMemory.slice(-20).map((item) => ({
    role: item.role,
    content: item.content,
  }));
}

async function sendMessage(message) {
  if (!message.trim() || isBusy) return;

  isBusy = true;
  userInput.value = "";
  sendButton.disabled = true;

  addMessage(message, "user");
  setStatus("Processing command...", "thinking");

  try {
    const response = await fetch(`${API_BASE}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message,
        history: buildGeminiContext(),
        memoryId: localStorage.getItem(CLOUD_MEMORY_KEY),
      }),
    });

    const data = await response.json();
    if (!response.ok || data.success === false) {
      throw new Error(data.error || "AI service unavailable.");
    }

    const reply = data.reply || data.response || data.message;
    if (!reply) throw new Error("Empty response from JARVIS.");

    addMessage(reply, "assistant");
    await speakMessage(reply);
  } catch (error) {
    console.error("JARVIS error:", error);
    addMessage(
      "I'm sorry, Sir. I encountered a link disruption with my AI core.",
      "assistant"
    );
    setStatus("Connection problem", "idle");
  } finally {
    isBusy = false;
    sendButton.disabled = false;
    userInput.focus();
  }
}

chatForm.addEventListener("submit", (event) => {
  event.preventDefault();
  sendMessage(userInput.value);
});

async function speakMessage(message) {
  try {
    setStatus("Speaking", "speaking");
    const response = await fetch(`${API_BASE}/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message }),
    });

    if (!response.ok) throw new Error("ElevenLabs unavailable");

    const audioBlob = await response.blob();
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);

    audio.onended = () => {
      URL.revokeObjectURL(audioUrl);
      setStatus("Awaiting your command", "idle");
    };
    audio.onerror = () => {
      URL.revokeObjectURL(audioUrl);
      setStatus("Awaiting your command", "idle");
    };

    await audio.play();
  } catch (error) {
    console.warn("ElevenLabs fallback to browser TTS:", error);
    if ("speechSynthesis" in window) {
      const utter = new SpeechSynthesisUtterance(message);
      utter.rate = 1.02;
      utter.pitch = 0.95;
      utter.onend = () => setStatus("Awaiting your command", "idle");
      window.speechSynthesis.speak(utter);
    } else {
      setStatus("Awaiting your command", "idle");
    }
  }
}

function setupSpeechRecognition() {
  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    micButton.disabled = true;
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = VOICE_LANGUAGE;
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onstart = () => {
    isListening = true;
    micButton.classList.add("listening");
    setStatus("Listening...", "listening");
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    userInput.value = transcript;
    sendMessage(transcript);
  };

  recognition.onerror = () => {
    setStatus("Microphone error", "idle");
  };

  recognition.onend = () => {
    isListening = false;
    micButton.classList.remove("listening");
    if (!isBusy) setStatus("Awaiting your command", "idle");
  };
}

micButton.addEventListener("click", () => {
  if (!recognition) {
    alert("Voice recognition requires Chrome or Edge.");
    return;
  }
  if (isListening) {
    recognition.stop();
  } else {
    try {
      recognition.start();
    } catch (e) {
      console.error(e);
    }
  }
});

async function syncCloudMemory() {
  const memoryId = localStorage.getItem(CLOUD_MEMORY_KEY);
  try {
    const response = await fetch(`${API_BASE}/memory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "save",
        memoryId,
        history: conversationMemory.slice(-30),
      }),
    });
    const data = await response.json();
    if (data.success && data.memoryId) {
      localStorage.setItem(CLOUD_MEMORY_KEY, data.memoryId);
    }
  } catch (e) {
    console.warn("Memory sync skipped:", e);
  }
}

async function loadCloudMemory() {
  const memoryId = localStorage.getItem(CLOUD_MEMORY_KEY);
  if (!memoryId) return;
  try {
    const response = await fetch(`${API_BASE}/memory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "load", memoryId }),
    });
    const data = await response.json();
    if (data.success && Array.isArray(data.history) && data.history.length) {
      conversationMemory = data.history.slice(-30);
      saveLocalMemory();
    }
  } catch (e) {
    console.warn("Cloud memory load skipped:", e);
  }
}

function restoreChat() {
  if (!conversationMemory.length) return;
  chatMessages.innerHTML = "";
  conversationMemory.slice(-20).forEach((item) => {
    renderBubble(item.content, item.role === "user" ? "user" : "assistant");
  });
}

clearMemoryBtn.addEventListener("click", () => {
  localStorage.removeItem(MEMORY_KEY);
  localStorage.removeItem(CLOUD_MEMORY_KEY);
  conversationMemory = [];
  chatMessages.innerHTML = "";
  renderBubble("Memory banks purged, Sir. Ready for new directives.", "assistant");
});

async function initializeJarvis() {
  setupSpeechRecognition();
  try {
    const res = await fetch(`${API_BASE}/health`);
    const data = await res.json();
    statusIndicator.textContent = data.success ? "SYSTEM ONLINE" : "CHECK WORKER";
  } catch {
    statusIndicator.textContent = "OFFLINE";
  }

  await loadCloudMemory();
  restoreChat();
  setStatus("Awaiting your command", "idle");
}

initializeJarvis();
