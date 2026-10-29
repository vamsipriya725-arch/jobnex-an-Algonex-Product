/**
 * JobNex — Posted Jobs Page Logic
 * Fetches from /api/jobs-board, renders cards, handles search/filter/sort/pagination.
 */
(function () {
  "use strict";

  const API = window.location.port === "8000" ? "" : "http://" + (window.location.hostname || "127.0.0.1") + ":8000";

  // State
  let state = {
    jobs: [],
    total: 0,
    page: 1,
    perPage: 15,
    totalPages: 1,
    loading: false,
    error: null,
    search: "",
    workModes: [],
    jobTypes: [],
    expMin: null,
    expMax: null,
    sort: "newest",
  };

  // Elements
  const container = () => document.getElementById("pj-jobs-container");
  const subtitle   = () => document.getElementById("jobs-subtitle");
  const pagination = () => document.getElementById("pj-pagination");
  const pageInfo   = () => document.getElementById("pj-page-info");
  const prevBtn    = () => document.getElementById("pj-prev");
  const nextBtn    = () => document.getElementById("pj-next");

  // -------------------------------------------------------------------------
  // Fetch
  // -------------------------------------------------------------------------
  async function fetchJobs() {
    state.loading = true;
    renderJobs();

    const q = new URLSearchParams({ page: state.page, per_page: state.perPage, sort: state.sort });
    if (state.search)               q.set("search", state.search);
    if (state.workModes.length === 1) q.set("work_mode", state.workModes[0]);
    if (state.jobTypes.length === 1)  q.set("job_type",  state.jobTypes[0]);
    if (state.expMin !== null)        q.set("exp_min",   state.expMin);
    if (state.expMax !== null)        q.set("exp_max",   state.expMax);

    try {
      const res  = await fetch(`${API}/api/jobs-board?${q.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      if (json.success) {
        state.jobs       = json.data   || [];
        state.total      = json.total  || 0;
        state.totalPages = json.total_pages || 1;
      } else {
        state.jobs = []; state.total = 0; state.totalPages = 1;
      }
      state.error = null;
    } catch (err) {
      console.error("Failed to fetch jobs:", err);
      state.error = err.message;
      state.jobs  = [];
    } finally {
      state.loading = false;
      renderJobs();
    }
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  function renderJobs() {
    const el = container();
    const sub = subtitle();
    if (!el) return;

    // Loading
    if (state.loading) {
      el.innerHTML = `
        <div class="bg-white rounded-xl p-12 text-center border border-slate-200 shadow-xs">
          <div class="inline-flex items-center gap-2 text-brand-600 font-semibold text-sm">
            <span class="w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full animate-spin"></span>
            Loading jobs...
          </div>
        </div>`;
      if (sub) sub.textContent = "Fetching live jobs...";
      return;
    }

    // Error
    if (state.error) {
      el.innerHTML = `
        <div class="bg-white rounded-xl p-10 text-center border border-rose-200 shadow-xs space-y-3">
          <i data-lucide="wifi-off" class="w-10 h-10 text-rose-400 mx-auto"></i>
          <p class="text-sm font-semibold text-slate-700">Could not load jobs</p>
          <p class="text-xs text-slate-400">${state.error}</p>
          <button onclick="location.reload()" class="mt-2 px-4 py-2 bg-brand-600 text-white text-xs font-semibold rounded-xl">Retry</button>
        </div>`;
      if (sub) sub.textContent = "Error loading jobs.";
      if (typeof lucide !== "undefined") lucide.createIcons();
      return;
    }

    // Empty
    if (!state.jobs.length) {
      el.innerHTML = `
        <div class="bg-white rounded-xl p-10 text-center border border-slate-200 shadow-xs space-y-3">
          <i data-lucide="inbox" class="w-10 h-10 text-slate-300 mx-auto"></i>
          <p class="text-sm font-semibold text-slate-600">No jobs found</p>
          <p class="text-xs text-slate-400">Try adjusting your search or filters.</p>
        </div>`;
      if (sub) sub.textContent = "0 jobs found";
      if (typeof lucide !== "undefined") lucide.createIcons();
      renderPagination();
      return;
    }

    // Update subtitle
    if (sub) sub.textContent = `${state.total} job${state.total !== 1 ? "s" : ""} found`;

    // Cards
    el.innerHTML = state.jobs.map(job => buildCard(job)).join("");

    // Wire up buttons
    el.querySelectorAll(".pj-detail-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.id;
        window.location.href = `job-detail.html?id=${encodeURIComponent(id)}`;
      });
    });
    el.querySelectorAll(".pj-apply-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const link  = btn.dataset.link;
        const email = btn.dataset.email;
        if (link)  { window.open(link, "_blank"); return; }
        if (email) { window.location.href = `mailto:${email}`; return; }
        if (typeof showToast === "function") showToast("No apply link provided for this job.", "info");
      });
    });

    if (typeof lucide !== "undefined") lucide.createIcons();
    renderPagination();
  }

  function buildCard(job) {
    const skills = (job.skills || []).slice(0, 6);
    const locs   = (job.locations || []).join(", ") || "Not specified";
    const exp    = job.exp_min === job.exp_max ? `${job.exp_min} yrs` : `${job.exp_min}–${job.exp_max} yrs`;
    const postedAt = job.created_at ? new Date(job.created_at).toLocaleDateString("en-IN", { day:"numeric", month:"short", year:"numeric" }) : "";

    const workModeBadge = {
      "Remote":  "bg-emerald-100 text-emerald-800 border-emerald-200",
      "Hybrid":  "bg-blue-100 text-blue-800 border-blue-200",
      "Office":  "bg-slate-100 text-slate-700 border-slate-200",
    }[job.work_mode] || "bg-slate-100 text-slate-700 border-slate-200";

    const typeBadge = {
      "Full-time":  "bg-brand-100 text-brand-800 border-brand-200",
      "Part-time":  "bg-violet-100 text-violet-800 border-violet-200",
      "Internship": "bg-amber-100 text-amber-800 border-amber-200",
      "Contract":   "bg-rose-100 text-rose-800 border-rose-200",
    }[job.job_type] || "bg-slate-100 text-slate-700 border-slate-200";

    const logoHtml = job.company_logo
      ? `<img src="${escHtml(job.company_logo)}" alt="${escHtml(job.company)}" class="w-full h-full object-contain p-1" />`
      : `<div class="w-full h-full flex items-center justify-center bg-brand-600 text-white font-bold text-lg">${escHtml((job.company || "?")[0].toUpperCase())}</div>`;

    const skillTags = skills.map(s => `<span class="skill-tag">${escHtml(s)}</span>`).join("");

    return `
      <div class="bg-white rounded-xl border border-slate-200 hover:border-brand-300 hover:shadow-md p-5 transition-all group">
        <div class="flex flex-col sm:flex-row items-start justify-between gap-4">
          <!-- Left: logo + info -->
          <div class="flex items-start gap-4">
            <div class="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 border border-slate-200 shrink-0">${logoHtml}</div>
            <div class="space-y-1.5">
              <div class="flex flex-wrap items-center gap-2">
                <h3 class="text-sm font-bold text-slate-900 group-hover:text-brand-600 transition-colors">${escHtml(job.title)}</h3>
                <span class="badge ${typeBadge} border">${escHtml(job.job_type)}</span>
                <span class="badge ${workModeBadge} border">${escHtml(job.work_mode)}</span>
              </div>
              <p class="text-xs font-semibold text-slate-600">${escHtml(job.company)}${job.department ? ` · ${escHtml(job.department)}` : ""}</p>
              <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                <span class="flex items-center gap-1"><i data-lucide="map-pin" class="w-3 h-3"></i>${escHtml(locs)}</span>
                <span class="flex items-center gap-1"><i data-lucide="briefcase" class="w-3 h-3"></i>${escHtml(exp)}</span>
                ${job.salary_label && job.salary_label !== "Not disclosed" ? `<span class="flex items-center gap-1 font-semibold text-amber-700"><i data-lucide="indian-rupee" class="w-3 h-3"></i>${escHtml(job.salary_label)}</span>` : ""}
                ${job.openings ? `<span class="flex items-center gap-1"><i data-lucide="users" class="w-3 h-3"></i>${job.openings} opening${job.openings > 1 ? "s" : ""}</span>` : ""}
              </div>
              ${skillTags ? `<div class="flex flex-wrap gap-1 pt-1">${skillTags}</div>` : ""}
            </div>
          </div>

          <!-- Right: date + actions -->
          <div class="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-2 w-full sm:w-auto shrink-0">
            ${postedAt ? `<span class="text-[10px] text-slate-400 whitespace-nowrap">${postedAt}</span>` : ""}
            ${job.apply_last_date ? `<span class="text-[10px] text-rose-500 font-semibold whitespace-nowrap">Closes ${escHtml(job.apply_last_date)}</span>` : ""}
            <div class="flex items-center gap-2 mt-auto sm:mt-1">
              <button class="pj-detail-btn text-xs font-semibold px-3 py-2 rounded-xl border border-slate-200 text-slate-700 hover:border-brand-400 hover:text-brand-600 transition-all" data-id="${escHtml(job.id)}">Details</button>
              <button class="pj-apply-btn text-xs font-semibold px-4 py-2 rounded-xl bg-brand-600 hover:bg-brand-700 text-white transition-all" data-id="${escHtml(job.id)}" data-link="${escHtml(job.apply_link || "")}" data-email="${escHtml(job.apply_email || "")}">Apply</button>
            </div>
          </div>
        </div>
      </div>`;
  }

  function escHtml(str) {
    return String(str || "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
  }

  function renderPagination() {
    const pag = pagination();
    const pi  = pageInfo();
    const prev = prevBtn();
    const next = nextBtn();
    if (!pag) return;

    if (state.totalPages <= 1) {
      pag.classList.add("hidden");
      return;
    }
    pag.classList.remove("hidden");
    if (pi)   pi.textContent  = `Page ${state.page} of ${state.totalPages}`;
    if (prev) prev.disabled   = state.page <= 1;
    if (next) next.disabled   = state.page >= state.totalPages;
  }

  // -------------------------------------------------------------------------
  // Filter helpers
  // -------------------------------------------------------------------------
  function collectFilters() {
    state.workModes = [...document.querySelectorAll(".wm-cb:checked")].map(e => e.value);
    state.jobTypes  = [...document.querySelectorAll(".jt-cb:checked")].map(e => e.value);
    const eMin = document.getElementById("exp-min")?.value;
    const eMax = document.getElementById("exp-max")?.value;
    state.expMin = eMin !== "" && eMin != null ? Number(eMin) : null;
    state.expMax = eMax !== "" && eMax != null ? Number(eMax) : null;
    state.sort   = document.getElementById("pj-sort")?.value || "newest";
    state.search = document.getElementById("pj-search")?.value?.trim() || "";
    state.page   = 1;
  }

  // -------------------------------------------------------------------------
  // Events
  // -------------------------------------------------------------------------
  function bindEvents() {
    document.getElementById("pj-apply-filters")?.addEventListener("click", () => { collectFilters(); fetchJobs(); });
    document.getElementById("pj-search-btn")?.addEventListener("click", () => { collectFilters(); fetchJobs(); });
    document.getElementById("pj-search")?.addEventListener("keydown", e => { if (e.key === "Enter") { collectFilters(); fetchJobs(); } });

    document.getElementById("pj-clear-filters")?.addEventListener("click", () => {
      document.querySelectorAll(".wm-cb,.jt-cb").forEach(cb => cb.checked = false);
      const eMin = document.getElementById("exp-min"); if (eMin) eMin.value = "";
      const eMax = document.getElementById("exp-max"); if (eMax) eMax.value = "";
      const sort = document.getElementById("pj-sort"); if (sort) sort.value = "newest";
      state.workModes = []; state.jobTypes = []; state.expMin = null; state.expMax = null; state.sort = "newest"; state.page = 1;
      fetchJobs();
    });

    document.getElementById("pj-prev")?.addEventListener("click", () => { if (state.page > 1) { state.page--; fetchJobs(); } });
    document.getElementById("pj-next")?.addEventListener("click", () => { if (state.page < state.totalPages) { state.page++; fetchJobs(); } });
  }

  // -------------------------------------------------------------------------
  // Init
  // -------------------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", async () => {
    await loadComponent("navbar-container",  "../components/navbar.html");
    await loadComponent("footer-container",  "../components/footer.html");
    initNav("posted-jobs");
    bindEvents();
    fetchJobs();
  });
})();
