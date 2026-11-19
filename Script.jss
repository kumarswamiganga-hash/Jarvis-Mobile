
const chat = document.getElementById("chat");
const input = document.getElementById("msg");
const send = document.getElementById("send");

function addMessage(text, who) {
    const message = document.createElement("div");

    message.className = "msg " + who;
    message.innerText = text;

    chat.appendChild(message);
    chat.scrollTop = chat.scrollHeight;

    return message;
}

function sendMessage() {
    const text = input.value.trim();

    if (!text) return;

    addMessage("YOU: " + text, "user");

    input.value = "";
    send.disabled = true;

    const processing = addMessage(
        "J.A.R.V.I.S: Processing...",
        "ai"
    );

    setTimeout(() => {
        processing.innerText =
            "J.A.R.V.I.S: Systems online. How may I assist you, Sir?";

        send.disabled = false;
        input.focus();

    }, 1000);
}

send.addEventListener("click", sendMessage);

input.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        sendMessage();
    }
});
