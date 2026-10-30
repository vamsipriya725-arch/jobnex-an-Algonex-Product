/**
 * JobNex Navigation & Navbar Script
 * Implements:
 * 1. Sticky navbar (always visible, top: 0, z-index: 50)
 * 2. Shrinks from 72px to 60px after 40px scroll (smooth 200ms transition)
 * 3. Background: Solid white at top -> white at 90% opacity with blur(12px) and shadow (0 4px 20px rgba(0,0,0,0.08))
 * 4. Responsive layout: Logo (left), Menu (center), Profile + Sign out (right)
 * 5. Below 1280px: hides email under username
 * 6. Below 1100px: collapses desktop menu into hamburger drawer, with Esc closing drawer
 * 7. Top 3px violet scroll progress bar
 * 8. Round Back-to-Top button appearing after 600px scroll
 */

function updateNavbarUser() {
  const user = window.JobNexAuth?.getUser() || { name: "Candidate", email: "", avatar: "", role: "JOB_SEEKER" };
  const loggedIn = window.JobNexAuth?.isLoggedIn() !== false;

  const authSection = document.getElementById("nav-auth-section");
  if (!authSection) return;

  const isInsidePages = window.location.pathname.includes("/pages/");
  const loginUrl = isInsidePages ? "login.html" : "pages/login.html";
  const resumeUrl = isInsidePages ? "resume-privacy.html" : "pages/resume-privacy.html";

  // Check admin role
  const isAdmin = user && (user.role === "ADMIN" || user.role === "RECRUITER" || (user.email && user.email.toLowerCase().includes("admin")));

  // Show/hide admin navbar button
  const adminDesktop = document.getElementById("nav-admin");
  const adminMobile = document.getElementById("mobile-nav-admin");
  if (adminDesktop) {
    if (isAdmin) {
      adminDesktop.classList.remove("hidden");
    } else {
      adminDesktop.classList.add("hidden");
    }
  }
  if (adminMobile) {
    if (isAdmin) {
      adminMobile.classList.remove("hidden");
    } else {
      adminMobile.classList.add("hidden");
    }
  }

  if (loggedIn) {
    const displayName = (user.name && user.name !== "Google Verified Candidate") ? user.name : (user.email ? user.email.split("@")[0] : "Candidate");
    const displayEmail = user.email || "";
    const avatarUrl = user.avatar && !user.avatar.includes("534528741775-53994a69daeb")
      ? user.avatar
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=2563eb&color=fff&bold=true`;

    authSection.innerHTML = `
      <div class="flex items-center gap-2">
        <a href="${resumeUrl}" class="flex items-center gap-2 group text-xs font-semibold text-slate-800 hover:text-brand-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-lg p-0.5" title="${displayEmail ? `${displayName} (${displayEmail})` : displayName}">
          <div class="w-8 h-8 shrink-0 rounded-full overflow-hidden border border-slate-300 ring-2 ring-brand-500/20 bg-slate-100 flex items-center justify-center shadow-2xs">
            <img src="${avatarUrl}" 
                 alt="${displayName}" 
                 referrerpolicy="no-referrer"
                 class="w-full h-full object-cover rounded-full" 
                 onerror="this.onerror=null;this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=2563eb&color=fff&bold=true';" />
          </div>
          <div class="flex flex-col text-left leading-tight max-w-[85px] min-[1350px]:max-w-[130px]">
            <span class="text-xs font-semibold text-slate-900 group-hover:text-brand-600 truncate">${displayName}</span>
            <div class="user-nav-email hidden min-[1350px]:flex items-center gap-1">
              ${isAdmin ? '<span class="inline-block px-1 py-0.2 rounded text-[9px] font-bold bg-purple-100 text-purple-700">Admin</span>' : ''}
              ${displayEmail ? `<span class="text-[10px] text-slate-500 font-normal truncate">${displayEmail}</span>` : ""}
            </div>
          </div>
        </a>
        <button id="sign-out-btn" class="h-8 px-2 text-xs text-slate-500 hover:text-red-600 font-medium cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-md shrink-0" title="Sign out">
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
        <a href="${loginUrl}" class="text-xs font-semibold text-slate-700 hover:text-brand-600 px-3 py-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-lg">
          Login
        </a>
        <a href="${loginUrl}" class="btn-polish text-xs font-medium bg-brand-600 hover:bg-brand-700 text-white px-3.5 py-2 rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
          Sign up
        </a>
      </div>
    `;
  }
}

/**
 * Initializes Sticky Navbar Scroll Behavior, Progress Bar, and Back-to-Top
 */
function initScrollNavbar() {
  const header = document.getElementById("main-header");
  const container = document.getElementById("navbar-inner-container");
  const progressBar = document.getElementById("scroll-progress-bar");
  const backToTopBtn = document.getElementById("back-to-top-btn");

  function onScroll() {
    const scrollY = window.scrollY || window.pageYOffset || 0;

    // 1. Scroll progress bar (3px at very top)
    if (progressBar) {
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? (scrollY / docHeight) * 100 : 0;
      progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    }

    // 2. Shrink navbar from 72px to 60px after 40px scroll
    if (scrollY > 40) {
      if (header) {
        header.style.backgroundColor = "rgba(255, 255, 255, 0.90)";
        header.style.backdropFilter = "blur(12px)";
        header.style.webkitBackdropFilter = "blur(12px)";
        header.style.boxShadow = "0 4px 20px rgba(0, 0, 0, 0.08)";
      }
      if (container) {
        container.style.height = "60px";
      }
    } else {
      if (header) {
        header.style.backgroundColor = "#ffffff";
        header.style.backdropFilter = "none";
        header.style.webkitBackdropFilter = "none";
        header.style.boxShadow = "none";
      }
      if (container) {
        container.style.height = "72px";
      }
    }

    // 3. Back to Top button visibility (> 600px)
    if (backToTopBtn) {
      if (scrollY > 600) {
        backToTopBtn.classList.remove("opacity-0", "pointer-events-none", "translate-y-4");
        backToTopBtn.classList.add("opacity-100", "pointer-events-auto", "translate-y-0");
      } else {
        backToTopBtn.classList.add("opacity-0", "pointer-events-none", "translate-y-4");
        backToTopBtn.classList.remove("opacity-100", "pointer-events-auto", "translate-y-0");
      }
    }
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (backToTopBtn) {
    backToTopBtn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // Keyboard Esc closes mobile drawer
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      const mobileMenu = document.getElementById("mobile-menu-dropdown");
      const mobileBtn = document.getElementById("mobile-menu-btn");
      if (mobileMenu && !mobileMenu.classList.contains("hidden")) {
        mobileMenu.classList.add("hidden");
        mobileBtn?.setAttribute("aria-expanded", "false");
      }
    }
  });
}

function initNav(activePageName) {
  const isInsidePages = window.location.pathname.includes("/pages/");
  const prefix = isInsidePages ? "" : "pages/";
  const homePrefix = isInsidePages ? "../" : "";

  // Update navigation links dynamically
  const links = [
    { id: "nav-home", href: homePrefix + "index.html", key: "home" },
    { id: "nav-jobs", href: prefix + "jobs.html", key: "jobs" },
    { id: "nav-builder", href: prefix + "resume-builder.html", key: "resume-builder" },
    { id: "nav-interview", href: prefix + "interview-prep.html", key: "interview-prep" },
    { id: "nav-skills", href: prefix + "skill-gap.html", key: "skill-gap" },
    { id: "nav-autoapply", href: prefix + "auto-apply.html", key: "auto-apply" },
    { id: "nav-referral", href: prefix + "cold-referral.html", key: "cold-referral" },
    { id: "nav-dashboard", href: prefix + "dashboard.html", key: "dashboard" },
    { id: "nav-privacy", href: prefix + "resume-privacy.html", key: "resume-privacy" },
    { id: "nav-admin", href: prefix + "admin-jobs.html", key: "admin-jobs" },
    { id: "nav-ai", href: prefix + "ai-assistant.html", key: "ai-assistant" },
  ];

  links.forEach(l => {
    const el = document.getElementById(l.id);
    if (el) {
      el.href = l.href;
      if (l.key === activePageName) {
        if (l.id === "nav-admin") {
          el.className = "nav-item-link nav-admin-active flex shrink-0 items-center gap-1 font-semibold whitespace-nowrap rounded-lg bg-purple-700 text-white shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500";
        } else {
          el.className = "nav-item-link nav-active flex shrink-0 items-center gap-1 font-semibold whitespace-nowrap rounded-lg bg-brand-600 text-white shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500";
        }
      } else if (l.id === "nav-ai") {
        el.className = "nav-item-link flex shrink-0 items-center gap-1 font-semibold whitespace-nowrap rounded-lg text-brand-700 bg-brand-50 hover:bg-brand-100 hover:text-brand-800 transition-colors border border-brand-200/60 shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500";
      } else if (l.id === "nav-admin") {
        el.className = "nav-item-link flex shrink-0 items-center gap-1 font-semibold whitespace-nowrap rounded-lg text-purple-700 bg-purple-50 hover:bg-purple-100 hover:text-purple-800 transition-colors border border-purple-200/60 shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500";
      } else {
        el.className = "nav-item-link flex shrink-0 items-center gap-1 font-medium whitespace-nowrap rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500";
      }
    }

    const mobileEl = document.getElementById("mobile-" + l.id);
    if (mobileEl) {
      mobileEl.href = l.href;
      if (l.key === activePageName) {
        mobileEl.className = "flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-brand-600 text-white shadow-2xs focus-visible:ring-2 focus-visible:ring-brand-500" + (l.id === "nav-ai" ? " col-span-2" : "");
      } else if (l.id === "nav-ai") {
        mobileEl.className = "col-span-2 flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors border border-brand-200/60 focus-visible:ring-2 focus-visible:ring-brand-500";
      } else if (l.id === "nav-admin") {
        mobileEl.className = "flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg text-purple-700 bg-purple-50 hover:bg-purple-100 transition-colors border border-purple-200 focus-visible:ring-2 focus-visible:ring-brand-500";
      } else {
        mobileEl.className = "flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg text-slate-700 bg-slate-100 hover:bg-slate-200 transition-colors focus-visible:ring-2 focus-visible:ring-brand-500";
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
      const isExpanded = !mobileMenu.classList.contains("hidden");
      mobileMenu.classList.toggle("hidden");
      mobileBtn.setAttribute("aria-expanded", String(!isExpanded));
    });
  }

  updateNavbarUser();

  // Initialize Sticky Navbar Scroll Effects & Progress Bar
  initScrollNavbar();

  // Inject floating Robo Agent launcher across all pages
  injectFloatingRoboAgent();

  if (typeof lucide !== "undefined" && lucide.createIcons) {
    lucide.createIcons();
  }
}

/**
 * Floating Robo Agent Launcher Widget
 */
function injectFloatingRoboAgent() {
  if (document.getElementById("jobnex-robo-launcher")) return;

  const isInsidePages = window.location.pathname.includes("/pages/");
  const isAIAssistant = window.location.pathname.includes("ai-assistant.html");
  if (isAIAssistant) return;

  const targetUrl = isInsidePages ? "ai-assistant.html" : "pages/ai-assistant.html";

  const widget = document.createElement("aside");
  widget.id = "jobnex-robo-launcher";
  widget.className = "fixed bottom-6 right-6 z-40 flex items-center gap-2.5 group select-none print:hidden";
  widget.setAttribute("aria-label", "JobNex AI Career Agent");

  widget.innerHTML = `
    <!-- Speech Bubble Preview / Tooltip -->
    <a href="${targetUrl}" class="hidden sm:inline-flex items-center gap-2 px-3.5 py-2 rounded-full bg-slate-900/95 text-white text-xs font-semibold shadow-xl border border-brand-400/30 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 pointer-events-none group-hover:pointer-events-auto backdrop-blur-md focus-visible:ring-2 focus-visible:ring-brand-500">
      <span class="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
      <span>Chat with JobNex AI</span>
      <span class="text-[10px] bg-brand-600/80 px-1.5 py-0.5 rounded text-white font-mono">Agent</span>
    </a>

    <!-- Floating Robot Action Button -->
    <a href="${targetUrl}" id="jobnex-robo-fab" title="Open JobNex AI Career Agent" class="relative flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-tr from-brand-700 via-brand-600 to-indigo-600 text-white shadow-xl shadow-brand-600/30 hover:shadow-2xl hover:shadow-brand-500/50 hover:scale-105 active:scale-95 transition-all duration-300 border-2 border-white/90 focus:outline-none focus:ring-4 focus:ring-brand-400/50">
      <span class="absolute top-0 right-0 flex h-3.5 w-3.5">
        <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
        <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white"></span>
      </span>

      <svg class="w-7 h-7 text-white drop-shadow-xs transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:rotate-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
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

if (typeof document !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => injectFloatingRoboAgent());
  } else {
    injectFloatingRoboAgent();
  }
}
