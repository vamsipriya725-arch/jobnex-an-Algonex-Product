/**
 * Resources Page Logic (frontend/js/resources.js)
 */

document.addEventListener("DOMContentLoaded", async () => {
  await loadComponent("navbar-container", "../components/navbar.html");
  await loadComponent("footer-container", "../components/footer.html");
  initNav("resources");

  if (typeof lucide !== "undefined" && lucide.createIcons) {
    lucide.createIcons();
  }
});
