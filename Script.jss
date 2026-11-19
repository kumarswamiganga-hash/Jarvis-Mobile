
const chat = document.getElementById("chat");
const input = document.getElementById("msg");
const sendButton = document.getElementById("send");

function addMessage(message, type) {
    const element = document.createElement("div");

    element.className = "msg " + type;
    element.textContent = message;

    chat.appendChild(element);
    chat.scrollTop = chat.scrollHeight;

    return element;
}

function getJarvisReply(message) {
    const text = message.toLowerCase();

    if (text.includes("hello") || text.includes("hi")) {
        return "Hello, Sir. How can I help you today?";
    }

    if (text.includes("your name")) {
        return "I am J.A.R.V.I.S, your personal assistant interface, Sir.";
    }

    if (text.includes("how are you")) {
        return "All interface systems are functioning normally, Sir.";
    }

    if (text.includes("time")) {
        return "Your device time is " +
            new Date().toLocaleTimeString() + ", Sir.";
    }

    if (text.includes("date")) {
        return "Today's date is " +
            new Date().toLocaleDateString() + ", Sir.";
    }

    if (text.includes("status")) {
        return "The JARVIS mobile interface is online, Sir.";
    }

    return "I received your message, Sir. My current mobile demo mode has limited responses. A real AI connection is not configured yet.";
}

function sendMessage() {
    const message = input.value.trim();

    if (!message) {
        return;
    }

    addMessage("YOU: " + message, "user");

    input.value = "";
    sendButton.disabled = true;

    const thinkingMessage = addMessage(
        "J.A.R.V.I.S: Processing your request...",
        "ai"
    );

    setTimeout(function () {
        thinkingMessage.textContent =
            "J.A.R.V.I.S: " + getJarvisReply(message);

        chat.scrollTop = chat.scrollHeight;
        sendButton.disabled = false;
        input.focus();
    }, 700);
}

sendButton.addEventListener("click", sendMessage);

input.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
        sendMessage();
    }
});
