/**
 * Home Page Logic (frontend/js/home.js)
 */

document.addEventListener("DOMContentLoaded", async () => {
  // Load reusable navbar & footer
  await loadComponent("navbar-container", "components/navbar.html");
  await loadComponent("footer-container", "components/footer.html");
  initNav("home");

  // Initialize Canvas 2D Starfield
  initStarfield("hero-canvas");

  // Handle Search submission
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

  // Trending tag clicks
  document.querySelectorAll(".trending-tag-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const tag = btn.getAttribute("data-tag");
      window.location.href = `pages/jobs.html?q=${encodeURIComponent(tag)}`;
    });
  });

  if (typeof lucide !== "undefined" && lucide.createIcons) {
    lucide.createIcons();
  }
});
