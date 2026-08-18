const messageForm = document.getElementById("messageForm");
const messageInput = document.getElementById("messageInput");
const messages = document.getElementById("messages");
const newChatBtn = document.getElementById("newChatBtn");
const mobileMenu = document.getElementById("mobileMenu");
const sidebar = document.querySelector(".sidebar");

/* =========================
   SEND MESSAGE
========================= */

messageForm.addEventListener("submit", function (event) {
  event.preventDefault();

  const message = messageInput.value.trim();

  if (!message) return;

  // Remove welcome screen
  const welcome = document.querySelector(".welcome");

  if (welcome) {
    welcome.remove();
  }

  // Create user message
  const userMessage = document.createElement("div");

  userMessage.className = "message user-message";

  userMessage.innerHTML = `
        <div class="message-content">
            ${escapeHTML(message)}
        </div>
    `;

  messages.appendChild(userMessage);

  // Clear input
  messageInput.value = "";

  // Scroll down
  messages.scrollTop = messages.scrollHeight;

  // Temporary AI response
  setTimeout(() => {
    const aiMessage = document.createElement("div");

    aiMessage.className = "message ai-message";

    aiMessage.innerHTML = `
            <div class="message-avatar">G</div>

            <div class="message-content">
                I'm GeeAI 👋🏽

                <br><br>

                I'm not connected to an AI model yet,
                but that's coming next. 🚀
            </div>
        `;

    messages.appendChild(aiMessage);

    messages.scrollTop = messages.scrollHeight;
  }, 700);
});

/* =========================
   ENTER TO SEND
========================= */

messageInput.addEventListener("keydown", function (event) {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();

    messageForm.dispatchEvent(new Event("submit"));
  }
});

/* =========================
   AUTO RESIZE TEXTAREA
========================= */

messageInput.addEventListener("input", function () {
  this.style.height = "auto";

  this.style.height = this.scrollHeight + "px";
});

/* =========================
   NEW CHAT
========================= */

newChatBtn.addEventListener("click", function () {
  messages.innerHTML = `
        <div class="welcome">

            <div class="welcome-icon">
                G
            </div>

            <h1>How can I help you?</h1>

            <p>
                Ask GeeAI anything. Code, networking,
                design, ideas and more.
            </p>

        </div>
    `;

  messageInput.value = "";
  messageInput.style.height = "auto";
});

/* =========================
   MOBILE SIDEBAR
========================= */

mobileMenu.addEventListener("click", function () {
  sidebar.classList.toggle("open");
});

/* =========================
   SECURITY
========================= */

function escapeHTML(text) {
  const div = document.createElement("div");

  div.textContent = text;

  return div.innerHTML;
}
