/**
 * Home Page Logic (frontend/js/home.js)
 * Implements:
 * 1. Reusable navbar & footer loading
 * 2. Canvas 2D constellation starfield
 * 3. Parallax at 0.3x speed for hero background layer
 * 4. IntersectionObserver scroll reveals for sections below hero (0.6s slide-up 24px + fade)
 * 5. Dynamic navbar scroll-spy updating active section pill
 * 6. Respects prefers-reduced-motion
 */

document.addEventListener("DOMContentLoaded", async () => {
  // 1. Load reusable navbar & footer
  await loadComponent("navbar-container", "components/navbar.html");
  await loadComponent("footer-container", "components/footer.html");
  initNav("home");

  // 2. Initialize Canvas 2D Starfield Backdrop
  initStarfield("hero-canvas");

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // 3. Parallax at 0.3x speed on hero background layer
  const heroBackdrop = document.getElementById("hero-backdrop");
  if (heroBackdrop && !prefersReducedMotion) {
    let ticking = false;
    window.addEventListener("scroll", () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const scrollY = window.scrollY || window.pageYOffset || 0;
          if (scrollY < window.innerHeight * 1.5) {
            heroBackdrop.style.transform = `translateY(${scrollY * 0.3}px)`;
          }
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  // 4. Smooth Section Scroll-Reveal (0.6s duration, 24px slide-up)
  const revealElements = document.querySelectorAll(".reveal-on-scroll");
  if (!prefersReducedMotion && "IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver((entries, observer) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-revealed");
          observer.unobserve(entry.target);
        }
      });
    }, {
      rootMargin: "0px 0px -40px 0px",
      threshold: 0.12
    });

    revealElements.forEach(el => revealObserver.observe(el));
  } else {
    revealElements.forEach(el => el.classList.add("is-revealed"));
  }

  // 5. Dynamic Navbar Scroll-Spy: updates active item as sections scroll into view
  const sections = [
    { id: "hero-section", navId: "nav-home" },
    { id: "ai-agent-section", navId: "nav-ai" },
    { id: "resources-section", navId: "nav-privacy" },
  ];

  if ("IntersectionObserver" in window) {
    const spyObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const targetId = entry.target.id;
          const match = sections.find(s => s.id === targetId);
          if (match) {
            document.querySelectorAll("#desktop-nav-menu a").forEach(a => {
              if (a.id === match.navId) {
                if (a.id === "nav-admin") {
                  a.className = "nav-item-link nav-admin-active flex shrink-0 items-center gap-1 font-semibold whitespace-nowrap rounded-lg bg-purple-700 text-white shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500";
                } else {
                  a.className = "nav-item-link nav-active flex shrink-0 items-center gap-1 font-semibold whitespace-nowrap rounded-lg bg-brand-600 text-white shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500";
                }
              } else if (a.id === "nav-ai") {
                a.className = "nav-item-link flex shrink-0 items-center gap-1 font-semibold whitespace-nowrap rounded-lg text-brand-700 bg-brand-50 hover:bg-brand-100 hover:text-brand-800 transition-colors border border-brand-200/60 shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500";
              } else if (a.id === "nav-admin") {
                a.className = "nav-item-link flex shrink-0 items-center gap-1 font-semibold whitespace-nowrap rounded-lg text-purple-700 bg-purple-50 hover:bg-purple-100 hover:text-purple-800 transition-colors border border-purple-200/60 shadow-2xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500";
              } else {
                a.className = "nav-item-link flex shrink-0 items-center gap-1 font-medium whitespace-nowrap rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500";
              }
            });
          }
        }
      });
    }, {
      rootMargin: "-20% 0px -60% 0px",
      threshold: 0
    });

    sections.forEach(s => {
      const el = document.getElementById(s.id);
      if (el) spyObserver.observe(el);
    });
  }

  // 6. Handle Search submission
  const heroSearchForm = document.getElementById("hero-search-form");
  if (heroSearchForm) {
    heroSearchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = document.getElementById("search-query")?.value.trim() || "";
      const region = document.getElementById("search-region")?.value || "ALL";
      const exp = document.getElementById("search-exp")?.value || "ALL";

      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (region !== "ALL") params.set("region", region);
      if (exp !== "ALL") params.set("exp", exp);

      window.location.href = `pages/jobs.html?${params.toString()}`;
    });
  }
});
