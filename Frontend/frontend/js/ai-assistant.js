/**
 * JobNex - Production AI Career Assistant Page Script
 * Fully integrated with FastAPI backend (/api/chat) & Google Gemini AI Studio
 */

document.addEventListener("DOMContentLoaded", async () => {
  // Load reusable navbar & footer
  if (typeof loadComponent === "function") {
    await loadComponent("navbar-container", "../components/navbar.html");
    await loadComponent("footer-container", "../components/footer.html");
    if (typeof initNav === "function") initNav("ai-assistant");
  }

  const messagesContainer = document.getElementById("chat-messages-container");
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const sendBtn = document.getElementById("chat-send-btn");
  const clearBtn = document.getElementById("clear-chat-btn");

  const user = window.JobNexAuth && typeof window.JobNexAuth.getUser === "function"
    ? window.JobNexAuth.getUser()
    : { name: "Candidate", id: "guest" };

  const SESSION_KEY = "jobnex_assistant_session_id";
  const CHAT_STORAGE_KEY = "jobnex_assistant_messages";

  // Session ID resolution
  function getSessionId() {
    let sid = localStorage.getItem(SESSION_KEY);
    if (!sid || sid.length < 8) {
      sid = "sess_" + Math.random().toString(36).substring(2, 12) + Date.now().toString(36);
      localStorage.setItem(SESSION_KEY, sid);
    }
    return sid;
  }

  let sessionId = getSessionId();

  // Retrieve stored analysis context if user previously analyzed resume
  function getLastAnalysis() {
    try {
      const stored = localStorage.getItem("jobnex_last_analysis");
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn("Could not parse stored analysis:", e);
    }
    return null;
  }

  const initialGreeting = {
    id: "msg-welcome",
    sender: "ASSISTANT",
    content: `Hello ${user.name ? user.name.split(" ")[0] : "there"}! 👋 I am **JobNex AI Career Agent**, powered by Google Gemini.\n\nI can help you search real jobs in our database, analyze skill gaps, explain requirements, suggest courses, and prepare for interviews. What role or skill are you targeting today?`,
    timestamp: "Just now",
    suggestedChips: [
      "Find Python Developer jobs",
      "How do I analyze my resume?",
      "Interview prep questions",
      "Courses for Docker & SQL",
    ],
    actionLinks: [
      { title: "Browse Jobs", url: "jobs.html", type: "JOB" },
      { title: "Interview Simulator", url: "interview-prep.html", type: "INTERVIEW" },
    ],
  };

  let chatMessages = [];
  try {
    const saved = localStorage.getItem(CHAT_STORAGE_KEY);
    if (saved) {
      chatMessages = JSON.parse(saved);
    }
  } catch (e) {
    chatMessages = [];
  }

  if (!chatMessages || chatMessages.length === 0) {
    chatMessages = [initialGreeting];
  }

  let isChatLoading = false;

  function saveMessages() {
    try {
      // Keep up to 30 messages locally
      const toSave = chatMessages.slice(-30);
      localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(toSave));
    } catch (e) {
      console.warn("Failed saving chat messages:", e);
    }
  }

  function renderMessages() {
    if (!messagesContainer) return;

    let html = "";
    chatMessages.forEach((msg) => {
      const isUser = msg.sender === "USER";
      html += `
        <div class="flex gap-3 ${isUser ? "justify-end" : "justify-start"}">
          ${!isUser ? `
            <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-700 via-brand-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5 border border-brand-400/30">
              <i data-lucide="bot" class="w-4 h-4"></i>
            </div>
          ` : ""}

          <div class="max-w-[85%] sm:max-w-xl space-y-2.5">
            <div class="p-4 rounded-xl text-xs sm:text-sm leading-relaxed ${
              isUser
                ? "bg-brand-600 text-white rounded-tr-none shadow-md font-medium"
                : "bg-white text-slate-800 rounded-tl-none border border-slate-200/90 shadow-sm"
            }">
              <div class="whitespace-pre-line font-normal space-y-1.5">${formatMarkdown(msg.content)}</div>

              ${msg.resources && msg.resources.length > 0 ? `
                <div class="pt-3 mt-3 border-t border-slate-100 space-y-2">
                  <span class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Recommended Learning:</span>
                  ${msg.resources.map(res => `
                    <div class="p-2.5 rounded-lg bg-slate-50 border border-slate-200/70 text-xs">
                      <p class="font-semibold text-slate-800 m-0">${escapeHtml(res.message || res.skill || "Skill Resources")}</p>
                      ${res.resources ? `
                        <div class="mt-1.5 flex flex-wrap gap-1.5">
                          ${res.resources.map(r => `
                            <a href="${escapeHtml(r.url)}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-brand-50 hover:bg-brand-100 text-brand-700 font-semibold text-[11px] transition-colors border border-brand-200">
                              <span>${escapeHtml(r.title)} (${escapeHtml(r.platform || 'Doc')})</span>
                              <i data-lucide="external-link" class="w-3 h-3"></i>
                            </a>
                          `).join("")}
                        </div>
                      ` : ""}
                    </div>
                  `).join("")}
                </div>
              ` : ""}

              ${msg.actionLinks && msg.actionLinks.length > 0 ? `
                <div class="pt-3 mt-3 border-t border-slate-100 flex flex-wrap gap-2">
                  ${msg.actionLinks.map(link => `
                    <a href="${escapeHtml(link.url)}" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold text-xs border border-brand-200 transition-colors">
                      <span>${escapeHtml(link.title)}</span>
                      <i data-lucide="arrow-right" class="w-3 h-3"></i>
                    </a>
                  `).join("")}
                </div>
              ` : ""}
            </div>

            ${!isUser && msg.suggestedChips && msg.suggestedChips.length > 0 ? `
              <div class="space-y-1.5">
                <span class="text-[10px] font-bold text-slate-600 uppercase tracking-wide">
                  Suggested Actions:
                </span>
                <div class="flex flex-wrap gap-1.5">
                  ${msg.suggestedChips.map(chip => `
                    <button type="button" class="chat-chip text-[11px] font-semibold px-3 py-1 rounded-full bg-white border border-slate-200 hover:border-brand-400 hover:text-brand-600 text-slate-700 shadow-sm transition-all hover:scale-[1.02] cursor-pointer" data-chip="${escapeHtml(chip)}">
                      ${escapeHtml(chip)}
                    </button>
                  `).join("")}
                </div>
              </div>
            ` : ""}
          </div>

          ${isUser ? `
            <div class="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
              <i data-lucide="user" class="w-4 h-4"></i>
            </div>
          ` : ""}
        </div>
      `;
    });

    if (isChatLoading) {
      html += `
        <div class="flex gap-3 justify-start items-center">
          <div class="w-8 h-8 rounded-xl bg-gradient-to-tr from-brand-700 via-brand-600 to-indigo-600 text-white flex items-center justify-center shrink-0 shadow-sm border border-brand-400/30 animate-pulse">
            <i data-lucide="bot" class="w-4 h-4"></i>
          </div>
          <div class="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-brand-600 animate-bounce"></span>
            <span class="w-2 h-2 rounded-full bg-brand-600 animate-bounce" style="animation-delay: 0.2s"></span>
            <span class="w-2 h-2 rounded-full bg-brand-600 animate-bounce" style="animation-delay: 0.4s"></span>
            <span class="text-xs text-slate-500 font-medium ml-2">JobNex Robo Agent is thinking...</span>
          </div>
        </div>
      `;
    }

    messagesContainer.innerHTML = html;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }

    // Attach listeners to chips
    document.querySelectorAll(".chat-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        const text = btn.getAttribute("data-chip");
        if (text) {
          sendUserMessage(text);
        }
      });
    });
  }

  function formatMarkdown(text) {
    if (!text) return "";
    let clean = escapeHtml(text);
    // Bold
    clean = clean.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
    // Italics
    clean = clean.replace(/\*(.*?)\*/g, "<em>$1</em>");
    // Bullet points
    clean = clean.replace(/^-\s+(.+)$/gm, "<div class='flex gap-1.5 items-start pl-2'><span class='text-brand-500'>•</span><span>$1</span></div>");
    return clean;
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  async function sendUserMessage(content) {
    const trimmed = content.trim();
    if (!trimmed || isChatLoading) return;

    chatMessages.push({
      id: `user-${Date.now()}`,
      sender: "USER",
      content: trimmed,
      timestamp: "Just now",
    });

    isChatLoading = true;
    if (chatInput) chatInput.value = "";
    if (sendBtn) sendBtn.disabled = true;
    renderMessages();

    const lastAnalysis = getLastAnalysis();
    const apiBase = window.location.port === "8000" ? "" : "http://127.0.0.1:8000";

    try {
      const response = await fetch(`${apiBase}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: trimmed,
          session_id: sessionId,
          analysis: lastAnalysis,
          use_ai: true,
          user_id: user ? (user.id || user.email || "guest") : "guest",
        }),
      });

      if (response.status === 429) {
        throw new Error("Rate limit reached. Please wait a few seconds before sending another message.");
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `Server error (${response.status})`);
      }

      const data = await response.json();
      sessionId = data.session_id || sessionId;
      localStorage.setItem(SESSION_KEY, sessionId);

      // Determine dynamic action links based on context
      const actionLinks = [];
      const lowerReply = (data.reply || "").toLowerCase();
      const lowerQuery = trimmed.toLowerCase();

      if (lowerQuery.includes("job") || lowerReply.includes("job") || lowerQuery.includes("role")) {
        actionLinks.push({ title: "View Matching Jobs", url: "jobs.html", type: "JOB" });
      }
      if (lowerQuery.includes("interview") || lowerReply.includes("interview")) {
        actionLinks.push({ title: "Open Interview Simulator", url: "interview-prep.html", type: "INTERVIEW" });
      }
      if (lowerQuery.includes("course") || lowerReply.includes("course") || (data.resources && data.resources.length > 0)) {
        actionLinks.push({ title: "View Learning Resources", url: "courses.html", type: "COURSE" });
      }

      chatMessages.push({
        id: `bot-${Date.now()}`,
        sender: "ASSISTANT",
        content: data.reply || "I am here to assist with your career goals.",
        timestamp: "Just now",
        suggestedChips: data.quick_replies && data.quick_replies.length > 0 ? data.quick_replies : [
          "Find Python jobs",
          "What are my missing skills?",
          "Practice interview questions",
        ],
        resources: data.resources || [],
        actionLinks: actionLinks.length > 0 ? actionLinks : undefined,
      });

      saveMessages();
    } catch (err) {
      console.error("AI Assistant API error:", err);
      chatMessages.push({
        id: `bot-err-${Date.now()}`,
        sender: "ASSISTANT",
        content: `⚠️ **Notice:** ${err.message || "Could not reach the assistant service."} Please check your connection or try again shortly.`,
        timestamp: "Just now",
        suggestedChips: [
          "Try again",
          "How do I analyze my resume?",
          "Explore Jobs",
        ],
      });
      saveMessages();
    } finally {
      isChatLoading = false;
      if (sendBtn) sendBtn.disabled = false;
      renderMessages();
      if (chatInput) chatInput.focus();
    }
  }

  // Handle Form Submit
  if (chatForm) {
    chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const val = chatInput ? chatInput.value : "";
      if (val) sendUserMessage(val);
    });
  }

  // Handle Reset / Clear
  if (clearBtn) {
    clearBtn.addEventListener("click", async () => {
      if (confirm("Reset conversation history?")) {
        try {
          const apiBase = window.location.port === "8000" ? "" : "http://127.0.0.1:8000";
          await fetch(`${apiBase}/api/chat/${sessionId}`, { method: "DELETE" }).catch(() => {});
        } catch (e) {
          // Best effort
        }
        localStorage.removeItem(SESSION_KEY);
        localStorage.removeItem(CHAT_STORAGE_KEY);
        sessionId = getSessionId();
        chatMessages = [initialGreeting];
        renderMessages();
      }
    });
  }

  // Initial render
  renderMessages();
});
