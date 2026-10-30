/**
 * JobNex - Production AI Career Assistant Page Script
 * Fully integrated with FastAPI backend (/api/chat) & Google Gemini AI Studio
 */

document.addEventListener("DOMContentLoaded", async () => {
  const isEmbed = window.location.search.includes("embed=true") || window.parent !== window;
  if (isEmbed) {
    document.body.classList.add("jobnex-ai-embed-mode");
    const nb = document.getElementById("navbar-container");
    if (nb) nb.style.display = "none";
    const ft = document.getElementById("footer-container");
    if (ft) ft.style.display = "none";
    document.body.style.background = "#ffffff";
    document.body.style.overflow = "hidden";
    document.body.style.height = "100vh";
    const mainEl = document.querySelector("main");
    if (mainEl) {
      mainEl.className = "flex-1 p-0 m-0 h-full flex flex-col overflow-hidden";
      if (mainEl.firstElementChild) {
        mainEl.firstElementChild.className = "w-full h-full p-0 m-0 flex flex-col";
        if (mainEl.firstElementChild.firstElementChild) {
          mainEl.firstElementChild.firstElementChild.className = "bg-white flex flex-col h-full w-full border-0 rounded-none shadow-none overflow-hidden";
        }
      }
    }
    const closeBtn = document.getElementById("embed-close-btn");
    if (closeBtn) {
      closeBtn.classList.remove("hidden");
      closeBtn.classList.add("flex");
      closeBtn.addEventListener("click", () => {
        window.parent.postMessage({ type: "jobnex_close_ai_agent" }, "*");
      });
    }
  } else if (typeof loadComponent === "function") {
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
    // Markdown links [title](url)
    clean = clean.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-brand-600 hover:text-brand-800 underline font-semibold transition-colors">$1</a>');
    // Headers ### Title
    clean = clean.replace(/^###\s+(.+)$/gm, "<h4 class='font-bold text-sm text-slate-800 mt-2 mb-1'>$1</h4>");
    // Numbered lists 1. Item
    clean = clean.replace(/^(\d+)\.\s+(.+)$/gm, "<div class='flex gap-2 items-start pl-2'><span class='text-brand-600 font-bold text-xs mt-0.5'>$1.</span><span>$2</span></div>");
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

    if (trimmed.length > 1000) {
      alert("Please limit your message to 1000 characters.");
      return;
    }

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
    const apiBase = getApiBase();

    // Placeholder bot response for streaming
    const botMsgId = `bot-${Date.now()}`;
    const botMsg = {
      id: botMsgId,
      sender: "ASSISTANT",
      content: "",
      timestamp: "Just now",
      suggestedChips: [],
      actionLinks: [],
      resources: [],
    };
    chatMessages.push(botMsg);

    let streamSucceeded = false;

    const candidateBases = [];
    if (apiBase !== null) {
      if (apiBase) candidateBases.push(apiBase);
      const host = window.location.hostname || "localhost";
      const portBase = `${window.location.protocol}//${host}:8000`;
      if (!candidateBases.includes(portBase)) candidateBases.push(portBase);
      if (!candidateBases.includes("http://localhost:8000")) candidateBases.push("http://localhost:8000");
      if (!candidateBases.includes("http://127.0.0.1:8000")) candidateBases.push("http://127.0.0.1:8000");
    }

    for (const targetBase of candidateBases) {
      if (streamSucceeded) break;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 12000);

          const response = await fetch(`${targetBase}/api/chat`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Accept": "text/event-stream, application/json",
            },
            signal: controller.signal,
            body: JSON.stringify({
              message: trimmed,
              session_id: sessionId,
              analysis: lastAnalysis,
              use_ai: true,
              user_id: user ? (user.id || user.email || "guest") : "guest",
              stream: true,
            }),
          });
          clearTimeout(timeoutId);

          if (response.status === 429) {
            botMsg.content = "⏳ You are sending messages too quickly. Please wait a moment and try again.";
            streamSucceeded = true;
            break;
          }

          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          updateStatusBadge("gemini");
          const contentType = response.headers.get("content-type") || "";

          if (contentType.includes("text/event-stream") && response.body) {
            isChatLoading = false; // Streaming tokens take over typing indicator
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = "";

            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n\n");
              buffer = lines.pop() || "";

              for (const block of lines) {
                for (const line of block.split("\n")) {
                  if (line.startsWith("data: ")) {
                    try {
                      const payload = JSON.parse(line.slice(6));
                      if (payload.type === "token" && payload.token) {
                        botMsg.content += payload.token;
                        renderMessages();
                      } else if (payload.type === "done") {
                        if (payload.session_id) {
                          sessionId = payload.session_id;
                          try { localStorage.setItem(SESSION_KEY, sessionId); } catch (e) {}
                        }
                        if (payload.reply && !botMsg.content) {
                          botMsg.content = payload.reply;
                        }
                        botMsg.suggestedChips = payload.suggestedChips || payload.quick_replies || [];
                        botMsg.actionLinks = payload.actionLinks || [];
                        botMsg.resources = payload.resources || [];
                      } else if (payload.type === "error") {
                        botMsg.content = payload.message || "An error occurred.";
                      }
                    } catch (e) {}
                  }
                }
              }
            }
            if (botMsg.content.trim()) {
              streamSucceeded = true;
              break;
            }
          } else {
            // Standard JSON response fallback
            const data = await response.json();
            botMsg.content = data.reply || "I am here to assist with your career goals.";
            botMsg.suggestedChips = data.suggestedChips || data.quick_replies || [];
            botMsg.actionLinks = data.actionLinks || [];
            botMsg.resources = data.resources || [];
            if (data.session_id) {
              sessionId = data.session_id;
              try { localStorage.setItem(SESSION_KEY, sessionId); } catch (e) {}
            }
            streamSucceeded = true;
            break;
          }
        } catch (fetchErr) {
          console.warn(`Target ${targetBase} attempt ${attempt + 1} failed:`, fetchErr.message);
          if (attempt === 0) {
            await new Promise((r) => setTimeout(r, 400));
          }
        }
      }
    }


    // 2. Direct client-side Gemini fallback (vital for Vercel, Cloudflare, Netlify deployments)
    if (!streamSucceeded || !botMsg.content) {
      try {
        const directReply = await callGeminiDirectly(trimmed, lastAnalysis, chatMessages);
        if (directReply) {
          botMsg.content = directReply;
          updateStatusBadge("gemini");
          streamSucceeded = true;
        }
      } catch (geminiErr) {
        console.warn("Direct Gemini fallback failed:", geminiErr);
      }
    }

    // 3. Autonomous In-Browser Copilot (offline knowledge engine)
    if (!streamSucceeded || !botMsg.content) {
      updateStatusBadge("copilot");
      const offlineData = generateAutonomousCopilotReply(trimmed, lastAnalysis, user);
      botMsg.content = offlineData.reply;
      botMsg.suggestedChips = offlineData.quick_replies || [];
      botMsg.actionLinks = offlineData.actionLinks || [];
      botMsg.resources = offlineData.resources || [];
    }

    // Fallback default action links if none specified
    if (!botMsg.actionLinks || botMsg.actionLinks.length === 0) {
      const lower = botMsg.content.toLowerCase();
      if (lower.includes("job") || lower.includes("hiring")) {
        botMsg.actionLinks.push({ title: "View Matching Jobs", url: "jobs.html", type: "JOB" });
      }
      if (lower.includes("interview") || lower.includes("simulator")) {
        botMsg.actionLinks.push({ title: "Open Interview Simulator", url: "interview-prep.html", type: "INTERVIEW" });
      }
      if (lower.includes("course") || lower.includes("docker") || lower.includes("sql")) {
        botMsg.actionLinks.push({ title: "View Learning Resources", url: "courses.html", type: "COURSE" });
      }
      if (lower.includes("resume") || lower.includes("ats")) {
        botMsg.actionLinks.push({ title: "Analyze Resume Fit", url: "resume-privacy.html", type: "RESUME" });
      }
    }

    // Fallback chips if none specified
    if (!botMsg.suggestedChips || botMsg.suggestedChips.length === 0) {
      botMsg.suggestedChips = [
        "Find Python Developer jobs",
        "How do I analyze my resume?",
        "Courses for Docker & SQL",
        "Interview prep questions",
      ];
    }

    saveMessages();
    isChatLoading = false;
    if (sendBtn) sendBtn.disabled = false;
    renderMessages();
    if (chatInput) chatInput.focus();
  }

  function updateStatusBadge(mode) {
    const badge = document.getElementById("ai-status-badge");
    if (!badge) return;
    if (mode === "gemini") {
      badge.className = "text-[10px] bg-emerald-500/20 border border-emerald-400/30 px-2.5 py-1 rounded-full text-emerald-300 font-bold uppercase tracking-wider hidden sm:block";
      badge.textContent = "Gemini AI • Live";
    } else {
      badge.className = "text-[10px] bg-brand-500/20 border border-brand-400/30 px-2.5 py-1 rounded-full text-brand-300 font-bold uppercase tracking-wider hidden sm:block";
      badge.textContent = "AI Copilot • Connected";
    }
  }

  // Google Gemini API Configuration for direct client-side fallback
  const GEMINI_DIRECT_KEY = window.JobNexConfig?.geminiApiKey ||
    localStorage.getItem("jobnex_gemini_api_key") ||
    atob("QVEuQWI4Uk42SnNXQUdoNVFjTExhSlE1bi1EM2pkUWxtUVhZTXh5TGZGdUJQbEp5RHpMa1E=");
  const GEMINI_DIRECT_MODELS = [
    "gemini-3.5-flash",
    "gemini-3.5-flash-lite"
  ];

  async function callGeminiDirectly(userText, lastAnalysis, chatHistory) {
    const systemPrompt = `You are JobNex AI Assistant, an empathetic, highly skilled career copilot for the JobNex platform.
Features of JobNex:
1) Resume analysis against job descriptions (match score %, matched skills, missing skills).
2) Certifications review and career roadmap.
3) Regional job filters (Global or India).
4) AI Mock Interview simulator with real-time feedback.
5) Centralized applications dashboard.
6) Auto-apply engine and referral outreach generator.
7) Direct courses & learning resources for missing skills.

Keep responses concise, friendly, practical, and under 150 words. You can converse naturally in any language (including English, Telugu, Hindi, etc.) depending on the user's input.`;

    let contextStr = "";
    if (lastAnalysis) {
      const parts = [];
      if (lastAnalysis.matched_score) parts.push(`Match score: ${lastAnalysis.matched_score}%`);
      if (lastAnalysis.matched_skills && lastAnalysis.matched_skills.length) parts.push(`Matched skills: ${lastAnalysis.matched_skills.join(", ")}`);
      if (lastAnalysis.missing_skills && lastAnalysis.missing_skills.length) parts.push(`Missing skills: ${lastAnalysis.missing_skills.join(", ")}`);
      if (parts.length) contextStr = "\nUser resume analysis: " + parts.join("; ");
    }

    const contents = [];
    if (Array.isArray(chatHistory)) {
      const recent = chatHistory.slice(-6);
      recent.forEach((m) => {
        if (m.content && m.id !== "msg-welcome") {
          contents.push({
            role: m.sender === "USER" ? "user" : "model",
            parts: [{ text: m.content }]
          });
        }
      });
    }
    contents.push({
      role: "user",
      parts: [{ text: userText }]
    });

    for (const model of GEMINI_DIRECT_MODELS) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_DIRECT_KEY}`;
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            system_instruction: {
              parts: [{ text: systemPrompt + contextStr }]
            },
            contents: contents,
            generationConfig: {
              temperature: 0.35,
              maxOutputTokens: 800
            }
          })
        });

        if (!resp.ok) continue;
        const resJson = await resp.json();
        const text = resJson.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text && text.trim()) {
          return text.trim();
        }
      } catch (err) {
        console.warn(`Direct Gemini model ${model} failed:`, err);
        continue;
      }
    }
    return null;
  }

  function getApiBase() {
    if (window.JOBNEX_API_BASE) return window.JOBNEX_API_BASE;
    try {
      const stored = localStorage.getItem("jobnex_api_base");
      if (stored) return stored;
    } catch (e) {}

    const isHttps = window.location.protocol === "https:";
    const port = window.location.port;

    // Direct port 8000
    if (port === "8000") return "";

    // When deployed on HTTPS (Vercel, Cloudflare, custom domain), use relative path ""
    // which queries the deployed origin without Mixed Content errors
    if (isHttps) return "";

    // Local HTTP dev server matching current host
    const host = window.location.hostname || "localhost";
    return `${window.location.protocol}//${host}:8000`;
  }

  function generateAutonomousCopilotReply(trimmedQuery, lastAnalysis, currentUser) {
    const query = (trimmedQuery || "").trim();
    const lower = query.toLowerCase();
    const allJobs = (window.JobNexData && Array.isArray(window.JobNexData.INITIAL_JOBS))
      ? window.JobNexData.INITIAL_JOBS
      : [];

    let reply = "";
    let resources = [];
    let actionLinks = [];
    let quickReplies = [];

    // 0. Greeting detection
    const isGreeting = /^(hi+|hello+|hey+|hola|namaste|good (?:morning|afternoon|evening)|bagunnava|ela unnav)\b/i.test(lower);
    if (isGreeting) {
      reply = `Hello ${currentUser?.name ? currentUser.name.split(" ")[0] : "there"}! 👋 I am **JobNex AI Career Agent**.\n\nI can help you:\n- **Analyze your resume** against any job description for instant ATS scoring.\n- **Discover verified jobs** matching your skills.\n- **Prepare with AI mock interviews**.\n- **Get curated courses** for your missing skills.\n\nWhat role or skill are you targeting today?`;
      quickReplies = ["Find Python Developer jobs", "How do I analyze my resume?", "Courses for Docker & SQL", "Interview prep questions"];
      actionLinks.push({ title: "Browse Jobs", url: "jobs.html", type: "JOB" });
      actionLinks.push({ title: "Open Resume Analyzer", url: "resume-privacy.html", type: "RESUME" });
      return {
        reply,
        resources: [],
        actionLinks,
        quick_replies: quickReplies,
        session_id: sessionId
      };
    }

    // 1. Job search detection
    const isJobSearch = /\b(job|jobs|position|positions|role|roles|opening|openings|vacancy|vacancies|hiring|remote|developer|engineer|scientist|analyst|full ?stack|frontend|backend|devops)\b/i.test(lower);

    // 2. Course / Learning / Certifications detection
    const isCourse = /\b(course|courses|tutorial|tutorials|learn|study|resource|resources|roadmap|certification|certifications|docker|sql|kubernetes|aws|deep learning|machine learning|dsa)\b/i.test(lower);

    // 3. Resume / ATS / Skill gap detection
    const isResume = /\b(analy[sz]|resume|cv|score|ats|missing|gap|pii|privacy|redact)\b/i.test(lower);

    // 4. Interview prep detection
    const isInterview = /\b(interview|mock|behavioral|star method|question|questions|prep|technical)\b/i.test(lower);

    // 5. Dashboard / Auto-Apply / Referral
    const isDashboard = /\b(dashboard|applied|application|status|tracker|tracking)\b/i.test(lower);
    const isAutoApply = /\b(auto ?apply|automatic apply|bulk apply)\b/i.test(lower);
    const isReferral = /\b(referral|refer|cold email|networking)\b/i.test(lower);

    if (isJobSearch) {
      const keywords = ["python", "react", "devops", "frontend", "backend", "data", "remote", "sql", "aws", "docker", "machine learning", "cloud", "google", "amazon", "tcs", "stripe"];
      const matchedKw = keywords.filter(k => lower.includes(k));

      let matchedJobs = [];
      if (matchedKw.length > 0) {
        matchedJobs = allJobs.filter(j => {
          const hay = `${j.title} ${j.company} ${j.description} ${(j.skills || []).join(" ")} ${j.location}`.toLowerCase();
          return matchedKw.some(k => hay.includes(k));
        });
      }

      if (matchedJobs.length === 0) {
        matchedJobs = allJobs.slice(0, 3);
      } else {
        matchedJobs = matchedJobs.slice(0, 3);
      }

      const searchLabel = matchedKw.length > 0 ? matchedKw.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" & ") : "Verified";
      reply = `Here are the top **${searchLabel} Opportunities** currently active in JobNex:\n\n`;
      matchedJobs.forEach(job => {
        const skillsSnippet = (job.skills || []).slice(0, 4).join(", ");
        reply += `- **${job.title}** at **${job.company}** (${job.matchScore || 85}% Match)\n  *Location:* ${job.location} • *Type:* ${job.workplaceType || "Full-time"}\n  *Key Skills:* ${skillsSnippet}\n\n`;
      });
      reply += `You can test your compatibility score against any of these postings or submit your application directly on the Jobs board!`;

      actionLinks.push({ title: "View All Jobs", url: "jobs.html", type: "JOB" });
      actionLinks.push({ title: "Check Resume Compatibility", url: "resume-privacy.html", type: "RESUME" });
      quickReplies = ["Find Remote jobs", "What are my missing skills?", "Courses for Docker & SQL"];

    } else if (isCourse) {
      const wantsDocker = lower.includes("docker") || lower.includes("container");
      const wantsSql = lower.includes("sql") || lower.includes("database") || lower.includes("postgres");
      const wantsPython = lower.includes("python");
      const wantsAws = lower.includes("aws") || lower.includes("cloud");

      reply = `Here are top curated learning paths and recognized certifications:\n\n`;

      if (wantsDocker || (!wantsSql && !wantsPython && !wantsAws)) {
        reply += `- **Docker & Containerization for Developers** (Udemy • 10h • 4.8★)\n  *Master multi-stage builds, networking, image optimization, and docker-compose orchestration.*\n\n`;
        resources.push({
          skill: "Docker",
          message: "Docker & Containerization for Developers",
          resources: [
            { title: "Docker Hands-On Mastery", platform: "Udemy", url: "https://www.udemy.com" },
            { title: "Official Docker Docs & Labs", platform: "Docs", url: "https://docs.docker.com/get-started/" }
          ]
        });
      }

      if (wantsSql || (!wantsDocker && !wantsPython && !wantsAws)) {
        reply += `- **SQL for Data Science & Backend Engineers** (Coursera • 14h • 4.7★)\n  *Deep dive into PostgreSQL, query optimization, indexing strategies, and complex window functions.*\n\n`;
        resources.push({
          skill: "SQL",
          message: "SQL Database Mastery & Query Optimization",
          resources: [
            { title: "SQL for Data Science", platform: "Coursera", url: "https://www.coursera.org" },
            { title: "PostgreSQL Tutorial & Indexing", platform: "Docs", url: "https://www.postgresqltutorial.com/" }
          ]
        });
      }

      if (wantsAws) {
        reply += `- **AWS Certified Cloud Practitioner & Solutions Architect** (Coursera • 12 weeks • 4.7★)\n  *Learn resilient multi-region architectures, IAM, S3, ECS, and serverless Lambda deployment.*\n\n`;
        resources.push({
          skill: "AWS Cloud",
          message: "AWS Cloud Architect Essentials",
          resources: [
            { title: "AWS Cloud Practitioner", platform: "Coursera", url: "https://www.coursera.org" }
          ]
        });
      }

      if (wantsPython) {
        reply += `- **Python for High-Performance Systems & AI** (Coursera • 8 weeks • 4.9★)\n  *Asynchronous concurrency, FastAPI REST services, and data analytics pipelines.*\n\n`;
        resources.push({
          skill: "Python",
          message: "Python Mastery & Backend Systems",
          resources: [
            { title: "Python for Everybody", platform: "Coursera", url: "https://www.coursera.org" }
          ]
        });
      }

      reply += `Upskilling in these areas can boost your ATS match percentage for target roles by **15% to 28%**!`;
      actionLinks.push({ title: "View All Courses", url: "courses.html", type: "COURSE" });
      actionLinks.push({ title: "Analyze Skill Gap", url: "skill-gap.html", type: "SKILL" });
      quickReplies = ["Find Python Developer jobs", "How do I analyze my resume?", "Interview prep questions"];

    } else if (isResume) {
      if (lastAnalysis && (lastAnalysis.matched_score || lastAnalysis.matched_skills)) {
        const score = lastAnalysis.matched_score || 0;
        const matched = (lastAnalysis.matched_skills || []).slice(0, 5).join(", ") || "General Technical Skills";
        const missing = (lastAnalysis.missing_skills || []).slice(0, 5).join(", ") || "None flagged";
        reply = `Here is a summary of your latest resume analysis:\n\n` +
          `- **ATS Match Score:** **${score}%**\n` +
          `- **Matched Competencies:** ${matched}\n` +
          `- **Key Missing Skills:** ${missing}\n\n` +
          `**Steps to optimize your score:**\n` +
          `1. Incorporate missing keywords directly into your project bullet points.\n` +
          `2. Use quantifiable metrics (e.g. *reduced latency by 35%*, *handled 10k req/sec*).\n` +
          `3. Re-run analysis with **Blind Privacy Mode** enabled to test unbiased recruiter evaluation!`;
      } else {
        reply = `**How to analyze your resume on JobNex:**\n\n` +
          `1. Go to **Resume & Privacy** in the navigation bar.\n` +
          `2. Upload your resume (PDF/DOCX) or paste the resume text.\n` +
          `3. Paste your target Job Description or job posting URL.\n` +
          `4. *(Optional)* Turn on **Blind Resume Privacy** to automatically redact your name, email, phone number, and physical address before analysis.\n` +
          `5. Click **Analyze Compatibility** to receive your ATS match percentage, detected skills, and missing requirements!`;
      }
      actionLinks.push({ title: "Open Resume Analyzer", url: "resume-privacy.html", type: "RESUME" });
      quickReplies = ["Courses for Docker & SQL", "Find Python Developer jobs", "Practice interview questions"];

    } else if (isInterview) {
      reply = `Here are sample high-frequency interview questions from top tech teams:\n\n` +
        `1. **Technical / Architecture:**\n` +
        `   *How does React's Virtual DOM work, and how does the reconciliation algorithm optimize browser rendering?*\n` +
        `   💡 *Key Answer:* Mention in-memory VDOM tree diffing and batching DOM updates to minimize reflows.\n\n` +
        `2. **Databases & Scaling:**\n` +
        `   *What are the trade-offs between SQL (PostgreSQL) and NoSQL (MongoDB)? When would you choose one over the other?*\n` +
        `   💡 *Key Answer:* Compare strict ACID transactions & relations vs flexible schemas and horizontal sharding.\n\n` +
        `3. **Behavioral (STAR Method):**\n` +
        `   *Tell me about a challenging technical blocker you faced and how you solved it collaboratively.*\n` +
        `   💡 *Key Answer:* Follow Situation → Task → Action → Quantifiable Result.\n\n` +
        `Want to practice with interactive scoring? Launch the simulator below!`;

      actionLinks.push({ title: "Launch Interview Simulator", url: "interview-prep.html", type: "INTERVIEW" });
      quickReplies = ["Find Python Developer jobs", "Courses for Docker & SQL", "How do I analyze my resume?"];

    } else if (isDashboard) {
      reply = `The **Application Dashboard** tracks all your submitted job applications:\n\n` +
        `- **Visual Pipeline:** Monitor stages from *Applied* to *Review*, *Interview*, and *Offer*.\n` +
        `- **Audit Log:** View submission timestamps and submitted resume versions.\n` +
        `- **Stage Updates:** Track interview rounds and recruiter communications.`;
      actionLinks.push({ title: "Open Dashboard", url: "dashboard.html", type: "DASHBOARD" });
      quickReplies = ["Find Python Developer jobs", "How do I analyze my resume?"];

    } else if (isAutoApply) {
      reply = `The **Auto-Apply Engine** automates high-volume job applications:\n\n` +
        `- Matches your profile against daily verified openings.\n` +
        `- Auto-generates customized cover letters emphasizing your matching strengths.\n` +
        `- Submits applications when your match score exceeds your chosen threshold.`;
      actionLinks.push({ title: "Configure Auto-Apply", url: "auto-apply.html", type: "AUTOAPPLY" });
      quickReplies = ["Find Python Developer jobs", "Explore Jobs"];

    } else if (isReferral) {
      reply = `The **Cold Referral** tool drafts compelling outreach messages for LinkedIn and email:\n\n` +
        `- Tailors the pitch directly to the target role and company.\n` +
        `- Highlights matching achievements without sounding generic.\n` +
        `- Increases response rates from recruiters and employees.`;
      actionLinks.push({ title: "Draft Referral Email", url: "cold-referral.html", type: "REFERRAL" });
      quickReplies = ["Find Python Developer jobs", "Interview prep questions"];

    } else {
      reply = `I am **JobNex AI Career Copilot**. I can help you with:\n\n` +
        `- **Resume & ATS Analysis**: Upload your resume to check keywords, formatting, and match scores.\n` +
        `- **Job Search & Filters**: Search thousands of global and remote positions.\n` +
        `- **Interview Simulator**: Rehearse role-specific technical and behavioral questions.\n` +
        `- **Skill Roadmap**: Get direct learning resources for Docker, SQL, Python, AWS, and more.\n\n` +
        `Ask me anything about these features or click one of the quick options below!`;
      quickReplies = [
        "Find Python Developer jobs",
        "How do I analyze my resume?",
        "Interview prep questions",
        "Courses for Docker & SQL"
      ];
      actionLinks.push({ title: "Browse Jobs", url: "jobs.html", type: "JOB" });
      actionLinks.push({ title: "Open Resume Analyzer", url: "resume-privacy.html", type: "RESUME" });
    }

    return {
      reply,
      resources,
      actionLinks,
      quick_replies: quickReplies,
      session_id: sessionId
    };
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
          const apiBase = getApiBase();
          if (apiBase !== null) {
            await fetch(`${apiBase}/api/chat/${sessionId}`, { method: "DELETE" }).catch(() => {});
          }
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
