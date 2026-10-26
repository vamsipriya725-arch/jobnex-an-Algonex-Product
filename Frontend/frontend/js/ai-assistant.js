/**
 * JobNex - AI Assistant Page Script
 */

document.addEventListener("DOMContentLoaded", () => {
  const messagesContainer = document.getElementById("chat-messages-container");
  const chatForm = document.getElementById("chat-form");
  const chatInput = document.getElementById("chat-input");
  const sendBtn = document.getElementById("chat-send-btn");

  const user = window.JobNexAuth ? window.JobNexAuth.getUser() : { name: "Candidate" };

  let chatMessages = [
    {
      id: "msg-1",
      sender: "ASSISTANT",
      content: `Hello ${user.name.split(" ")[0]}! 👋 I am **JobNex AI Assistant**, your personal career copilot. How can I help you accelerate your job search today?`,
      timestamp: "Just now",
      suggestedChips: [
        "Best skills for Data Science?",
        "Interview tips for Google?",
        "Top companies hiring freshers?",
        "Analyze my skill gap",
      ],
      actionLinks: [
        { title: "Explore Tech Jobs", url: "jobs.html", type: "JOB" },
        { title: "Test Interview Prep", url: "interview-prep.html", type: "INTERVIEW" },
      ],
    },
  ];

  let isChatLoading = false;

  function renderMessages() {
    if (!messagesContainer) return;

    let html = "";
    chatMessages.forEach((msg) => {
      const isUser = msg.sender === "USER";
      html += `
        <div class="flex gap-3 ${isUser ? "justify-end" : "justify-start"}">
          ${!isUser ? `
            <div class="w-8 h-8 rounded-xl bg-brand-600 text-white flex items-center justify-center shrink-0 shadow-sm">
              <i data-lucide="bot" class="w-4 h-4"></i>
            </div>
          ` : ""}

          <div class="max-w-[85%] sm:max-w-lg space-y-3">
            <div class="p-4 rounded-lg text-xs sm:text-sm leading-relaxed ${
              isUser
                ? "bg-brand-600 text-white rounded-tr-none shadow-md"
                : "bg-white text-slate-800 rounded-tl-none border border-slate-200/80 shadow-sm"
            }">
              <div class="whitespace-pre-line font-normal">${formatMarkdown(msg.content)}</div>

              ${msg.actionLinks && msg.actionLinks.length > 0 ? `
                <div class="pt-3 mt-3 border-t border-slate-100 flex flex-wrap gap-2">
                  ${msg.actionLinks.map(link => `
                    <a href="${link.url}" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-50 hover:bg-brand-100 text-brand-700 font-bold text-xs border border-brand-200 transition-colors">
                      <span>${link.title}</span>
                      <i data-lucide="arrow-right" class="w-3 h-3"></i>
                    </a>
                  `).join("")}
                </div>
              ` : ""}
            </div>

            ${!isUser && msg.suggestedChips && msg.suggestedChips.length > 0 ? `
              <div class="space-y-1.5">
                <span class="text-[10px] font-bold text-slate-700 uppercase tracking-wide">
                  Suggested Follow-ups:
                </span>
                <div class="flex flex-wrap gap-1.5">
                  ${msg.suggestedChips.map(chip => `
                    <button type="button" class="chat-chip text-[11px] font-semibold px-3 py-1 rounded-full bg-white border border-slate-200 hover:border-brand-400 hover:text-brand-600 text-slate-700 shadow-sm transition-all hover:scale-[1.02] cursor-pointer" data-chip="${escapeHtml(chip)}">
                      ${chip}
                    </button>
                  `).join("")}
                </div>
              </div>
            ` : ""}
          </div>

          ${isUser ? `
            <div class="w-8 h-8 rounded-xl bg-slate-800 text-white flex items-center justify-center shrink-0 shadow-sm">
              <i data-lucide="user" class="w-4 h-4"></i>
            </div>
          ` : ""}
        </div>
      `;
    });

    if (isChatLoading) {
      html += `
        <div class="flex gap-3 justify-start items-center">
          <div class="w-8 h-8 rounded-xl bg-brand-600 text-white flex items-center justify-center shrink-0">
            <i data-lucide="bot" class="w-4 h-4"></i>
          </div>
          <div class="bg-white p-3.5 rounded-lg border border-slate-200 shadow-sm flex items-center gap-1.5">
            <span class="w-2 h-2 rounded-full bg-brand-600 animate-bounce"></span>
            <span class="w-2 h-2 rounded-full bg-brand-600 animate-bounce" style="animation-delay: 0.2s"></span>
            <span class="w-2 h-2 rounded-full bg-brand-600 animate-bounce" style="animation-delay: 0.4s"></span>
          </div>
        </div>
      `;
    }

    messagesContainer.innerHTML = html;
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    if (window.lucide) {
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
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>");
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function sendUserMessage(content) {
    if (!content.trim() || isChatLoading) return;

    chatMessages.push({
      id: `user-${Date.now()}`,
      sender: "USER",
      content: content.trim(),
      timestamp: "Just now",
    });

    isChatLoading = true;
    renderMessages();
    if (chatInput) chatInput.value = "";

    // Generate response
    setTimeout(() => {
      generateBotReply(content.trim());
    }, 800);
  }

  function generateBotReply(prompt) {
    const lower = prompt.toLowerCase();
    let botReply = "Here is what I found for your career goals!";
    let actionLinks = undefined;

    if (lower.includes("data science") || lower.includes("skills")) {
      botReply =
        "For **Data Science & ML**, the most in-demand industry skills are **Python**, **SQL**, **Data Visualization (Seaborn/Plotly)**, and **Machine Learning pipelines (Scikit-Learn/PyTorch)**. Based on your skill gap analysis, leveling up on Data Visualization will boost your profile match by +18%!";
      actionLinks = [
        { title: "View Skill Gap Diagnostic", url: "skill-gap.html", type: "SKILL" },
        { title: "Data Scientist at Amazon", url: "jobs.html", type: "JOB" },
      ];
    } else if (
      lower.includes("interview") ||
      lower.includes("tips") ||
      lower.includes("google")
    ) {
      botReply =
        "For top tier companies like **Google**, focus on **System Design** and **Algorithmic efficiency (Time/Space complexity)**. Would you like to practice our interactive 5-question interview simulator right now?";
      actionLinks = [
        {
          title: "Start Technical Interview Prep",
          url: "interview-prep.html",
          type: "INTERVIEW",
        },
      ];
    } else if (lower.includes("fresher") || lower.includes("companies")) {
      botReply =
        "Currently, companies like **Accenture**, **TCS**, and **RemoteBase** have open roles for freshers and 1-2 year candidates with strong React and SQL knowledge.";
      actionLinks = [
        { title: "View Filtered Jobs", url: "jobs.html", type: "JOB" },
        { title: "Setup Auto-Apply", url: "auto-apply.html", type: "JOB" },
      ];
    } else {
      botReply = `Great question regarding "${prompt}"! With JobNex, you can analyze your skill gaps, practice tailored interview questions, or dispatch automated cold outreach emails to hiring managers.`;
      actionLinks = [
        { title: "Find Matching Jobs", url: "jobs.html", type: "JOB" },
        {
          title: "Launch Interview Simulator",
          url: "interview-prep.html",
          type: "INTERVIEW",
        },
      ];
    }

    chatMessages.push({
      id: `bot-${Date.now()}`,
      sender: "ASSISTANT",
      content: botReply,
      timestamp: "Just now",
      suggestedChips: [
        "Explain REST APIs",
        "Recommended Coursera Courses",
        "How to negotiate salary?",
      ],
      actionLinks,
    });

    isChatLoading = false;
    renderMessages();
  }

  if (chatForm) {
    chatForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const val = chatInput.value;
      if (val) sendUserMessage(val);
    });
  }

  // Initial render
  renderMessages();
});
