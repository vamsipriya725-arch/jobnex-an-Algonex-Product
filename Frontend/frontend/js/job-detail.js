/**
 * JobNex — Job Detail Page Logic
 * Reads ?id= from URL, fetches from /api/jobs-board/:id, and renders full details.
 */
(function () {
  "use strict";

  const API = window.location.port === "8000" ? "" : "http://" + (window.location.hostname || "127.0.0.1") + ":8000";

  function esc(str) {
    return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function show(id) { document.getElementById(id)?.classList.remove("hidden"); }
  function hide(id) { document.getElementById(id)?.classList.add("hidden"); }
  function setText(id, text) { const el = document.getElementById(id); if (el) el.textContent = text; }
  function setHTML(id, html) { const el = document.getElementById(id); if (el) el.innerHTML = html; }

  async function loadJob() {
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id");

    if (!id) {
      hide("jd-loading");
      show("jd-error");
      return;
    }

    try {
      const res = await fetch(`${API}/api/jobs-board/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (!json.success || !json.data) throw new Error("Job not found");
      renderJob(json.data);
    } catch (err) {
      console.error("job-detail error:", err);
      hide("jd-loading");
      show("jd-error");
    }
  }

  function renderJob(job) {
    // Page title
    document.title = `${job.title} at ${job.company} | JobNex`;

    // Logo
    const logoEl = document.getElementById("jd-logo");
    if (logoEl) {
      if (job.company_logo) {
        logoEl.innerHTML = `<img src="${esc(job.company_logo)}" alt="${esc(job.company)}" class="w-full h-full object-contain p-1" />`;
      } else {
        logoEl.innerHTML = `<div class="w-full h-full flex items-center justify-center bg-brand-600 text-white font-bold text-2xl">${esc((job.company || "?")[0].toUpperCase())}</div>`;
      }
    }

    setText("jd-title", job.title || "");
    setText("jd-company", [job.company, job.department].filter(Boolean).join(" · "));

    // Badges
    const typeBadgeColors = {
      "Full-time":  "bg-brand-100 text-brand-800 border-brand-200",
      "Part-time":  "bg-violet-100 text-violet-800 border-violet-200",
      "Internship": "bg-amber-100 text-amber-800 border-amber-200",
      "Contract":   "bg-rose-100 text-rose-800 border-rose-200",
    };
    const modeBadgeColors = {
      "Remote": "bg-emerald-100 text-emerald-800 border-emerald-200",
      "Hybrid": "bg-blue-100 text-blue-800 border-blue-200",
      "Office": "bg-slate-100 text-slate-700 border-slate-200",
    };

    const typeBadgeEl = document.getElementById("jd-type-badge");
    if (typeBadgeEl) {
      typeBadgeEl.textContent = job.job_type || "";
      typeBadgeEl.className = `text-[11px] font-bold px-2.5 py-1 rounded-full border ${typeBadgeColors[job.job_type] || "bg-slate-100 text-slate-700 border-slate-200"}`;
      if (!job.job_type) typeBadgeEl.classList.add("hidden");
    }
    const modeBadgeEl = document.getElementById("jd-mode-badge");
    if (modeBadgeEl) {
      modeBadgeEl.textContent = job.work_mode || "";
      modeBadgeEl.className = `text-[11px] font-bold px-2.5 py-1 rounded-full border ${modeBadgeColors[job.work_mode] || "bg-slate-100 text-slate-700 border-slate-200"}`;
      if (!job.work_mode) modeBadgeEl.classList.add("hidden");
    }

    // Meta fields
    const locs = (job.locations || []).join(", ") || "Not specified";
    const locEl = document.getElementById("jd-location");
    if (locEl) locEl.innerHTML = `<i data-lucide="map-pin" class="w-3.5 h-3.5"></i>${esc(locs)}`;

    const exp = job.exp_min === job.exp_max ? `${job.exp_min} yrs exp` : `${job.exp_min}–${job.exp_max} yrs exp`;
    const expEl = document.getElementById("jd-exp");
    if (expEl) expEl.innerHTML = `<i data-lucide="briefcase" class="w-3.5 h-3.5"></i>${esc(exp)}`;

    const salaryEl = document.getElementById("jd-salary");
    if (salaryEl) {
      if (job.salary_label && job.salary_label !== "Not disclosed") {
        salaryEl.innerHTML = `<i data-lucide="indian-rupee" class="w-3.5 h-3.5"></i>${esc(job.salary_label)}`;
        salaryEl.classList.remove("hidden");
      } else {
        salaryEl.classList.add("hidden");
      }
    }

    const openEl = document.getElementById("jd-openings");
    if (openEl) {
      if (job.openings) {
        openEl.innerHTML = `<i data-lucide="users" class="w-3.5 h-3.5"></i>${esc(String(job.openings))} opening${job.openings > 1 ? "s" : ""}`;
      } else {
        openEl.classList.add("hidden");
      }
    }

    const deptEl = document.getElementById("jd-dept");
    if (deptEl) {
      if (job.department) {
        deptEl.innerHTML = `<i data-lucide="building-2" class="w-3.5 h-3.5"></i>${esc(job.department)}`;
      } else {
        deptEl.classList.add("hidden");
      }
    }

    const eduEl = document.getElementById("jd-education");
    if (eduEl) {
      if (job.education) {
        eduEl.innerHTML = `<i data-lucide="graduation-cap" class="w-3.5 h-3.5"></i>${esc(job.education)}`;
      } else {
        eduEl.classList.add("hidden");
      }
    }

    const postedEl = document.getElementById("jd-posted");
    if (postedEl) {
      if (job.created_at) {
        const date = new Date(job.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
        postedEl.innerHTML = `<i data-lucide="calendar" class="w-3.5 h-3.5"></i>Posted ${date}`;
      } else {
        postedEl.classList.add("hidden");
      }
    }

    const dlEl = document.getElementById("jd-deadline");
    if (dlEl) {
      if (job.apply_last_date) {
        dlEl.innerHTML = `<i data-lucide="clock" class="w-3.5 h-3.5"></i>Apply by ${esc(job.apply_last_date)}`;
        dlEl.classList.remove("hidden");
      } else {
        dlEl.classList.add("hidden");
      }
    }

    // Skills
    const skillsEl = document.getElementById("jd-skills");
    if (skillsEl) {
      const skills = job.skills || [];
      skillsEl.innerHTML = skills.length
        ? skills.map(s => `<span class="skill-tag">${esc(s)}</span>`).join("")
        : `<span class="text-xs text-slate-400">No specific skills listed</span>`;
    }

    // Apply button
    const applyBtn = document.getElementById("jd-apply-btn");
    if (applyBtn) {
      applyBtn.addEventListener("click", () => {
        if (job.apply_link) { window.open(job.apply_link, "_blank"); return; }
        if (job.apply_email) { window.location.href = `mailto:${job.apply_email}`; return; }
        if (typeof showToast === "function") showToast("No apply link provided for this job.", "info");
      });
    }

    // Description
    const descEl = document.getElementById("jd-description");
    if (descEl) {
      descEl.textContent = job.description || "No description provided.";
    }

    // Reveal
    hide("jd-loading");
    show("jd-content");

    if (typeof lucide !== "undefined") lucide.createIcons();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    await loadComponent("navbar-container", "../components/navbar.html");
    await loadComponent("footer-container", "../components/footer.html");
    initNav("posted-jobs");
    loadJob();
  });
})();
