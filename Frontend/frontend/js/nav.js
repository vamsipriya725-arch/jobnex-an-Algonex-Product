/**
 * JobNex Navigation & Navbar Script
 * Dynamically adjusts links depending on current depth, highlights active route, and controls mobile menu.
 */

function updateNavbarUser() {
  const user = window.JobNexAuth?.getUser() || { name: "Profile", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=128&auto=format&fit=crop&q=80" };
  const loggedIn = window.JobNexAuth?.isLoggedIn() !== false;

  const authSection = document.getElementById("nav-auth-section");
  if (!authSection) return;

  const isInsidePages = window.location.pathname.includes("/pages/");
  const loginUrl = isInsidePages ? "login.html" : "pages/login.html";
  const resumeUrl = isInsidePages ? "resume-privacy.html" : "pages/resume-privacy.html";

  if (loggedIn) {
    authSection.innerHTML = `
      <div class="flex items-center gap-2">
        <a href="${resumeUrl}" class="flex items-center gap-2 text-xs font-semibold text-slate-800 hover:text-brand-600 transition-colors">
          <div class="w-8 h-8 shrink-0 rounded-full overflow-hidden border border-slate-300">
            <img src="${user.avatar}" alt="${user.name}" class="w-full h-full object-cover" />
          </div>
          <span class="hidden lg:inline text-xs font-semibold">${user.name.split(" ")[0]}</span>
        </a>
        <button id="sign-out-btn" class="h-8 px-2 text-xs text-slate-500 hover:text-slate-900 font-medium cursor-pointer transition-colors">
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
    { id: "nav-jobs", href: prefix + "jobs.html", key: "jobs" },
    { id: "nav-resources", href: prefix + "resources.html", key: "resources" },
    { id: "nav-interview", href: prefix + "interview-prep.html", key: "interview-prep" },
    { id: "nav-skills", href: prefix + "skill-gap.html", key: "skill-gap" },
    { id: "nav-autoapply", href: prefix + "auto-apply.html", key: "auto-apply" },
    { id: "nav-referral", href: prefix + "cold-referral.html", key: "cold-referral" },
    { id: "nav-dashboard", href: prefix + "dashboard.html", key: "dashboard" },
    { id: "nav-privacy", href: prefix + "resume-privacy.html", key: "resume-privacy" },
  ];

  links.forEach(l => {
    const el = document.getElementById(l.id);
    if (el) {
      el.href = l.href;
      if (l.key === activePageName) {
        el.className = "flex shrink-0 items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap rounded-md bg-brand-50 text-brand-600";
      } else {
        el.className = "flex shrink-0 items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium whitespace-nowrap rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors";
      }
    }

    const mobileEl = document.getElementById("mobile-" + l.id);
    if (mobileEl) {
      mobileEl.href = l.href;
      if (l.key === activePageName) {
        mobileEl.className = "flex items-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-brand-600 text-white";
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

  // Re-run lucide icons if available
  if (typeof lucide !== "undefined" && lucide.createIcons) {
    lucide.createIcons();
  }
}
