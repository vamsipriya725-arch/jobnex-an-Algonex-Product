/**
 * JobNex Navigation & Navbar Script
 * Dynamically adjusts links depending on current depth, highlights active route, and controls mobile menu.
 */

function updateNavbarUser() {
  const user = window.JobNexAuth?.getUser() || { name: "Candidate", email: "", avatar: "" };
  const loggedIn = window.JobNexAuth?.isLoggedIn() !== false;

  const authSection = document.getElementById("nav-auth-section");
  if (!authSection) return;

  const isInsidePages = window.location.pathname.includes("/pages/");
  const loginUrl = isInsidePages ? "login.html" : "pages/login.html";
  const resumeUrl = isInsidePages ? "resume-privacy.html" : "pages/resume-privacy.html";

  if (loggedIn) {
    const displayName = (user.name && user.name !== "Google Verified Candidate") ? user.name : (user.email ? user.email.split("@")[0] : "Candidate");
    const displayEmail = user.email || "";
    const avatarUrl = user.avatar && !user.avatar.includes("534528741775-53994a69daeb")
      ? user.avatar
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=2563eb&color=fff&bold=true`;

    authSection.innerHTML = `
      <div class="flex items-center gap-2.5">
        <a href="${resumeUrl}" class="flex items-center gap-2 group text-xs font-semibold text-slate-800 hover:text-brand-600 transition-colors" title="${displayEmail ? `${displayName} (${displayEmail})` : displayName}">
          <div class="w-8 h-8 shrink-0 rounded-full overflow-hidden border border-slate-300 ring-2 ring-brand-500/20 bg-slate-100 flex items-center justify-center shadow-xs">
            <img src="${avatarUrl}" 
                 alt="${displayName}" 
                 referrerpolicy="no-referrer"
                 class="w-full h-full object-cover rounded-full" 
                 onerror="this.onerror=null;this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=2563eb&color=fff&bold=true';" />
          </div>
          <div class="flex flex-col text-left leading-tight max-w-[120px] sm:max-w-[160px]">
            <span class="text-xs font-semibold text-slate-900 group-hover:text-brand-600 truncate">${displayName}</span>
            ${displayEmail ? `<span class="text-[10px] text-slate-500 font-normal truncate">${displayEmail}</span>` : ""}
          </div>
        </a>
        <button id="sign-out-btn" class="h-8 px-2 text-xs text-slate-500 hover:text-red-600 font-medium cursor-pointer transition-colors" title="Sign out">
          Sign out
        </button>
      </div>
    `;
    document.getElementById("sign-out-btn")?.addEventListener("click", () => {
      window.JobNexAuth?.logout();
      window.location.href = isInsidePages ? "login.html" : "pages/login.html";
    });
  } else {
    authSection.innerHTML = `
      <div class="flex items-center gap-2">
        <a href="${loginUrl}" class="text-xs font-semibold text-slate-700 hover:text-brand-600 px-3 py-1.5 transition-colors">
          Login
        </a>
        <a href="${loginUrl}" class="btn-polish text-xs font-medium bg-brand-600 hover:bg-brand-700 text-white px-3.5 py-2">
          Sign up
        </a>
      </div>
    `;
  }
}

function initNav(activePageName) {
  const isInsidePages = window.location.pathname.includes("/pages/");
  const prefix = isInsidePages ? "" : "pages/";
  const homePrefix = isInsidePages ? "../" : "";

  // Update navigation links dynamically
  const links = [
    { id: "nav-home", href: homePrefix + "index.html", key: "home" },
    { id: "nav-jobs", href: prefix + "posted-jobs.html", key: "posted-jobs" },
    { id: "nav-builder", href: prefix + "resume-builder.html", key: "resume-builder" },
    { id: "nav-interview", href: prefix + "interview-prep.html", key: "interview-prep" },
    { id: "nav-skills", href: prefix + "skill-gap.html", key: "skill-gap" },
    { id: "nav-autoapply", href: prefix + "auto-apply.html", key: "auto-apply" },
    { id: "nav-referral", href: prefix + "cold-referral.html", key: "cold-referral" },
    { id: "nav-dashboard", href: prefix + "dashboard.html", key: "dashboard" },
    { id: "nav-privacy", href: prefix + "resume-privacy.html", key: "resume-privacy" },
    { id: "nav-ai", href: prefix + "ai-assistant.html", key: "ai-assistant" },
    { id: "nav-admin", href: prefix + "admin-jobs.html", key: "admin-jobs", adminOnly: true },
  ];

  links.forEach(l => {
    const userRole = (window.JobNexAuth?.getUser()?.role || "").toUpperCase();
    const isAdmin = userRole === "ADMIN";

    const el = document.getElementById(l.id);
    if (el) {
      el.href = l.href;
      // Show/hide admin-only items
      if (l.adminOnly) {
        el.classList.toggle("hidden", !isAdmin);
      }
      if (l.key === activePageName) {
        el.className = el.className.replace("hidden ", "");
        el.className = "flex shrink-0 items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap rounded-md bg-brand-600 text-white shadow-xs";
      } else if (l.id === "nav-ai") {
        el.className = "flex shrink-0 items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap rounded-md text-brand-700 bg-brand-50 hover:bg-brand-100 hover:text-brand-800 transition-colors border border-brand-200/60 shadow-xs";
      } else if (l.id === "nav-admin") {
        const adminClass = "flex shrink-0 items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap rounded-md text-amber-700 bg-amber-50 hover:bg-amber-100 transition-colors border border-amber-200/60 shadow-xs";
        el.className = isAdmin ? adminClass : adminClass + " hidden";
      } else {
        el.className = "flex shrink-0 items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors";
      }
    }

    const mobileEl = document.getElementById("mobile-" + l.id);
    if (mobileEl) {
      mobileEl.href = l.href;
      if (l.adminOnly) {
        mobileEl.classList.toggle("hidden", !isAdmin);
      }
      if (l.key === activePageName) {
        mobileEl.className = mobileEl.className.replace("hidden ", "");
        mobileEl.className = "flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-brand-600 text-white shadow-xs" + (l.id === "nav-ai" ? " col-span-2" : "");
      } else if (l.id === "nav-ai") {
        mobileEl.className = "col-span-2 flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors border border-brand-200/60";
      } else if (l.id === "nav-admin") {
        const mAdminClass = "col-span-2 flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-amber-50 text-amber-700 hover:bg-amber-100 transition-colors border border-amber-200/60";
        mobileEl.className = isAdmin ? mAdminClass : mAdminClass + " hidden";
      } else {
        mobileEl.className = "flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors";
      }
    }
  });

  const logoLink = document.getElementById("nav-logo-link");
  if (logoLink) logoLink.href = homePrefix + "index.html";

  // Mobile Menu toggle
  const mobileBtn = document.getElementById("mobile-menu-btn");
  const mobileMenu = document.getElementById("mobile-menu-dropdown");
  if (mobileBtn && mobileMenu) {
    mobileBtn.addEventListener("click", () => {
      mobileMenu.classList.toggle("hidden");
    });
  }

  updateNavbarUser();

  // Inject floating Robo Agent launcher across all pages
  injectFloatingRoboAgent();

  // Re-run lucide icons if available
  if (typeof lucide !== "undefined" && lucide.createIcons) {
    lucide.createIcons();
  }
}

/**
 * Floating Robo Agent Launcher Widget
 * Renders a small floating robot icon on the bottom right corner with tooltip and badge.
 */
function injectFloatingRoboAgent() {
  if (document.getElementById("jobnex-robo-launcher")) return;

  const isInsidePages = window.location.pathname.includes("/pages/");
  const isAIAssistant = window.location.pathname.includes("ai-assistant.html");
  if (isAIAssistant) return; // Do not obscure conversation on the dedicated assistant page

  const targetUrl = isInsidePages ? "ai-assistant.html" : "pages/ai-assistant.html";

  const widget = document.createElement("aside");
  widget.id = "jobnex-robo-launcher";
  widget.className = "fixed bottom-6 right-6 z-50 flex items-center gap-2.5 group select-none print:hidden";
  widget.setAttribute("aria-label", "JobNex AI Career Agent");

  widget.innerHTML = `
    <!-- Speech Bubble Preview / Tooltip -->
    <a href="${targetUrl}" class="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-slate-900/95 text-white text-xs font-semibold shadow-xl border border-brand-400/30 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 pointer-events-none group-hover:pointer-events-auto backdrop-blur-md">
      <span class="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
      <span>Chat with JobNex AI</span>
      <span class="text-[10px] bg-brand-600/80 px-1.5 py-0.5 rounded text-white font-mono">Agent</span>
    </a>

    <!-- Floating Robot Action Button -->
    <a href="${targetUrl}" id="jobnex-robo-fab" title="Open JobNex AI Career Agent" class="relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-tr from-brand-700 via-brand-600 to-indigo-600 text-white shadow-xl shadow-brand-600/30 hover:shadow-2xl hover:shadow-brand-500/50 hover:scale-105 active:scale-95 transition-all duration-300 border-2 border-white/90 focus:outline-none focus:ring-4 focus:ring-brand-400/50">
      <!-- Pulsing Activity Indicator -->
      <span class="absolute top-0 right-0 flex h-3.5 w-3.5">
        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white"></span>
      </span>

      <!-- Crisp Robot Icon (SVG + Lucide Compatible) -->
      <svg class="w-7 h-7 text-white drop-shadow-sm transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:rotate-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M12 8V4H8"></path>
        <rect width="16" height="12" x="4" y="8" rx="2"></rect>
        <path d="M2 14h2"></path>
        <path d="M20 14h2"></path>
        <path d="M15 13v2"></path>
        <path d="M9 13v2"></path>
      </svg>
    </a>
  `;

  document.body.appendChild(widget);
}

// Ensure floating robo agent initializes as early as possible
if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => injectFloatingRoboAgent());
  } else {
    injectFloatingRoboAgent();
  }
}
