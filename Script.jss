
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

function setStatus(message) {
    if (assistantStatus) assistantStatus.textContent = message.toUpperCase();
}

function addMessage(message, sender) {
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

    conversationMemory.push({
        role: sender === "user" ? "user" : "assistant",
        content: message
    });

    conversationMemory = conversationMemory.slice(-30);
    saveLocalMemory();

    syncCloudMemory();
}

function buildGeminiContext() {
    return conversationMemory.slice(-20).map(item => ({
        role: item.role,
        content: item.content
    }));
}

async function sendMessage(message) {
    if (!message.trim() || isBusy) return;

    isBusy = true;
    userInput.value = "";
    sendButton.disabled = true;

    addMessage(message, "user");
    setStatus("Thinking");

    try {
        const response = await fetch(`${API_BASE}/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                message: message,
                history: buildGeminiContext(),
                memoryId: localStorage.getItem(CLOUD_MEMORY_KEY)
            })
        });

        const data = await response.json();

        if (!response.ok || data.success === false) {
            throw new Error(data.error || "AI service is unavailable.");
        }

        const reply = data.reply || data.response || data.message;

        if (!reply) {
            throw new Error("JARVIS returned an empty response.");
        }

        addMessage(reply, "assistant");
        setStatus("Response ready");

        speakMessage(reply);

    } catch (error) {
        console.error("JARVIS error:", error);
        addMessage(
            "I'm sorry, Sir. I could not connect to my AI brain. Please check the Cloudflare Worker.",
            "assistant"
        );
        setStatus("Connection problem");
    } finally {
        isBusy = false;
        sendButton.disabled = false;
        userInput.focus();
    }
}

chatForm.addEventListener("submit", function(event) {
    event.preventDefault();
    sendMessage(userInput.value);
});

async function speakMessage(message) {
    try {
        setStatus("Speaking");

        const response = await fetch(`${API_BASE}/speak`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                text: message
            })
        });

        if (!response.ok) {
            throw new Error("ElevenLabs voice service unavailable.");
        }

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);

        audio.onended = function() {
            URL.revokeObjectURL(audioUrl);
            setStatus("Awaiting your command");
        };

        audio.onerror = function() {
            URL.revokeObjectURL(audioUrl);
            setStatus("Voice playback problem");
        };

        await audio.play();

    } catch (error) {
        console.error("Voice error:", error);
        setStatus("Voice unavailable");
    }
}

function setupSpeechRecognition() {
    const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        micButton.disabled = true;
        micButton.title = "Speech recognition is not supported in this browser.";
        return;
    }

    recognition = new SpeechRecognition();
    recognition.lang = VOICE_LANGUAGE;
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = function() {
        isListening = true;
        micButton.classList.add("listening");
        setStatus("Listening");
    };

    recognition.onresult = function(event) {
        const transcript = event.results[0][0].transcript;
        userInput.value = transcript;
        sendMessage(transcript);
    };

    recognition.onerror = function(event) {
        console.error("Microphone error:", event.error);
        setStatus("Microphone problem");
    };

    recognition.onend = function() {
        isListening = false;
        micButton.classList.remove("listening");

        if (!isBusy) {
            setStatus("Awaiting your command");
        }
    };
}

micButton.addEventListener("click", function() {
    if (!recognition) {
        alert("Speech recognition is not supported. Please use Chrome.");
        return;
    }

    if (isListening) {
        recognition.stop();
    } else {
        try {
            recognition.start();
        } catch (error) {
            console.error(error);
        }
    }
});

async function syncCloudMemory() {
    const memoryId = localStorage.getItem(CLOUD_MEMORY_KEY);

    try {
        const response = await fetch(`${API_BASE}/memory`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                action: "save",
                memoryId: memoryId,
                history: conversationMemory.slice(-30)
            })
        });

        const data = await response.json();

        if (data.success && data.memoryId) {
            localStorage.setItem(CLOUD_MEMORY_KEY, data.memoryId);
        }
    } catch (error) {
        console.warn("Cloud memory sync unavailable:", error);
    }
}

async function loadCloudMemory() {
    const memoryId = localStorage.getItem(CLOUD_MEMORY_KEY);

    if (!memoryId) return;

    try {
        const response = await fetch(`${API_BASE}/memory`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                action: "load",
                memoryId: memoryId
            })
        });

        const data = await response.json();

        if (data.success && Array.isArray(data.history) && data.history.length) {
            conversationMemory = data.history.slice(-30);
            saveLocalMemory();
        }
    } catch (error) {
        console.warn("Could not load cloud memory:", error);
    }
}

function restoreChat() {
    chatMessages.innerHTML = "";

    conversationMemory.slice(-20).forEach(item => {
        const sender = item.role === "user" ? "user" : "assistant";
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
        paragraph.textContent = item.content;

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
    });

    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function initializeJarvis() {
    setupSpeechRecognition();

    try {
        const response = await fetch(`${API_BASE}/health`);
        const data = await response.json();

        if (data.success) {
            statusIndicator.textContent = "SYSTEM ONLINE";
        } else {
            statusIndicator.textContent = "CHECK CONNECTION";
        }
    } catch (error) {
        statusIndicator.textContent = "OFFLINE";
    }

    await loadCloudMemory();
    restoreChat();

    setStatus("Awaiting your command");
}

initializeJarvis();
